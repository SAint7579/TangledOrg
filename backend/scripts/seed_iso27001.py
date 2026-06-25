"""Seed the ISO 27001 policy pack from the stage-gate checklists.

Usage:
    python scripts/seed_iso27001.py

Connects to the PDS using the org owner's app password from settings,
deletes any existing policy packs, and creates the ISO 27001 pack
with controls derived from the 4 stage-gate checklists.
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


def delete_record(session, collection, rkey):
    resp = httpx.post(
        f"{PDS}/xrpc/com.atproto.repo.deleteRecord",
        json={"repo": session["did"], "collection": collection, "rkey": rkey},
        headers={"Authorization": f"Bearer {session['token']}"},
        timeout=15,
    )
    resp.raise_for_status()


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


CONTROLS = [
    # ── Stage 1: Coding ──────────────────────────────────────────────────
    {
        "controlId": "CS-01",
        "name": "Stage Gate: Coding Stage Decision",
        "description": "Code may leave the coding stage only when: it builds with approved compiler/flags, static checks pass, C rule-set checks pass, every deviation is documented, unit tests exist, no secrets or real customer data are present, change is reviewable, and implementer can explain failure behavior.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.25, A.8.28",
    },
    {
        "controlId": "CS-02",
        "name": "Branch Hygiene",
        "description": "Work must be on feature/* branches only. No direct work on entwicklung/staging/main. Branch names reference work items, contain only required changes, no unrelated formatting/refactoring/experiments.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "medium",
        "isoReference": "A.8.25",
    },
    {
        "controlId": "CS-03",
        "name": "Work Item Understanding",
        "description": "Clear purpose, affected portal functions, protected domain objects, user roles, integrations, success/failure/rollback behavior are all known. No hidden behavior or control bypassing.",
        "checkType": "manual",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.25, A.5.8",
    },
    {
        "controlId": "CS-04",
        "name": "Toolchain & Compiler Controls",
        "description": "Approved compiler/linker versions and flags used. Versions recorded in build output. No local machine dependencies. Build reproducible by CI. No unreviewed warnings.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "medium",
        "isoReference": "A.8.25, A.8.9",
    },
    {
        "controlId": "CS-05",
        "name": "Static Analysis",
        "description": "Run on changed files with approved profile. All high-severity, memory-safety, arithmetic, control-flow, pointer, resource-leak, and dead-code findings resolved. Suppressions require approved deviations.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.28",
    },
    {
        "controlId": "CS-06",
        "name": "Deviation Control",
        "description": "Every deviation has an ID, exact file/function/line, rule area, justification, failure consequences, compensating control, and approval. No comment-only or convenience deviations.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.25, A.5.1",
    },
    {
        "controlId": "CS-07",
        "name": "Memory Safety",
        "description": "Buffer writes/reads have size boundaries, string copies length-bound, allocations checked for failure, resources have clear ownership and release paths, freed memory not reused, pointers checked before dereference. Sensitive buffers cleared. Crash dumps cannot expose secrets or customer data.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.28, A.8.26",
    },
    {
        "controlId": "CS-08",
        "name": "Arithmetic & Bounds Safety",
        "description": "Division by zero prevented, array indices bounded, length/multiplication/addition overflow-checked, customer-supplied numbers have min/max bounds, dates have valid ranges, retry/loop counters have maximums.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.28",
    },
    {
        "controlId": "CS-09",
        "name": "Input Handling",
        "description": "External input treated as untrusted. HTTP params/bodies validated. File names/types not trusted. Customer IDs validated and authorized. Redirects restricted. Headers/cookies not trusted without verification.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.28, A.8.26",
    },
    {
        "controlId": "CS-10",
        "name": "Output Handling",
        "description": "User-facing errors are generic, contain no secrets/tokens/stack traces/database errors/internal paths/other customer data. API responses return only required fields, no debug data. Document downloads enforce ownership.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.28, A.8.11",
    },
    {
        "controlId": "CS-11",
        "name": "Authentication & Authorization Logic",
        "description": "Authentication and session validity checked before protected functions. Server-side authorization with explicit role/ownership/admin checks. Object access verified before content returned or state changed.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.3, A.8.5",
    },
    {
        "controlId": "CS-12",
        "name": "Data Write Safety",
        "description": "Correct customer/policy/claim/document context. No silent overwrites or deletes. Partial writes prevented or recoverable. Duplicates handled safely. Audit records for critical changes.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.25, A.8.10",
    },
    {
        "controlId": "CS-13",
        "name": "Logging & Audit",
        "description": "Login/authorization failures logged. Critical customer/policy/claim/document/payment/admin actions auditable. Logs contain no passwords/tokens/keys/unnecessary customer data. Logs include investigation context.",
        "checkType": "automated",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.15, A.8.17",
    },
    {
        "controlId": "CS-14",
        "name": "Secrets & Configuration",
        "description": "No committed passwords/API keys/tokens/private keys. No hardcoded production endpoints. No debug/insecure mode enabled by default. No TLS bypass. Safe defaults for new config. Missing config fails safely.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.4, A.8.9",
    },
    {
        "controlId": "CS-15",
        "name": "Dependencies & Libraries",
        "description": "New library usage approved, necessary, compatible with C rule-set. No prohibited functions. Library inputs validated, return values checked, failures handled safely.",
        "checkType": "manual",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.25, A.8.28",
    },
    {
        "controlId": "CS-16",
        "name": "Naming & Readability",
        "description": "Names describe business meaning. No hidden security behavior. Constants named. No magic values for statuses or permissions. Comments explain why, not what. Commented-out code removed. TODO comments linked to work items.",
        "checkType": "manual",
        "enforcement": "warn",
        "severity": "low",
        "isoReference": "A.8.25",
    },
    {
        "controlId": "CS-17",
        "name": "Types & Data Representation",
        "description": "Integer widths explicit. Signed/unsigned not mixed. API boundary values have documented ranges. Status values use approved enums. Customer/policy/claim/payment IDs use approved types. Field meaning not changed without migration.",
        "checkType": "manual",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.25",
    },
    {
        "controlId": "CS-18",
        "name": "Unit Tests (Coding Stage)",
        "description": "Tests cover main success path, failure path, invalid/boundary input, authorization denial, duplicate requests, integration failure handling. No real customer data or secrets in tests.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.29",
    },
    # ── Stage 2: Development ─────────────────────────────────────────────
    {
        "controlId": "DEV-01",
        "name": "Stage Gate: Development Stage Decision",
        "description": "PR may enter entwicklung only when: coding checklist passed, PR explains change clearly, data/access-control/integration/config/migration impacts known, test results attached, rollback approach known, no customer data exposure or corruption risk.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "DEV-02",
        "name": "Pull Request Identity & Scope",
        "description": "One linked work item, title identifies product area and change type. Description states what/why/how-tested/what-can-go-wrong/how-to-revert. No unrelated changes. Small enough to review.",
        "checkType": "manual",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "DEV-03",
        "name": "Data Impact Declaration",
        "description": "PR declares reads/writes for customer account/profile/policy/claim/document/payment/audit data. Unknown data impact blocks merge.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.5.12, A.8.10",
    },
    {
        "controlId": "DEV-04",
        "name": "Access Control Review",
        "description": "No bypass/weakening of login, session, password reset, MFA. Server-side authorization enforced. Ownership checked before data read/write/return. Customer-to-customer access prevented. Unknown permission = denied.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.3, A.8.5",
    },
    {
        "controlId": "DEV-05",
        "name": "API & Contract Check",
        "description": "No fields removed/renamed/changed without compatibility review. Responses not broader than required. No client-controlled field trusted for authorization or business state. Error formats remain safe.",
        "checkType": "manual",
        "enforcement": "soft",
        "severity": "high",
        "isoReference": "A.8.25, A.8.26",
    },
    {
        "controlId": "DEV-06",
        "name": "File Review Boundary",
        "description": "Changed files reviewed. New/deleted/renamed files expected. No unexpected binary, customer document, or local machine files present. Generated, config, migration, and deployment files expected.",
        "checkType": "manual",
        "enforcement": "warn",
        "severity": "low",
        "isoReference": "A.8.25",
    },
    {
        "controlId": "DEV-07",
        "name": "Configuration Check",
        "description": "No secrets, tokens, private keys, or local paths committed. No debug/unsafe config enabled by default. No production config points to dev systems. New config keys documented with safe defaults.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.9, A.8.4",
    },
    {
        "controlId": "DEV-08",
        "name": "Migration Check",
        "description": "Schema/data migration declared. Clear purpose, linked to app change. No data deletion without approval. Can run once safely, not destructively twice. Has rollback or explicit irreversible approval.",
        "checkType": "manual",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "DEV-09",
        "name": "Human Review Check",
        "description": "Reviewer is not the author. Reviewer can explain the change, data impact, access-control impact, integration impact, failure behavior, and rollback approach.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.25, A.8.4",
    },
    # ── Stage 3: QA ──────────────────────────────────────────────────────
    {
        "controlId": "QA-01",
        "name": "Stage Gate: QA Stage Decision",
        "description": "Change may move to staging only when: change understood, build identified, all PRs known, user flows/integrations/data writes/authorization/customer isolation/failure behavior tested, regression risk checked.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.29, A.8.32",
    },
    {
        "controlId": "QA-02",
        "name": "Environment & Test Data",
        "description": "Approved test environment with matching build. Synthetic or approved sanitized data only. No production customer records, secrets, or credentials used for testing.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.31, A.8.33",
    },
    {
        "controlId": "QA-03",
        "name": "Customer Data Isolation Test",
        "description": "Customer A cannot view/update B's profile, policies, claims, documents. Cannot create claims under B's policy. Cannot infer B's data from errors or timing. Cross-customer calls fail safely and are logged.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.3, A.5.15",
    },
    {
        "controlId": "QA-04",
        "name": "Authorization Testing",
        "description": "Unauthenticated/expired access to protected pages and APIs fails. Normal users cannot access admin endpoints/pages or change roles. Cannot access other users' objects by changing IDs.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.3, A.8.5",
    },
    {
        "controlId": "QA-05",
        "name": "Functional Behavior Check",
        "description": "Success and failure paths work. Validation messages safe. Invalid/oversized/missing/malformed input rejected. Duplicate submissions handled. Browser refresh and back-button do not duplicate critical writes.",
        "checkType": "automated",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.29",
    },
    {
        "controlId": "QA-06",
        "name": "Integration Testing",
        "description": "Each affected integration tested for success and failure behavior. Timeout, invalid response, and duplicate response behavior tested. No integration receives more data than necessary or secrets in URLs.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.29, A.5.21",
    },
    {
        "controlId": "QA-07",
        "name": "Core Portal Regression",
        "description": "Login page loads, valid login works, invalid fails safely, logout works. Customer dashboard, profile, policy, claim, document flows all functional. Affected audit events created.",
        "checkType": "automated",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.8.29",
    },
    {
        "controlId": "QA-08",
        "name": "Security Regression Check",
        "description": "No protected page/API publicly reachable. No test/debug endpoint reachable. No customer object accessible by changing IDs. No sensitive values in browser output or screenshots.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.8, A.8.29",
    },
    {
        "controlId": "QA-09",
        "name": "Error & Logging Check",
        "description": "User-facing errors contain no passwords, tokens, secrets, stack traces, DB details, internal paths, or other customer data. Application logs contain no sensitive data. Logs allow failure investigation.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.11, A.8.15",
    },
    {
        "controlId": "QA-10",
        "name": "Test Evidence",
        "description": "Test run/build/environment/accounts recorded. Pass/fail results recorded. Screenshots and logs contain no real customer data or secrets. Open and accepted risks listed and approved.",
        "checkType": "manual",
        "enforcement": "warn",
        "severity": "low",
        "isoReference": "A.8.29, A.8.34",
    },
    # ── Stage 4: Production ──────────────────────────────────────────────
    {
        "controlId": "PROD-01",
        "name": "Stage Gate: Production Decision",
        "description": "Change may reach production only when: exact release commit known, all changes known, previous stage approved, staging passed, release config/migration/rollback known, monitoring/smoke/nightly tests ready, named failure response owner exists.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "PROD-02",
        "name": "Release Identity & Approval",
        "description": "Release has version/commit/branch/artifact identifiers. Artifact built from reviewed commit, not manually modified, checksum recorded. All stage approvals exist. No person is sole approver of their own change.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "PROD-03",
        "name": "Production Configuration",
        "description": "Production endpoints correct. No dev/staging/test endpoints or credentials. Debug mode disabled. TLS enabled. Secrets in approved store. Feature flags set intentionally with safe defaults.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.9, A.8.24",
    },
    {
        "controlId": "PROD-04",
        "name": "Deployment & Rollback Readiness",
        "description": "Deployment plan, sequence, window, customer/internal impact, downtime known. Manual steps documented with owners. Backout decision point, rollback owner, support owner, incident contact defined.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "PROD-05",
        "name": "Monitoring Readiness",
        "description": "Alerts exist for: portal availability, login/auth failure spikes, API errors/latency, integration failures, document/claim/policy/payment failures, DB errors, audit logging failures, nightly test failures. Alert owner defined.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.16, A.8.17",
    },
    {
        "controlId": "PROD-06",
        "name": "Post-Deployment Smoke Check",
        "description": "Health endpoint, portal, login/logout, protected page rejection, dashboard, policy/claim/document flows tested with synthetic users. Customer isolation verified. Audit events written. No secrets or customer data in logs.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.29",
    },
    {
        "controlId": "PROD-07",
        "name": "Merge to Main Check",
        "description": "Main is protected. No direct push or force push. Merge source is staging/release branch. No additional or unreviewed commits. No manual conflict resolution without review. Traceable merge commit. Immutable release tag.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "medium",
        "isoReference": "A.8.25, A.8.32",
    },
    {
        "controlId": "PROD-08",
        "name": "Integration Readiness",
        "description": "Identity provider, customer master-data, policy-system, claims-system, document-storage, payment, notification, audit-log, and monitoring integrations healthy. Credentials and certificates valid. Network rules in place.",
        "checkType": "automated",
        "enforcement": "soft",
        "severity": "medium",
        "isoReference": "A.5.21, A.8.29",
    },
    {
        "controlId": "PROD-09",
        "name": "Nightly Authentication & Authorization",
        "description": "Valid login succeeds, invalid fails safely. Expired sessions rejected. Protected pages/APIs reject unauthenticated access. Customer isolation verified nightly. Normal users cannot access admin functions.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.8.3, A.8.5",
    },
    {
        "controlId": "PROD-10",
        "name": "Nightly Data Integrity & Integration",
        "description": "Synthetic records remain readable and correctly linked. No unexpected duplicates or state changes. All integration checks pass. Failed actions did not create partial records. Audit events exist for critical actions.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "high",
        "isoReference": "A.8.10, A.8.29",
    },
    {
        "controlId": "PROD-11",
        "name": "Nightly Sensitive Output Check",
        "description": "Error responses contain no passwords, tokens, keys, stack traces, or DB details. Logs contain no passwords, full tokens, uploaded document content, or unnecessary customer data.",
        "checkType": "automated",
        "enforcement": "hard",
        "severity": "medium",
        "isoReference": "A.8.11, A.8.15",
    },
    {
        "controlId": "PROD-12",
        "name": "Nightly Failure Handling",
        "description": "Every failure creates alert with owner and severity. Customer data exposure/cross-customer access/authorization bypass/data corruption treated as critical. Repeated failures trigger incident review. No test disabled without approved reason.",
        "checkType": "manual",
        "enforcement": "hard",
        "severity": "critical",
        "isoReference": "A.5.24, A.5.25, A.5.26",
    },
    {
        "controlId": "PROD-13",
        "name": "Rollback Check",
        "description": "Rollback command, artifact, configuration, and owner available. Decision time limit known. Effects on migrations, feature flags, integrations, and customer sessions known. Started immediately on critical data exposure or corruption.",
        "checkType": "manual",
        "enforcement": "warn",
        "severity": "low",
        "isoReference": "A.8.25, A.5.26",
    },
]


def main():
    print(f"Connecting to PDS: {PDS}")
    print(f"Org owner: {settings.handle}")
    session = create_session()
    print(f"Authenticated as: {session['did']}")

    # Delete existing policy packs, controls, and bindings
    for collection in [
        "sh.tangled.governance.policy.control",
        "sh.tangled.governance.policy.repoBinding",
        "sh.tangled.governance.policy.policyPack",
    ]:
        records = list_records(session, collection)
        for r in records:
            uri = r.get("uri", "")
            rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
            if rkey:
                print(f"  Deleting {collection}/{rkey}")
                delete_record(session, collection, rkey)
        print(f"  Deleted {len(records)} {collection.split('.')[-1]} records")

    # Get org URI
    orgs = list_records(session, "sh.tangled.governance.org.organization")
    org_uri = orgs[0]["uri"] if orgs else ""
    print(f"Org URI: {org_uri or '(none)'}")

    # Create the ISO 27001 policy pack
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    pack = create_record(session, "sh.tangled.governance.policy.policyPack", {
        "org": org_uri,
        "name": "ISO 27001 Stage-Gate Controls",
        "displayName": "ISO 27001 Stage-Gate Controls",
        "description": "Comprehensive controls derived from ISO 27001 Annex A, covering coding, development, QA, and production stages. Based on critical-system software development checklists for code safety, data protection, access control, and operational security.",
        "framework": "iso-27001",
        "version": "1.0",
        "createdAt": now,
    })
    pack_uri = pack.get("uri", "")
    print(f"\nCreated policy pack: {pack_uri}")

    # Create controls
    for i, ctrl in enumerate(CONTROLS):
        record = {
            "policyPack": pack_uri,
            "controlId": ctrl["controlId"],
            "name": ctrl["name"],
            "description": ctrl["description"],
            "checkType": ctrl.get("checkType", "manual"),
            "enforcement": ctrl.get("enforcement", "warn"),
            "severity": ctrl.get("severity", "medium"),
        }
        if ctrl.get("isoReference"):
            record["isoReference"] = ctrl["isoReference"]
        create_record(session, "sh.tangled.governance.policy.control", record)
        print(f"  [{i+1}/{len(CONTROLS)}] {ctrl['controlId']}: {ctrl['name']}")

    print(f"\nDone! Created 1 policy pack with {len(CONTROLS)} controls.")


if __name__ == "__main__":
    main()
