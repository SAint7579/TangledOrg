"""Seed a realistic microservices demo app: repos, profiles, graph edges, policy bindings.

Usage:
    python scripts/seed_demo_app.py

Creates a "SecureInsure Portal" — a fictional insurance platform with 9
microservices, each with appropriate risk tiers, data classifications,
and governance bindings.  Graph dependency edges model the real call
graph between services.
"""

import httpx
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.config import settings

PDS = settings.pds_host.rstrip("/")


def create_session():
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.server.createSession",
        json={"identifier": settings.handle, "password": settings.app_password},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"did": data["did"], "token": data["accessJwt"]}


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


def create_record(session, collection, record, rkey=None):
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


def delete_record(session, collection, rkey):
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.repo.deleteRecord",
        json={"repo": session["did"], "collection": collection, "rkey": rkey},
        headers={"Authorization": f"Bearer {session['token']}"},
        timeout=15,
    )
    resp.raise_for_status()


# ── Demo repos ──────────────────────────────────────────────────────────────

REPOS = [
    {
        "rkey": "portal-web",
        "description": "Customer-facing Next.js insurance portal",
        "riskTier": "medium",
        "dataClassification": "internal",
        "handlesData": ["session-tokens"],
        "regulations": ["standard-coding"],
    },
    {
        "rkey": "api-gateway",
        "description": "API gateway / BFF — routes, rate-limits, validates JWTs",
        "riskTier": "high",
        "dataClassification": "confidential",
        "handlesData": ["auth-tokens", "request-metadata"],
        "regulations": ["iso-27001", "standard-coding"],
    },
    {
        "rkey": "auth-service",
        "description": "Authentication, MFA, session management, password hashing",
        "riskTier": "critical",
        "dataClassification": "restricted",
        "handlesData": ["credentials", "mfa-secrets", "session-keys", "pii"],
        "regulations": ["misra-c", "iso-27001", "standard-coding"],
    },
    {
        "rkey": "policy-engine",
        "description": "Insurance policy CRUD, quoting, underwriting rules",
        "riskTier": "high",
        "dataClassification": "confidential",
        "handlesData": ["policy-data", "customer-profiles", "pricing"],
        "regulations": ["iso-27001", "standard-coding"],
    },
    {
        "rkey": "claims-processor",
        "description": "Claims intake, adjudication, fraud scoring, payout triggers",
        "riskTier": "critical",
        "dataClassification": "restricted",
        "handlesData": ["claim-records", "medical-data", "financial-data", "pii"],
        "regulations": ["misra-c", "iso-27001", "standard-coding"],
    },
    {
        "rkey": "doc-vault",
        "description": "Encrypted document storage — policy docs, claim evidence, ID scans",
        "riskTier": "high",
        "dataClassification": "confidential",
        "handlesData": ["uploaded-documents", "id-scans", "medical-records"],
        "regulations": ["iso-27001", "standard-coding"],
    },
    {
        "rkey": "payment-ledger",
        "description": "Payment processing, premium collection, claim payouts, reconciliation",
        "riskTier": "critical",
        "dataClassification": "restricted",
        "handlesData": ["bank-details", "card-tokens", "transaction-records"],
        "regulations": ["misra-c", "iso-27001", "standard-coding"],
    },
    {
        "rkey": "notification-hub",
        "description": "Email/SMS/push notification dispatch and template management",
        "riskTier": "low",
        "dataClassification": "internal",
        "handlesData": ["contact-info"],
        "regulations": ["standard-coding"],
    },
    {
        "rkey": "audit-trail",
        "description": "Centralized audit logging, tamper-evident event store, compliance reports",
        "riskTier": "high",
        "dataClassification": "confidential",
        "handlesData": ["audit-events", "user-actions", "system-events"],
        "regulations": ["iso-27001", "standard-coding"],
    },
]

# Directed edges: (source_rkey, target_rkey, type, description)
DEPENDENCIES = [
    ("portal-web", "api-gateway", "api-call", "Frontend calls all backend APIs through the gateway"),
    ("api-gateway", "auth-service", "api-call", "Gateway validates JWTs and delegates auth flows"),
    ("api-gateway", "policy-engine", "api-call", "Gateway routes /policies/* requests"),
    ("api-gateway", "claims-processor", "api-call", "Gateway routes /claims/* requests"),
    ("api-gateway", "doc-vault", "api-call", "Gateway proxies document upload/download"),
    ("policy-engine", "doc-vault", "api-call", "Policy attachments stored in doc-vault"),
    ("policy-engine", "notification-hub", "event", "Sends policy confirmation/renewal emails"),
    ("claims-processor", "doc-vault", "api-call", "Claim evidence stored in doc-vault"),
    ("claims-processor", "payment-ledger", "api-call", "Triggers claim payouts via payment service"),
    ("claims-processor", "notification-hub", "event", "Sends claim status update notifications"),
    ("payment-ledger", "notification-hub", "event", "Sends payment confirmation/failure alerts"),
    ("auth-service", "audit-trail", "event", "Logs login attempts, password changes, MFA events"),
    ("payment-ledger", "audit-trail", "event", "Logs all financial transactions"),
    ("claims-processor", "audit-trail", "event", "Logs claim state transitions and approvals"),
    ("policy-engine", "audit-trail", "event", "Logs policy creation, modification, cancellation"),
]


def main():
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()

    print(f"Connecting to PDS: {PDS}")
    print(f"Org owner: {settings.handle}")
    session = create_session()
    print(f"Authenticated as: {session['did']}\n")

    # ── Read existing repos (DO NOT delete/recreate sh.tangled.repo records) ─
    demo_rkeys = {r["rkey"] for r in REPOS}
    existing_repos = list_records(session, "sh.tangled.repo")

    # Clean old demo repo profiles
    existing_profiles = list_records(session, "sh.tangled.governance.compliance.repoProfile")
    for p in existing_profiles:
        val = p.get("value", {})
        repo_ref = val.get("repo", "")
        for rk in demo_rkeys:
            if rk in repo_ref:
                rkey = p.get("uri", "").rsplit("/", 1)[-1]
                if rkey:
                    print(f"  Deleting existing repo profile for: {rk}")
                    delete_record(session, "sh.tangled.governance.compliance.repoProfile", rkey)
                break

    # Clean old graph edges
    for coll in [
        "sh.tangled.governance.graph.repoDependency",
        "sh.tangled.governance.graph.codeDependency",
        "sh.tangled.governance.graph.serviceDependency",
    ]:
        recs = list_records(session, coll)
        for r in recs:
            rkey = r.get("uri", "").rsplit("/", 1)[-1]
            if rkey:
                print(f"  Deleting graph edge: {coll.split('.')[-1]}/{rkey}")
                delete_record(session, coll, rkey)

    # Clean old policy bindings
    existing_bindings = list_records(session, "sh.tangled.governance.policy.repoBinding")
    for b in existing_bindings:
        rkey = b.get("uri", "").rsplit("/", 1)[-1]
        if rkey:
            print(f"  Deleting old binding: {rkey}")
            delete_record(session, "sh.tangled.governance.policy.repoBinding", rkey)

    # ── Get org URI ─────────────────────────────────────────────────────
    orgs = list_records(session, "sh.tangled.governance.org.organization")
    org_uri = orgs[0]["uri"] if orgs else ""
    print(f"\nOrg URI: {org_uri or '(none)'}")

    # ── Get existing policy packs ───────────────────────────────────────
    packs = list_records(session, "sh.tangled.governance.policy.policyPack")
    pack_map = {}  # framework -> uri
    for p in packs:
        val = p.get("value", {})
        fw = val.get("framework", "")
        name = val.get("name", "")
        pack_uri = p.get("uri", "")
        pack_map[fw] = pack_uri
        print(f"  Found policy pack: {name} (framework={fw}, uri={pack_uri})")

    # ── Build repo URI map from existing repos ─────────────────────────
    print("\n── Reading existing repos ──")
    repo_uri_map = {}  # rkey -> uri

    for r in existing_repos:
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
        if rkey in demo_rkeys:
            repo_uri_map[rkey] = uri
            knot = r.get("value", {}).get("knot", "")
            print(f"  Found: {rkey} -> {uri} (knot={knot or 'none'})")

    missing = demo_rkeys - set(repo_uri_map.keys())
    if missing:
        print(f"\n  WARNING: Missing repos (run seed_real_repos.py first): {missing}")

    # ── Create repo profiles ────────────────────────────────────────────
    print("\n── Creating repo profiles ──")

    for repo in REPOS:
        rkey = repo["rkey"]
        repo_uri = repo_uri_map.get(rkey, "")
        if not repo_uri:
            continue

        profile_record = {
            "org": org_uri,
            "repo": repo_uri,
            "dataClassification": repo["dataClassification"],
            "handlesData": repo.get("handlesData", []),
            "applicableRegulations": repo.get("regulations", []),
            "riskTier": repo["riskTier"],
            "enforcementMode": "hard" if repo["riskTier"] in ("critical", "high") else "warn",
            "description": repo["description"],
            "createdAt": now,
        }
        create_record(session, "sh.tangled.governance.compliance.repoProfile", profile_record)
        print(f"  Profile: {rkey} [risk={repo['riskTier']}, data={repo['dataClassification']}]")

    # ── Create dependency graph edges ───────────────────────────────────
    print("\n── Creating graph dependencies ──")

    for src, tgt, dep_type, desc in DEPENDENCIES:
        src_uri = repo_uri_map.get(src, "")
        tgt_uri = repo_uri_map.get(tgt, "")
        if not src_uri or not tgt_uri:
            print(f"  SKIP: {src} -> {tgt} (missing URI)")
            continue

        record = {
            "sourceRepo": src_uri,
            "targetRepo": tgt_uri,
            "dependencyType": dep_type,
            "description": desc,
            "createdAt": now,
        }
        create_record(session, "sh.tangled.governance.graph.repoDependency", record)
        print(f"  {src} --[{dep_type}]--> {tgt}")

    # ── Bind policy packs to repos ──────────────────────────────────────
    print("\n── Binding policy packs to repos ──")

    framework_to_regulation = {
        "misra-c": "misra-c",
        "iso-27001": "iso-27001",
        "custom": "standard-coding",
    }

    for repo in REPOS:
        rkey = repo["rkey"]
        repo_uri = repo_uri_map.get(rkey, "")
        if not repo_uri:
            continue

        for fw, pack_uri in pack_map.items():
            regulation_slug = framework_to_regulation.get(fw, fw)
            if regulation_slug in repo.get("regulations", []):
                bind_record = {
                    "repo": repo_uri,
                    "policyPack": pack_uri,
                    "boundBy": session["did"],
                    "createdAt": now,
                }
                enforcement = "hard" if repo["riskTier"] in ("critical",) else "warn"
                bind_record["enforcementOverride"] = enforcement
                create_record(session, "sh.tangled.governance.policy.repoBinding", bind_record)
                fw_name = fw or "custom"
                print(f"  {rkey} <- {fw_name} [enforcement={enforcement}]")

    # ── Summary ─────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Demo seeded successfully!")
    print(f"  Repos created:       {len(REPOS)}")
    print(f"  Graph edges created: {len(DEPENDENCIES)}")
    print(f"  Policy bindings:     (per-repo based on risk tier)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
