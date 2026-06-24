# UI Pages & Rule Definition

The Tangled Org AppView is a server-rendered web application (Go templates + HTMX + Tailwind CSS) that provides the full governance experience.

## Page Map

```
/                                Dashboard (org-wide compliance posture)
/repos                           Repo list with compliance badges
/repos/:owner/:name              Repo detail (code + compliance profile)
/repos/:owner/:name/pulls/:id    PR detail (diff + compliance panel)
/repos/:owner/:name/settings     Repo governance settings
/repos/:owner/:name/owners       Code ownership configuration
/repos/:owner/:name/deps         Dependency graph for this repo
/org                              Organization overview
/org/members                      Member management
/org/teams                        Team management
/org/roles                        Role definitions
/policies                         Policy pack browser
/policies/:id                     Policy pack detail (controls list)
/policies/:id/edit                Policy pack editor
/policies/new                     Create new policy pack
/audit                            Audit log (filterable, exportable)
/audit/:id                        Audit record detail
/incidents                        Incident tracker
/incidents/:id                    Incident detail with SLA status
/graph                            Organization-wide dependency graph
/settings                         Org-level settings
```

---

## Rule Definition Pages

These are the key pages where org admins and policy authors configure governance rules.

### Organization-Level Rules (`/policies`)

This is the "rule library" — reusable policy packs that can be bound to any repo.

#### Policy Pack Browser

```
┌─────────────────────────────────────────────────────────────────────┐
│  Policies                                              [+ New Pack] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Starter Packs ──────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │  │
│  │  │ ISO 27001 Base   │  │ GDPR Data Pack   │  │ EU AI Act  │ │  │
│  │  │ 12 controls      │  │ 8 controls       │  │ 6 controls │ │  │
│  │  │ v1.0             │  │ v1.0             │  │ v1.0       │ │  │
│  │  │ Bound to: 6 repos│  │ Bound to: 3 repos│  │ Bound: 1   │ │  │
│  │  └──────────────────┘  └──────────────────┘  └────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Custom Packs ───────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │  │
│  │  │ Internal Security│  │ Data Team Rules  │                  │  │
│  │  │ 5 controls       │  │ 3 controls       │                  │  │
│  │  │ v2.1             │  │ v1.0             │                  │  │
│  │  │ Bound to: 8 repos│  │ Bound to: 2 repos│                  │  │
│  │  └──────────────────┘  └──────────────────┘                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Policy Pack Editor (`/policies/:id/edit`)

Where you define or edit individual controls within a pack.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ISO 27001 Base Pack                              [Save] [Publish] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Name:        ISO 27001 Base                                        │
│  Framework:   [ISO 27001 ▾]                                         │
│  Version:     1.0                                                   │
│  Description: Core information security controls derived from       │
│               ISO/IEC 27001:2022 Annex A                            │
│                                                                     │
│  ── SLA Rules ─────────────────────────────────────── [+ Add SLA]  │
│  │ Critical │ 48 hours  │ Approver: isms-manager │ Escalate: 24h │ │
│  │ High     │ 7 days    │ Approver: security-lead│ Escalate: 3d  │ │
│  │ Medium   │ 30 days   │ Approver: repo-admin   │ Escalate: 14d │ │
│  │ Low      │ 90 days   │ Approver: repo-admin   │ No escalation │ │
│                                                                     │
│  ── Controls ──────────────────────────────────── [+ Add Control]  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ACCESS-1: Repository access must be role-based              │   │
│  │ ISO Ref: A.5.15, A.8.3                                     │   │
│  │ Type: [organizational ▾]   Enforcement: [advisory ▾]       │   │
│  │ Description: All repo members must have explicit            │   │
│  │ org.membership and org.role records.                        │   │
│  │                                                [Edit] [⋮]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ACCESS-2: Segregation of duties on merge                    │   │
│  │ ISO Ref: A.5.3                                              │   │
│  │ Type: [gate ▾]             Enforcement: [hard ▾]            │   │
│  │ Description: PR author cannot be the same person who        │   │
│  │ approves the merge. At least 1 approval from a different    │   │
│  │ person is required.                                         │   │
│  │                                                [Edit] [⋮]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ VULN-1: No critical CVEs in dependencies                    │   │
│  │ ISO Ref: A.8.8                                              │   │
│  │ Type: [scan ▾]             Enforcement: [hard ▾]            │   │
│  │ Scan Tool: [osv-scanner ▾] Threshold: [critical ▾]         │   │
│  │ Description: OSV-Scanner must find 0 critical-severity      │   │
│  │ CVEs in dependencies.                                       │   │
│  │                                                [Edit] [⋮]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ VULN-2: No secrets in source code                           │   │
│  │ ISO Ref: A.8.4                                              │   │
│  │ Type: [scan ▾]             Enforcement: [hard ▾]            │   │
│  │ Scan Tool: [gitleaks ▾]    Threshold: [low ▾]               │   │
│  │                                                [Edit] [⋮]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ OWN-2: Code owner must approve changes                      │   │
│  │ ISO Ref: A.8.32                                             │   │
│  │ Type: [approval ▾]         Enforcement: [hard ▾]            │   │
│  │ Required Approver Role: [code-owner (matched) ▾]            │   │
│  │                                                [Edit] [⋮]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ... (7 more controls)                                              │
│                                                                     │
│  ── Bound Repos ──────────────────────────────────── [+ Bind Repo] │
│  │ patient-service   │ Hard enforce  │ All controls │ Bound Jun 1  │
│  │ billing-service   │ Hard enforce  │ All controls │ Bound Jun 1  │
│  │ user-service      │ Soft enforce  │ 10/12 ctrls  │ Bound Jun 5  │
│  │ frontend-app      │ Advisory      │ 8/12 ctrls   │ Bound Jun 10 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Control Editor Modal (when clicking [Edit] on a control)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Edit Control                                      [Save] [Cancel] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Control ID:    VULN-1                                              │
│  Name:          No critical CVEs in dependencies                    │
│  ISO Reference: A.8.8                                               │
│                                                                     │
│  Type:                                                              │
│  ○ gate          — blocks merge if failed                           │
│  ○ scan          — runs a scanning tool                             │
│  ○ approval      — requires specific role/person approval           │
│  ○ organizational — checks org-level requirements                   │
│  ● (selected: scan)                                                 │
│                                                                     │
│  ── Scan Configuration ──────────────────────────────────────────   │
│  Scan Tool:      [osv-scanner ▾]                                    │
│  Severity Threshold: [critical ▾]                                   │
│  (Findings at or above this severity trigger failure)               │
│                                                                     │
│  ── Enforcement ─────────────────────────────────────────────────   │
│  ○ Advisory  — show result, no blocking                             │
│  ● Hard      — block merge on failure                               │
│  ○ Soft      — warn but allow merge                                 │
│                                                                     │
│  ── Description ─────────────────────────────────────────────────   │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ OSV-Scanner must find 0 critical-severity CVEs in             │ │
│  │ dependencies. High-severity CVEs generate a warning.          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ── Auto-Remediation Hint ───────────────────────────────────────   │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Upgrade the affected dependency to the patched version.       │ │
│  │ If no patch exists, request a waiver with justification.      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Repo-Level Rules (`/repos/:owner/:name/settings`)

Where you configure governance for a specific repo.

#### Repo Governance Settings

```
┌─────────────────────────────────────────────────────────────────────┐
│  patient-service — Governance Settings                     [Save]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ── Compliance Profile ──────────────────────────────────────────   │
│                                                                     │
│  Data Classification:  [Confidential ▾]                             │
│                        public | internal | confidential | restricted│
│                                                                     │
│  Data Types Handled:   [✓] PII  [✓] PHI  [ ] Financial             │
│                        [ ] Credentials  [ ] ML Training Data        │
│                                                                     │
│  Applicable Regulations:  [✓] ISO 27001  [✓] GDPR  [ ] EU AI Act  │
│                           [ ] SOC 2  [ ] HIPAA  [ ] PCI-DSS        │
│                                                                     │
│  Risk Tier:            [High ▾]                                     │
│                        critical | high | medium | low               │
│                                                                     │
│  Enforcement Mode:     [Hard ▾]                                     │
│                        advisory | soft | hard                       │
│                                                                     │
│  Description:                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Core patient data service. Handles PHI and PII including      │ │
│  │ names, SSNs, medical records. Subject to GDPR and ISO 27001. │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ── Bound Policy Packs ──────────────────────────── [+ Bind Pack]  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ISO 27001 Base                                              │   │
│  │ 12 controls │ Enforcement: hard (inherits from repo)        │   │
│  │ All controls enabled                                        │   │
│  │                              [Configure] [Unbind]           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ GDPR Data Pack                                              │   │
│  │ 8 controls │ Enforcement: hard                              │   │
│  │ 7/8 controls enabled (GDPR-6 disabled: not applicable)     │   │
│  │                              [Configure] [Unbind]           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ── Bind Pack Configuration (when clicking [Configure]) ─────────  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ GDPR Data Pack — Binding for patient-service                │   │
│  │                                                             │   │
│  │ Enforcement Override: [Use repo default (hard) ▾]           │   │
│  │                                                             │   │
│  │ Controls:                                                   │   │
│  │ [✓] GDPR-1: Data processing has legal basis                │   │
│  │ [✓] GDPR-2: Data minimization verified                     │   │
│  │ [✓] GDPR-3: Consent mechanism present                      │   │
│  │ [✓] GDPR-4: Right to deletion supported                    │   │
│  │ [✓] GDPR-5: Data breach notification process               │   │
│  │ [ ] GDPR-6: Cross-border transfer controls (N/A)           │   │
│  │ [✓] GDPR-7: PII changes require DPO approval               │   │
│  │ [✓] GDPR-8: Privacy impact assessment for new processing   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Code Ownership Page (`/repos/:owner/:name/owners`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  patient-service — Code Owners                     [+ Add Pattern] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pattern              │ Owner           │ Approval │ Added          │
│  ─────────────────────┼─────────────────┼──────────┼──────────────  │
│  *                    │ @backend-team   │ Required │ Jun 1          │
│  api/**               │ bob.tngl.sh     │ Required │ Jun 1          │
│  models/patient*.go   │ carol.tngl.sh   │ Required │ Jun 1          │
│  │                    │ (DPO)           │          │                │
│  db/migrations/**     │ @backend-team   │ Required │ Jun 5          │
│  docs/**              │ @backend-team   │ Optional │ Jun 5          │
│  .tangled/**          │ alice.tngl.sh   │ Required │ Jun 1          │
│                                                                     │
│  ── Add Pattern ─────────────────────────────────────────────────   │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ File Pattern:  [                                           ]  │ │
│  │                e.g. api/**, models/*.go, *.proto              │ │
│  │                                                               │ │
│  │ Owner:  ○ Person  [                        ] (DID/handle)    │ │
│  │         ● Team    [@backend-team           ▾]                │ │
│  │                                                               │ │
│  │ Approval: [✓] Required for merge                             │ │
│  │                                                               │ │
│  │ Description: [                                             ]  │ │
│  │                                            [Add] [Cancel]    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Dependency Graph Page (`/repos/:owner/:name/deps`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  patient-service — Dependencies                    [+ Add Edge]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ── Depends On (upstream) ───────────────────────────────────────   │
│  │ auth-service       │ api-call  │ api/auth/client.go →          │
│  │                    │           │ auth-service/api/verify.go     │
│                                                                     │
│  ── Depended On By (downstream) ─────────────────────────────────   │
│  │ billing-service    │ api-call      │ billing/client.go →       │
│  │                    │               │ api/patients/handler.go   │
│  │ billing-service    │ shared-model  │ billing/models/invoice.go →│
│  │                    │               │ models/patient.go         │
│  │ notification-svc   │ event-consumer│ notif/consumers/patient →  │
│  │                    │               │ events/publisher.go       │
│                                                                     │
│  ── Visual Graph ────────────────────────────────────────────────   │
│                                                                     │
│   ┌──────────┐      ┌──────────────────┐      ┌───────────────┐   │
│   │  auth-   │─────→│  patient-service │─────→│  billing-     │   │
│   │  service │      │  ★ (this repo)   │      │  service      │   │
│   └──────────┘      └────────┬─────────┘      └───────────────┘   │
│                              │                                      │
│                              └────────────────→┌───────────────┐   │
│                                                │  notification │   │
│                                                │  service      │   │
│                                                └───────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PR Compliance Panel (`/repos/:owner/:name/pulls/:id`)

This is rendered inline within the PR detail page, below the diff.

```
┌─────────────────────────────────────────────────────────────────────┐
│  PR #42: Add patient export endpoint                                │
│  by dave.tngl.sh → main                                            │
├─────────────────────────────────────────────────────────────────────┤
│  [Diff] [Commits] [Compliance]                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ── Compliance Assessment ───────────────────────────────────────   │
│                                                                     │
│  Status:   🔴 BLOCKED                                               │
│  Risk:     HIGH                                                     │
│  Agent:    v0.1.0 • ran 14.2s • 2,847 Claude tokens                │
│                                                                     │
│  ── Controls (9 passed, 3 failed) ───────────────────────────────   │
│  ✗ GDPR-7    PII changes require DPO approval                      │
│              carol.tngl.sh must approve (pending)                   │
│  ✗ VULN-1    No critical CVEs in dependencies                      │
│              csv-lib v1.2.0 has CVE-2024-XXXX (critical)            │
│  ✗ VULN-2    No secrets in code                                     │
│              .env.example line 3: potential secret detected          │
│  ✓ ACCESS-2  Segregation of duties                                  │
│  ✓ CHANGE-1  PR-only workflow                                       │
│  ✓ CHANGE-2  PR assessed                                            │
│  ✓ VULN-3    SAST clean (2 info-level, 0 high)                     │
│  ✓ OWN-1     Code owners defined                                   │
│  ✓ OWN-2     Owner approval: bob.tngl.sh (pending)                 │
│  ✓ CLASS-1   Data classification set                                │
│  ✓ DOC-1     Compliance profile exists                              │
│  ✓ AUDIT-1   Evidence recorded                                      │
│                                                                     │
│  ── Required Approvals ──────────────────────────────────────────   │
│  ○ bob.tngl.sh     — code owner for api/** (OWN-2)                 │
│  ○ carol.tngl.sh   — DPO review for PII model changes (GDPR-7)    │
│                                                                     │
│  ── Dependency Impact ───────────────────────────────────────────   │
│  ⚠ billing-service/client.go calls patient API                     │
│    Adding SSN to Patient model expands PII boundary                 │
│  ⚠ billing-service/models/invoice.go imports Patient model         │
│    Needs update to handle new SSN field                             │
│  → 2 downstream issues will be created on merge                     │
│                                                                     │
│  ── Evidence ────────────────────────────────────────────────────   │
│  📎 Semgrep report (2 findings)                [View]              │
│  📎 Gitleaks report (1 finding)                [View]              │
│  📎 OSV-Scanner report (1 CVE)                 [View]              │
│  📎 Claude reasoning                           [View]              │
│                                                                     │
│  ── AI Summary ──────────────────────────────────────────────────   │
│  "This PR introduces a bulk PII export endpoint with health data.  │
│   Three blocking issues: (1) DPO approval required for PII model   │
│   changes under GDPR-7, (2) a critical CVE in csv-lib v1.2.0,     │
│   (3) a potential secret in .env.example. Additionally, the SSN    │
│   field propagates to billing-service via shared model and API     │
│   call, expanding PII exposure beyond this repo."                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Dashboard (`/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Acme Health — Compliance Dashboard                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  8 repos    │  │  91%        │  │  47 PRs     │  │  1 SLA    │ │
│  │  governed   │  │  compliant  │  │  assessed   │  │  at risk  │ │
│  │             │  │  (30 days)  │  │  (30 days)  │  │           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │
│                                                                     │
│  ── Repo Status ─────────────────────────────────────────────────   │
│  ✓ patient-service      High    ISO+GDPR    Compliant              │
│  ✓ billing-service      High    ISO         Compliant              │
│  ⚠ user-service         Medium  ISO         At Risk (1 CVE)       │
│  ✓ auth-service          High    ISO         Compliant              │
│  ✓ notification-service  Medium  ISO         Compliant              │
│  ✓ frontend-app          Low     ISO         Compliant              │
│  ✗ analytics-pipeline    Medium  ISO+EUAI    Non-Compliant         │
│  ✓ docs-site             Low     —           No policies bound     │
│                                                                     │
│  ── Open Incidents ──────────────────────────────────────────────   │
│  🔴 INC-7  patient-service  Data leak via csv-lib     48h SLA      │
│     Status: PR open, 36h remaining                                  │
│  🟡 INC-6  user-service     Known CVE in auth-dep    7d SLA       │
│     Status: Investigating, 5d remaining                             │
│                                                                     │
│  ── Recent Activity ─────────────────────────────────────────────   │
│  Jun 23  billing-service  PR #42 assessed → pass                    │
│  Jun 23  patient-service  PR #89 assessed → blocked                 │
│  Jun 22  user-service     Waiver granted for VULN-1 (expires Jul)  │
│  Jun 22  analytics-pipe   Compliance profile missing (flagged)      │
│  Jun 21  patient-service  New code owner added: carol.tngl.sh      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Incident Tracker (`/incidents`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Incidents                                                          │
├─────────────────────────────────────────────────────────────────────┤
│  [All] [Open] [At Risk] [Breached] [Resolved]                      │
│                                                                     │
│  ID     │ Repo              │ Category     │ Severity │ SLA        │
│  ───────┼───────────────────┼──────────────┼──────────┼──────────  │
│  INC-7  │ patient-service   │ Data leak    │ CRITICAL │ 36h left   │
│         │ Linked PR: #89    │ csv-lib      │          │ 🔴         │
│  INC-6  │ user-service      │ Vulnerability│ HIGH     │ 5d left    │
│         │ No PR yet         │ auth-dep     │          │ 🟡         │
│  INC-5  │ billing-service   │ Supply chain │ MEDIUM   │ Resolved   │
│         │ Fixed in PR #38   │ lodash       │          │ ✓ Jun 20   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Audit Log (`/audit`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Audit Log                                     [Export CSV] [Filter]│
├─────────────────────────────────────────────────────────────────────┤
│  Filter: [All Types ▾] [All Repos ▾] [Last 30 days ▾] [Search...] │
│                                                                     │
│  Jun 24 14:32  AGENT_RUN     patient-service  PR #89               │
│                Agent v0.1.0, 14.2s, 2847 tokens, 7 records written │
│                                                                     │
│  Jun 24 14:32  PR_ASSESSMENT patient-service  PR #89               │
│                Risk: HIGH, 9/12 controls passed, 3 failed           │
│                Signed by: did:plc:agent-did                         │
│                                                                     │
│  Jun 24 14:32  MERGE_GATE    patient-service  PR #89               │
│                Status: BLOCKED, 3 blocking controls                 │
│                                                                     │
│  Jun 23 10:15  WAIVER        user-service     Control: VULN-1      │
│                Granted by alice.tngl.sh, expires Jul 23             │
│                Reason: "No patch available, vendor ETA 2 weeks"     │
│                Signed by: did:plc:alice-did                         │
│                                                                     │
│  Jun 23 09:00  APPROVAL      billing-service  PR #42               │
│                bob.tngl.sh approved (code owner, OWN-2)             │
│                Signed by: did:plc:bob-did                           │
│                                                                     │
│  ... (paginated)                                                    │
│                                                                     │
│  Showing 1-20 of 147 records                    [← Prev] [Next →] │
└─────────────────────────────────────────────────────────────────────┘
```
