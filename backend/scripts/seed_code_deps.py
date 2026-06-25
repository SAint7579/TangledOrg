"""Seed code-level dependencies between the SecureInsure microservices.

Maps actual function calls / imports between services so the graph
shows code-level interconnections (e.g. which function calls which API).

Usage:
    python scripts/seed_code_deps.py
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


def create_record(session, collection, record):
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.repo.createRecord",
        json={
            "repo": session["did"],
            "collection": collection,
            "record": {**record, "$type": collection},
        },
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


CODE_DEPS = [
    # portal-web → api-gateway
    {
        "source": "portal-web", "sourcePath": "app/page.tsx", "sourceLabel": "Dashboard.useEffect()",
        "target": "api-gateway", "targetPath": "main.py", "targetLabel": "proxy_policies()",
        "type": "api-call", "desc": "Frontend fetches policies via gateway",
    },
    # api-gateway → auth-service
    {
        "source": "api-gateway", "sourcePath": "main.py", "sourceLabel": "_verify_auth()",
        "target": "auth-service", "targetPath": "main.py", "targetLabel": "verify_token()",
        "type": "api-call", "desc": "Gateway validates JWT with auth service",
    },
    # api-gateway → policy-engine
    {
        "source": "api-gateway", "sourcePath": "main.py", "sourceLabel": "proxy_policies()",
        "target": "policy-engine", "targetPath": "main.py", "targetLabel": "list_policies()",
        "type": "api-call", "desc": "Gateway proxies /policies/* to policy-engine",
    },
    # api-gateway → claims-processor
    {
        "source": "api-gateway", "sourcePath": "main.py", "sourceLabel": "proxy_claims()",
        "target": "claims-processor", "targetPath": "main.py", "targetLabel": "list_claims()",
        "type": "api-call", "desc": "Gateway proxies /claims/* to claims-processor",
    },
    # api-gateway → doc-vault (no auth!)
    {
        "source": "api-gateway", "sourcePath": "main.py", "sourceLabel": "proxy_documents()",
        "target": "doc-vault", "targetPath": "main.py", "targetLabel": "upload_document()",
        "type": "api-call", "desc": "Gateway proxies docs WITHOUT auth check",
    },
    # policy-engine → doc-vault
    {
        "source": "policy-engine", "sourcePath": "main.py", "sourceLabel": "create_policy()",
        "target": "doc-vault", "targetPath": "main.py", "targetLabel": "upload_document()",
        "type": "api-call", "desc": "Policy attachments stored in doc-vault",
    },
    # policy-engine → notification-hub
    {
        "source": "policy-engine", "sourcePath": "main.py", "sourceLabel": "create_policy()",
        "target": "notification-hub", "targetPath": "main.py", "targetLabel": "send_notification()",
        "type": "event", "desc": "Sends policy_created notification",
    },
    # policy-engine → audit-trail
    {
        "source": "policy-engine", "sourcePath": "main.py", "sourceLabel": "create_policy()",
        "target": "audit-trail", "targetPath": "main.py", "targetLabel": "create_audit_entry()",
        "type": "event", "desc": "Logs policy.created event",
    },
    # claims-processor → payment-ledger
    {
        "source": "claims-processor", "sourcePath": "main.py", "sourceLabel": "adjudicate()",
        "target": "payment-ledger", "targetPath": "main.py", "targetLabel": "process_payout()",
        "type": "api-call", "desc": "Triggers claim payout on approval",
    },
    # claims-processor → doc-vault
    {
        "source": "claims-processor", "sourcePath": "main.py", "sourceLabel": "create_claim()",
        "target": "doc-vault", "targetPath": "main.py", "targetLabel": "upload_document()",
        "type": "api-call", "desc": "Uploads claim evidence documents",
    },
    # claims-processor → notification-hub
    {
        "source": "claims-processor", "sourcePath": "main.py", "sourceLabel": "adjudicate()",
        "target": "notification-hub", "targetPath": "main.py", "targetLabel": "send_notification()",
        "type": "event", "desc": "Sends claim status notification",
    },
    # claims-processor → audit-trail
    {
        "source": "claims-processor", "sourcePath": "main.py", "sourceLabel": "create_claim()",
        "target": "audit-trail", "targetPath": "main.py", "targetLabel": "create_audit_entry()",
        "type": "event", "desc": "Logs claim.created with medical notes (PII leak!)",
    },
    # payment-ledger → notification-hub
    {
        "source": "payment-ledger", "sourcePath": "main.py", "sourceLabel": "process_payout()",
        "target": "notification-hub", "targetPath": "main.py", "targetLabel": "send_notification()",
        "type": "event", "desc": "Sends payout_completed notification",
    },
    # payment-ledger → audit-trail
    {
        "source": "payment-ledger", "sourcePath": "main.py", "sourceLabel": "charge_premium()",
        "target": "audit-trail", "targetPath": "main.py", "targetLabel": "create_audit_entry()",
        "type": "event", "desc": "Logs payment.charge with card number (sensitive!)",
    },
    # auth-service → audit-trail
    {
        "source": "auth-service", "sourcePath": "main.py", "sourceLabel": "login()",
        "target": "audit-trail", "targetPath": "main.py", "targetLabel": "create_audit_entry()",
        "type": "event", "desc": "Logs login events (password in log!)",
    },
    # policy-engine SQL injection path
    {
        "source": "portal-web", "sourcePath": "app/page.tsx", "sourceLabel": "fetch(/policies?customer_id=)",
        "target": "policy-engine", "targetPath": "main.py", "targetLabel": "list_policies(customer_id)",
        "type": "api-call", "desc": "SQL injection vector: customer_id passed via string formatting",
    },
]


def main():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    print(f"PDS: {PDS}")
    session = create_session()
    print(f"DID: {session['did']}\n")

    # Build repo URI map
    repos = list_records(session, "sh.tangled.repo")
    repo_map = {}
    for r in repos:
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
        repo_map[rkey] = uri

    print(f"Found {len(repo_map)} repos")

    # Clean existing code deps
    existing = list_records(session, "sh.tangled.governance.graph.codeDependency")
    for r in existing:
        rkey = r.get("uri", "").rsplit("/", 1)[-1]
        if rkey:
            delete_record(session, "sh.tangled.governance.graph.codeDependency", rkey)
    print(f"Deleted {len(existing)} existing code deps\n")

    # Create new code deps
    created = 0
    for dep in CODE_DEPS:
        src_uri = repo_map.get(dep["source"], "")
        tgt_uri = repo_map.get(dep["target"], "")
        if not src_uri or not tgt_uri:
            print(f"  SKIP: {dep['source']} -> {dep['target']} (repo not found)")
            continue

        record = {
            "sourceRepo": src_uri,
            "sourcePath": dep["sourcePath"],
            "sourceLabel": dep.get("sourceLabel", ""),
            "targetRepo": tgt_uri,
            "targetPath": dep["targetPath"],
            "targetLabel": dep.get("targetLabel", ""),
            "dependencyType": dep["type"],
            "description": dep.get("desc", ""),
            "createdAt": now,
        }
        create_record(session, "sh.tangled.governance.graph.codeDependency", record)
        label = dep.get("sourceLabel", dep["sourcePath"])
        target_label = dep.get("targetLabel", dep["targetPath"])
        print(f"  {dep['source']}:{label} --[{dep['type']}]--> {dep['target']}:{target_label}")
        created += 1

    print(f"\nCreated {created} code-level dependencies.")


if __name__ == "__main__":
    main()
