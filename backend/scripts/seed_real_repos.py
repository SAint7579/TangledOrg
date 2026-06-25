"""Create real Tangled repos via the two-step protocol flow.

Step 1: Get ServiceAuth token from PDS  (aud = did:web:knot1.tangled.sh)
Step 2: POST sh.tangled.repo.create to Tangled API with ServiceAuth
Step 3: Write PDS record with real knot + repoDid

Usage:
    python scripts/seed_real_repos.py
"""

import httpx
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.config import settings

PDS = settings.pds_host.rstrip("/")
KNOT = "knot1.tangled.sh"
TANGLED_API = "https://knot1.tangled.sh"

REPO_NAMES = [
    "portal-web",
    "api-gateway",
    "auth-service",
    "policy-engine",
    "claims-processor",
    "doc-vault",
    "payment-ledger",
    "notification-hub",
    "audit-trail",
]

DESCRIPTIONS = {
    "portal-web": "Customer-facing Next.js insurance portal",
    "api-gateway": "API gateway / BFF — routes, rate-limits, validates JWTs",
    "auth-service": "Authentication, MFA, session management, password hashing",
    "policy-engine": "Insurance policy CRUD, quoting, underwriting rules",
    "claims-processor": "Claims intake, adjudication, fraud scoring, payout triggers",
    "doc-vault": "Encrypted document storage — policy docs, claim evidence, ID scans",
    "payment-ledger": "Payment processing, premium collection, claim payouts, reconciliation",
    "notification-hub": "Email/SMS/push notification dispatch and template management",
    "audit-trail": "Centralized audit logging, tamper-evident event store, compliance reports",
}


def create_session():
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.server.createSession",
        json={"identifier": settings.handle, "password": settings.app_password},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "did": data["did"],
        "token": data["accessJwt"],
        "refresh": data.get("refreshJwt", ""),
    }


def list_records(session, collection):
    resp = httpx.get(
        f"{PDS}/xrpc/com.atproto.repo.listRecords",
        params={"repo": session["did"], "collection": collection, "limit": 100},
        headers={"Authorization": f"Bearer {session['token']}"},
        timeout=15,
    )
    if resp.status_code != 200:
        return []
    return resp.json().get("records", [])


def delete_record(session, collection, rkey):
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.repo.deleteRecord",
        json={"repo": session["did"], "collection": collection, "rkey": rkey},
        headers={"Authorization": f"Bearer {session['token']}"},
        timeout=15,
    )
    if resp.status_code == 200:
        return True
    print(f"    Warning: delete {collection}/{rkey} returned {resp.status_code}: {resp.text}")
    return False


def create_pds_record(session, collection, record, rkey=None):
    body = {
        "repo": session["did"],
        "collection": collection,
        "record": {**record, "$type": collection},
    }
    if rkey:
        body["rkey"] = rkey
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.repo.createRecord",
        json=body,
        headers={"Authorization": f"Bearer {session['token']}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def get_service_auth(session, aud, lxm="sh.tangled.repo.create"):
    """Get a ServiceAuth token from the PDS for the given audience DID."""
    exp = int(time.time()) + 30
    params = {"aud": aud, "exp": str(exp)}
    if lxm:
        params["lxm"] = lxm
    resp = httpx.get(
        f"{PDS}/xrpc/com.atproto.server.getServiceAuth",
        params=params,
        headers={"Authorization": f"Bearer {session['token']}"},
        timeout=15,
    )
    if resp.status_code != 200:
        print(f"    ServiceAuth failed ({resp.status_code}): {resp.text}")
        return None
    return resp.json().get("token", "")


def create_repo_on_knot(service_token, name, rkey):
    """Call sh.tangled.repo.create on the Tangled API."""
    resp = httpx.post(
        f"{TANGLED_API}/xrpc/sh.tangled.repo.create",
        json={
            "name": name,
            "rkey": rkey,
            "defaultBranch": "main",
        },
        headers={"Authorization": f"Bearer {service_token}"},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(f"    Knot create failed ({resp.status_code}): {resp.text}")
        return None
    return resp.json()


def main():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    print(f"PDS: {PDS}")
    print(f"Knot: {KNOT}")
    print(f"Owner: {settings.handle}")
    session = create_session()
    print(f"DID: {session['did']}\n")

    # ── Step 0: Clean up dummy repos ────────────────────────────────────
    print("── Cleaning dummy repos ──")
    existing = list_records(session, "sh.tangled.repo")
    demo_rkeys = set(REPO_NAMES)
    for r in existing:
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
        if rkey in demo_rkeys:
            val = r.get("value", {})
            if not val.get("knot"):
                print(f"  Deleting dummy: {rkey}")
                delete_record(session, "sh.tangled.repo", rkey)
            else:
                print(f"  Keeping real repo: {rkey} (knot={val.get('knot')})")
                demo_rkeys.discard(rkey)

    knot_did = f"did:web:{KNOT}"

    # ── Step 1+2: Create repos (fresh ServiceAuth per repo) ─────────────
    print(f"\n── Creating {len(demo_rkeys)} repos ──")
    created = {}

    for name in REPO_NAMES:
        if name not in demo_rkeys:
            print(f"  SKIP {name} (already exists)")
            continue

        print(f"\n  [{name}]")

        # Fresh ServiceAuth token for each repo (30s expiry)
        service_token = get_service_auth(session, knot_did)
        if not service_token:
            print(f"    SKIP — no ServiceAuth token")
            continue

        # 2a: Create on knot
        print(f"    Creating on knot ({KNOT})...")
        knot_result = create_repo_on_knot(service_token, name, name)
        if not knot_result:
            print(f"    FAILED — skipping {name}")
            continue

        repo_did = knot_result.get("repoDid", "")
        print(f"    repoDid: {repo_did}")

        # 2b: Create PDS record
        print(f"    Writing PDS record...")
        pds_record = {
            "knot": KNOT,
            "repoDid": repo_did,
            "createdAt": now,
        }
        result = create_pds_record(session, "sh.tangled.repo", pds_record, rkey=name)
        uri = result.get("uri", "")
        print(f"    URI: {uri}")
        created[name] = {"uri": uri, "repoDid": repo_did}

        time.sleep(0.5)

    # ── Summary ─────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Created {len(created)} real repos on Tangled:")
    for name, info in created.items():
        print(f"  {name}: {info['uri']}")
    print(f"\nGit clone URLs:")
    for name, info in created.items():
        print(f"  git clone https://{KNOT}/{session['did']}/{name}.git")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
