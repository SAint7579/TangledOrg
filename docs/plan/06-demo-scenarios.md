# Demo Scenarios

Two complete demo walkthroughs: one for GDPR, one for ISO 27001.

---

## Demo 1: GDPR — "Junior Dev Pushes PII-Handling Code"

### Setup

**Organization**: Acme Health — a health-tech startup subject to GDPR

**People** (ATProto identities):

| Person | Role | Handle |
|---|---|---|
| Alice | Org Admin / CTO | `alice.tngl.sh` |
| Bob | Backend Lead, Code Owner for `/api/` | `bob.tngl.sh` |
| Carol | Data Protection Officer (DPO) | `carol.tngl.sh` |
| Dave | Junior Developer | `dave.tngl.sh` |

**Repo**: `acme-health/patient-service`
- Compliance profile: **GDPR** + **ISO 27001** policy packs bound
- Data classification: **Confidential** (PII / Health Data)
- Code owners: Bob owns `/api/**`, Carol must approve any change to `/models/patient*.go`

**Dependency**: `acme-health/billing-service` depends on `patient-service` (API consumer + shared model)

### The PR

Dave opens PR: **"Add patient export endpoint"**

Changes:
- `api/export.go` — new endpoint `GET /patients/export` returning patient records as CSV
- `models/patient.go` — adds `SocialSecurityNumber` field to Patient struct
- `.env.example` — adds `EXPORT_ENCRYPTION_KEY=changeme`
- `go.mod` — adds a CSV library with a known critical CVE

### What the Compliance Agent Does

1. **Diff Analysis** — 4 changed files; `models/patient.go` and `api/export.go` flagged as high-sensitivity
2. **Owner Mapping** — `api/export.go` → Bob; `models/patient.go` → Carol (DPO)
3. **Security Scans**:
   - Gitleaks: `EXPORT_ENCRYPTION_KEY=changeme` in `.env.example`
   - OSV-Scanner: CSV library has CVE-2024-XXXX (critical)
   - Semgrep: export endpoint missing authentication middleware
4. **Dependency Impact** — `billing-service` consumes Patient API and imports Patient model; adding SSN expands PII boundary
5. **Claude Reasoning** — "Under GDPR Article 35, bulk PII export with SSNs may require DPIA. Export lacks encryption, rate limiting, audit logging. SSN field propagates to billing-service."
6. **Merge Gate** → **BLOCKED**

### The Resolution

Dave fixes the PR:
- Removes hardcoded secret
- Upgrades CSV library to patched version
- Adds auth middleware

Agent re-runs → 2 controls now pass. **GDPR-7 still requires Carol's approval.**

Carol reviews, approves → merge gate flips to **PASS**. Dave merges.

Post-merge: issues auto-created in `billing-service` to handle the new SSN field.

---

## Demo 2: ISO 27001 — "Certification Audit Readiness"

### Setup

**Organization**: NovaPay — a fintech company going through ISO 27001 certification

**People**:

| Person | Role | Handle |
|---|---|---|
| Alice | CTO / Org Admin | `alice.tngl.sh` |
| Bob | Backend Lead | `bob.tngl.sh` |
| Eve | ISMS Manager | `eve.tngl.sh` |
| Frank | Security Lead | `frank.tngl.sh` |

**Repos**: 8 repos, all bound to ISO 27001 Base policy pack

**ISO 27001 Base Pack Controls**:

| ID | Control | Type | Enforcement |
|---|---|---|---|
| ACCESS-1 | Repository access must be role-based | organizational | advisory |
| ACCESS-2 | Segregation of duties on merge | gate | hard |
| CHANGE-1 | All changes require PR review | gate | hard |
| CHANGE-2 | PR must be assessed before merge | gate | hard |
| VULN-1 | No critical CVEs in dependencies | scan | hard |
| VULN-2 | No known secrets in code | scan | hard |
| VULN-3 | SAST scan must pass | scan | soft |
| OWN-1 | Changed files must have a designated code owner | organizational | advisory |
| OWN-2 | Code owner must approve changes | approval | hard |
| CLASS-1 | Repo must have a data classification | organizational | advisory |
| DOC-1 | Repo must have a compliance profile | organizational | advisory |
| AUDIT-1 | All agent runs must produce evidence records | system | automatic |

### Screen 1: Dashboard (Auditor View)

The auditor asks: *"Show me your secure development posture."*

```
NovaPay — ISO 27001 Compliance Dashboard

Overall Posture: 91% compliant (11/12 controls passing)

Repos:  8 total │ 6 compliant │ 1 at-risk │ 1 non-compliant
Teams:  3 (backend, frontend, platform)
People: 12 members with documented roles

Control Status:
  ✓ ACCESS-1  Role-based access .............. 8/8 repos
  ✓ ACCESS-2  Segregation of duties .......... enforced
  ✓ CHANGE-1  PR-only workflow ............... enforced
  ✓ CHANGE-2  PR assessment required ......... enforced
  ✗ VULN-1    No critical CVEs ............... 7/8 repos
              └ payments-core has 1 critical CVE (3 days old)
  ✓ VULN-2    No secrets in code ............. 8/8 repos
  ✓ VULN-3    SAST clean .................... 8/8 repos
  ✓ OWN-1     Code owners defined ........... 8/8 repos
  ✓ OWN-2     Owner approval enforced ....... enforced
  ✓ CLASS-1   Data classification set ....... 8/8 repos
  ✓ DOC-1     Compliance profiles exist ..... 8/8 repos
  ✓ AUDIT-1   Evidence for all runs ......... 147 records
```

### Screen 2: Audit Trail (last 30 days)

The auditor asks: *"Show me change management evidence."*

```
47 PRs assessed │ 3 blocked → resolved │ 1 waiver granted │ 0 overrides

Jun 23  payments-core  PR #42  "Update Stripe SDK"
        Risk: MEDIUM │ Gate: pass
        Controls: 12/12 passed │ Approvals: bob, frank
        Evidence: semgrep.json, osv-scan.json, gitleaks.json
        Agent run: 14.2s │ Claude tokens: 2,847

Jun 22  user-service   PR #89  "Add 2FA enrollment"
        Risk: HIGH │ Gate: pass (after 1 re-run)
        Controls: 11/12 passed → 12/12 after fix
        Evidence: semgrep.json (1 finding → fixed), osv-scan.json
        Required approvals: security-team (frank approved)

Jun 20  payments-core  PR #41  "Add crypto payments"
        Risk: HIGH │ Gate: blocked → waiver granted
        Controls: 11/12 passed │ VULN-1 failed (dep CVE, no patch)
        Waiver: granted by eve, expires Jul 20
        Reason: "vendor fix ETA 2 weeks"
```

### Screen 3: Evidence Drill-Down

The auditor asks: *"Show me evidence for PR #89."*

Every record is signed by the author's DID and timestamped:
- `prAssessment` record (signed by agent DID)
- 12x `controlEvaluation` records (individual pass/fail)
- Semgrep JSON report (showing initial finding)
- Gitleaks report (clean)
- OSV-Scanner report (clean)
- Claude reasoning text
- Frank's approval record (signed by `did:plc:frank-did`)
- `mergeGate` record: `pass`

### What the Auditor Sees

| What auditors hate | What Tangled Org shows |
|---|---|
| "We do code reviews" (no proof) | Signed PR assessment records with timestamps |
| "We scan for vulnerabilities" (where?) | `audit.evidence` records with scan JSON |
| "Access is role-based" (show me) | `org.membership` + `org.role` records |
| "We have an approval process" | `requiredApproval` + approval records, cryptographically signed |
| Spreadsheets and screenshots | Live dashboard from immutable ATProto records |
| Point-in-time evidence (scramble before audit) | Continuous, automatic evidence on every PR |
| "Trust us" | Tamper-evident signed records on a decentralized protocol |

---

## Demo 3: Incident Flow — "Data Leak Triggers Cross-Repo Response"

### Setup

Same Acme Health org. A vulnerability is discovered in a package used by `patient-service`.

### Step 1: Issue Raised

Dave opens an issue: *"Critical: csv-lib v1.2.0 has data leak vulnerability (CVE-2024-XXXX)"*

### Step 2: Bot Classifies

The compliance agent picks up the issue and writes:
- `compliance.incident` — severity: critical, category: data-leak, affectedPackage: csv-lib@1.2.0
- `compliance.slaTracker` — deadline: now + 48h, status: open

### Step 3: SLA Clock Starts

Dashboard shows: `🔴 INC-7 patient-service Data leak via csv-lib 48h SLA`

### Step 4: PR Opened

Dave opens PR #90: "Upgrade csv-lib to v1.3.0 (patched)"

Compliance agent runs:
- VULN-1: **pass** (CVE resolved)
- All other controls: pass
- Dependency impact: billing-service uses patient API → **review recommended**
- Required approval: Eve (ISMS Manager) per SLA rule for critical incidents
- Merge gate: **needs-human-review** (waiting for ISMS Manager)

### Step 5: ISMS Manager Approves

Eve reviews the PR, sees the agent's assessment, approves.

Merge gate → **pass**. Dave merges.

### Step 6: Post-Merge Propagation

Agent writes `compliance.propagation`:
- billing-service: issue auto-created → "Upstream dependency patient-service upgraded csv-lib. Review billing-service/client.go for compatibility."
- notification-service: issue auto-created → "Upstream dependency patient-service upgraded csv-lib. Review event consumer for compatibility."

SLA tracker updated: **resolved** (within 48h).

### Step 7: Dashboard Updated

```
INC-7  patient-service  Data leak via csv-lib  RESOLVED ✓
       Resolved in 12h (within 48h SLA)
       Fixed by PR #90, approved by eve.tngl.sh
       Downstream: 2 issues created (billing-service, notification-service)
```
