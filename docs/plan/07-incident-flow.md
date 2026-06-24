# Incident-to-Resolution Lifecycle

This document describes the complete lifecycle of a security incident from detection through resolution, including SLA tracking, ISMS approval, and downstream propagation.

## Overview

```
 ① Issue raised          ② Bot classifies       ③ SLA clock starts
    (data leak)  ──────→    (critical) ──────→     (48h deadline)
                                                        │
 ⑥ Downstream issues     ⑤ PR merged            ④ PR opened + assessed
    auto-created   ←──────  (gate: pass)  ←──────   (ISMS approval required)
    in 2 repos                                      (dependency impact found)
```

## Step 1: Issue Creation

A team member discovers a vulnerability and opens a Tangled issue on the affected repo.

**Trigger**: Manual issue creation or automated alert (from monitoring, bug bounty, CVE feed).

**Record created**:
- `sh.tangled.issue` — the standard Tangled issue record

## Step 2: Bot Classification

The compliance agent (running as a background Spindle job or webhook listener) picks up new issues and classifies them.

**Agent actions**:
1. Reads the issue title and body
2. Calls Claude to classify: severity, category, affected package, related CVEs
3. Writes governance records

**Records created**:
- `governance.compliance.incident` — links to the Tangled issue, adds severity, category, CVEs, affected package
- `governance.compliance.slaTracker` — calculates deadline based on `policy.slaRule` for the matched severity

**Classification logic**:

| Category | Indicators |
|---|---|
| data-leak | mentions "data leak", "data exposure", "PII", "breach" |
| vulnerability | mentions "CVE", "vulnerability", "security flaw" |
| unauthorized-access | mentions "unauthorized", "privilege escalation", "access control" |
| supply-chain | mentions "dependency", "package", "supply chain", "compromised" |
| misconfiguration | mentions "misconfigured", "default credentials", "exposed" |

## Step 3: SLA Tracking

The SLA rule (from the bound policy pack) determines the deadline.

**Example SLA rules** (from ISO 27001 Base Pack):

| Severity | Max Resolution | Required Approver | Escalation |
|---|---|---|---|
| Critical | 48 hours | ISMS Manager | After 24h → CTO |
| High | 7 days | Security Lead | After 3 days → ISMS Manager |
| Medium | 30 days | Repo Admin | After 14 days → Security Lead |
| Low | 90 days | Repo Admin | No escalation |

**SLA statuses**:
- `open` — within SLA, no action yet
- `at-risk` — past escalation threshold but within deadline
- `breached` — past deadline, unresolved
- `resolved` — fixed and verified

**Dashboard display**:
```
🔴 INC-7  patient-service  Data leak via csv-lib     48h SLA (36h remaining)
🟡 INC-6  user-service     Known CVE in auth-dep    7d SLA (5d remaining, at-risk)
```

## Step 4: PR Assessment

When a PR is opened that references or fixes the incident, the compliance agent runs the full assessment flow.

**How the PR is linked to the incident**:
- PR title/body references the issue number
- PR branch name contains the issue ID
- Manual linking via the UI

**Assessment additions for incident-linked PRs**:
- The `prAssessment` record includes the `incident` field (AT-URI of the incident)
- SLA-based controls are evaluated (e.g., "ISMS Manager must approve critical incident fixes")
- Dependency graph is checked for downstream impact

**Records created**:
- All standard PR assessment records (see [04-compliance-agent.md](./04-compliance-agent.md))
- `compliance.requiredApproval` with `approverRole: "isms-manager"` (from SLA rule)
- `compliance.impactAssessment` (if downstream repos affected)

## Step 5: Approval & Merge

### Required Approvals

For a critical incident fix, the SLA rule requires ISMS Manager approval. The `requiredApproval` record is role-based:

```json
{
  "approverRole": "isms-manager",
  "reason": "Critical incident fix requires ISMS Manager approval per SLA rule",
  "policyRef": "at://did:plc:org-did/governance.policy.slaRule/tid-123",
  "status": "pending"
}
```

Any org member with the `isms-manager` role can satisfy this. When they approve:
- The `requiredApproval` record is updated: `status: "approved"`, `approvedBy: "did:plc:eve-did"`
- The `mergeGate` is re-evaluated → if all controls pass, status changes to `pass`

### Merge Gate

The gate aggregates all control evaluations and approval statuses:
- If any hard-enforcement control is still failing → `blocked`
- If any required approval is pending → `needs-human-review`
- If only soft controls have warnings → `warning`
- All clear → `pass`

The gate also includes `postMergeActions`:
```json
{
  "postMergeActions": [
    { "action": "propagate-issues", "targetRepos": ["at://...billing", "at://...notif"], "reason": "Upstream fix affects downstream deps" },
    { "action": "update-sla", "reason": "Mark incident SLA as resolved" }
  ]
}
```

## Step 6: Post-Merge Actions

After the PR is merged, the agent (or a post-merge hook) executes the actions defined in `mergeGate.postMergeActions`.

### Issue Propagation

For each downstream repo identified in the `impactAssessment`:

1. Create a new `sh.tangled.issue` in the downstream repo:
   - Title: "Upstream dependency change: [original issue title]"
   - Body: explains what changed, which files are affected, links to original PR
2. Optionally create a `compliance.incident` for the downstream issue if the impact is severe enough
3. Write a `compliance.propagation` record linking the source PR to all downstream issues

**Example propagation record**:
```json
{
  "sourcePR": "at://did:plc:dave/sh.tangled.pulls.request/tid-pr90",
  "sourceRepo": "at://did:plc:org/sh.tangled.repo/patient-service",
  "incident": "at://did:plc:agent/governance.compliance.incident/tid-inc7",
  "downstreamActions": [
    {
      "repo": "at://did:plc:org/sh.tangled.repo/billing-service",
      "issue": "at://did:plc:agent/sh.tangled.issue/tid-auto1",
      "codeDependency": "at://did:plc:org/governance.graph.codeDependency/tid-edge1",
      "reason": "billing-service/client.go calls patient API endpoint that was modified",
      "severity": "high"
    },
    {
      "repo": "at://did:plc:org/sh.tangled.repo/notification-service",
      "issue": "at://did:plc:agent/sh.tangled.issue/tid-auto2",
      "codeDependency": "at://did:plc:org/governance.graph.codeDependency/tid-edge2",
      "reason": "notification-service consumes patient events; event schema may be affected",
      "severity": "medium"
    }
  ]
}
```

### SLA Resolution

The `slaTracker` record is updated:
```json
{
  "status": "resolved",
  "resolvedAt": "2025-06-24T14:32:00Z",
  "resolvedBy": "did:plc:dave-did"
}
```

## Complete Record Trail

For the full incident lifecycle, these records are created:

```
Issue Raised
  └─ sh.tangled.issue                           (by dave)

Bot Classification
  ├─ governance.compliance.incident              (by agent)
  └─ governance.compliance.slaTracker            (by agent)

PR Assessment
  ├─ governance.audit.agentRun                   (by agent)
  ├─ governance.compliance.prAssessment          (by agent)
  ├─ governance.compliance.controlEvaluation ×N  (by agent)
  ├─ governance.compliance.requiredApproval      (by agent)
  ├─ governance.compliance.impactAssessment      (by agent)
  ├─ governance.audit.evidence ×M                (by agent)
  └─ governance.compliance.mergeGate             (by agent)

Approval
  └─ governance.compliance.requiredApproval      (updated by eve)

Post-Merge
  ├─ governance.compliance.propagation           (by agent)
  ├─ sh.tangled.issue (billing-service)          (by agent)
  ├─ sh.tangled.issue (notification-service)     (by agent)
  └─ governance.compliance.slaTracker            (updated by agent)
```

Every record is signed by the author's DID and timestamped — providing a complete, tamper-evident audit trail from incident detection through resolution and downstream propagation.

## Escalation

If the SLA is approaching breach (past `escalationAfterHours`):

1. The background monitor checks `slaTracker` records periodically
2. If `status` is still `open` and current time > `deadline - escalationAfterHours`:
   - Status changes to `at-risk`
   - Notification sent to the `escalationTarget` role
3. If `status` is still not `resolved` and current time > `deadline`:
   - Status changes to `breached`
   - Notification sent to org admins
   - Dashboard shows red alert
