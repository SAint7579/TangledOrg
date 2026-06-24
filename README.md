# Tangled Org

**Protocol-native organization governance, compliance, and code-safety layer for [Tangled](https://tangled.org).**

Tangled Org is a standalone AppView and compliance engine built on the AT Protocol. It gives regulated software teams organizational structure, policy enforcement, dependency tracking, and audit-ready compliance — all stored as signed, portable ATProto records rather than locked in a proprietary database.

---

## The Problem

Tangled is a decentralized Git collaboration platform with self-hostable Knots (Git hosting), role-based access control, PR workflows, and Spindles (CI pipelines). But it lacks a full organizational governance system.

Regulated teams (fintech, healthcare, government, AI companies) need:

- Who owns which code and who must approve changes
- What compliance rules apply to each repo (ISO 27001, GDPR, EU AI Act)
- Automated policy checks on every pull request
- Audit trails with tamper-evident evidence
- Dependency impact analysis across repos
- Merge enforcement tied to policy outcomes

Tangled Org fills this gap.

---

## How It Works

```
                       ATProto Network (PDSs)
                ┌──────────────────────────────────┐
                │  sh.tangled.repo.*               │  ← repo / PR / issue data
                │  sh.tangled.governance.org.*     │  ← org / team / role records
                │  sh.tangled.governance.compliance.* │  ← repo profiles, assessments
                │  sh.tangled.governance.policy.*  │  ← policy packs, controls
                │  sh.tangled.governance.audit.*   │  ← evidence, waivers, agent runs
                │  sh.tangled.governance.graph.*   │  ← dependency maps
                └───────────────┬──────────────────┘
                                │
                     Jetstream (real-time events)
                                │
           ┌────────────────────┼─────────────────────┐
           ▼                    ▼                      ▼
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
  │  Tangled's      │  │  Tangled Org    │  │  Compliance Agent   │
  │  AppView        │  │  AppView (Go)   │  │  (Python/LangGraph) │
  │  tangled.org    │  │                 │  │                     │
  │                 │  │  Repos + PRs    │  │  Analyzes PRs       │
  │  Shows repos,   │  │  + Compliance   │  │  Runs scans         │
  │  PRs, social    │  │  + Orgs/Teams   │  │  Calls Claude       │
  │                 │  │  + Audit Trail  │  │  Writes assessments  │
  └─────────────────┘  └─────────────────┘  └─────────────────────┘
```

Both Tangled's UI and Tangled Org read from the same ATProto records. Tangled Org adds governance-specific views, dashboards, and enforcement.

---

## Core Concepts

### Organizations, Teams & Ownership

Define your org structure as ATProto records:

- **Organizations** — top-level entity with members, teams, and policies
- **Teams** — groups of people responsible for specific areas (e.g., `@security-team`, `@backend-team`)
- **Roles** — granular permissions: org-admin, repo-admin, policy-author, auditor, contributor
- **Code Owners** — map file paths and directories to responsible teams/individuals (like CODEOWNERS but protocol-native)

### Policy Packs & Controls

Composable, reusable compliance rule sets:

- **Policy Packs** — named bundles of controls (e.g., "GDPR Data Pack", "ISO 27001 Base", "EU AI Act ML Pack")
- **Controls** — individual requirements within a pack (e.g., "No secrets in code", "DPO approval for PII changes", "SAST scan must pass")
- **Repo Bindings** — attach one or more policy packs to a repo, enabling per-repo governance

### Compliance Workflow

When a PR is opened or updated on a governed repo:

1. A **Spindle workflow** triggers the **Compliance Agent**
2. The agent clones the repo, reads the diff, loads the repo's compliance profile and bound policy packs
3. It maps changed files to **code owners** and identifies **downstream dependents**
4. It runs security scans: **SAST** (Semgrep), **secret detection** (Gitleaks), **dependency audit** (OSV-Scanner)
5. It calls **Claude** for policy reasoning — analyzing regulatory implications, risk level, and required approvals
6. It writes structured ATProto records:
   - `compliance.prAssessment` — overall risk level, summary, affected owners
   - `compliance.controlEvaluation` — pass/fail per control
   - `compliance.requiredApproval` — who must approve and why
   - `audit.evidence` — scan results, agent reasoning
   - `compliance.mergeGate` — final verdict: `pass`, `warning`, `needs-human-review`, or `blocked`

### Merge Enforcement

- **Soft enforcement** — the AppView displays warnings, but maintainers can merge
- **Hard enforcement** — a Knot-side hook checks the latest `mergeGate` record and refuses the merge if blocking controls fail

---

## ATProto Lexicon Records

All governance metadata is defined as custom ATProto Lexicons under the `sh.tangled.governance` namespace.

### Organization & Structure

| Record | Purpose |
|---|---|
| `governance.org.organization` | Org definition: name, description, owner DID, settings |
| `governance.org.membership` | Links a DID to an org with a role |
| `governance.org.team` | Named team within an org |
| `governance.org.role` | Role definition with permission set |

### Compliance & Repo Profiles

| Record | Purpose |
|---|---|
| `governance.compliance.repoProfile` | Repo governance metadata: data classification, applicable regulations, risk tier |
| `governance.compliance.codeOwner` | Maps file patterns to responsible teams/DIDs |
| `governance.compliance.prAssessment` | Per-PR risk assessment with summary and affected areas |
| `governance.compliance.controlEvaluation` | Per-control pass/fail result for a PR |
| `governance.compliance.requiredApproval` | Required reviewer with reason and policy reference |
| `governance.compliance.mergeGate` | Final merge verdict: pass / warning / needs-human-review / blocked |

### Policy

| Record | Purpose |
|---|---|
| `governance.policy.policyPack` | Named bundle of controls (e.g., "GDPR Pack") |
| `governance.policy.control` | Single enforceable rule within a pack |
| `governance.policy.repoBinding` | Binds a policy pack to a specific repo |

### Dependency Graph

| Record | Purpose |
|---|---|
| `governance.graph.repoDependency` | Repo A depends on Repo B |
| `governance.graph.serviceDependency` | Repo depends on external service |

### Audit

| Record | Purpose |
|---|---|
| `governance.audit.evidence` | Attached proof: scan results, screenshots, logs |
| `governance.audit.agentRun` | Record of a compliance agent execution |
| `governance.audit.waiver` | Approved exception to a control with expiry and justification |

---

## Tech Stack

### Go — AppView + Merge Hook

| Component | Technology |
|---|---|
| Language | Go 1.24+ |
| Web framework | Chi router + Go templates + HTMX 2.0 |
| Styling | Tailwind CSS |
| Database | SQLite |
| ATProto | bluesky-social/indigo |
| Event stream | Jetstream consumer |
| Auth | ATProto OAuth |
| Build | Nix flakes |

### Python — Compliance Agent

| Component | Technology |
|---|---|
| Language | Python 3.12+ |
| Agent framework | LangGraph |
| AI | Claude API (Anthropic) |
| ATProto | MarshalX/atproto SDK |
| SAST | Semgrep |
| Secret detection | Gitleaks |
| Dependency audit | OSV-Scanner |
| Runs in | Spindle container (Nixery / Docker) |

### Shared

| Component | Technology |
|---|---|
| Lexicon schemas | JSON (ATProto Lexicon v1) |
| Build / dev | Nix flakes |
| Deployment | NixOS modules + Docker Compose |
| CI | Tangled Spindles |

---

## Project Structure

```
TangledOrg/
├── README.md
├── lexicons/                        # ATProto Lexicon schemas (JSON)
│   └── sh/
│       └── tangled/
│           └── governance/
│               ├── org/             # organization, membership, team, role
│               ├── compliance/      # repoProfile, codeOwner, prAssessment,
│               │                    # controlEvaluation, requiredApproval, mergeGate
│               ├── policy/          # policyPack, control, repoBinding
│               ├── graph/           # repoDependency, serviceDependency
│               └── audit/           # evidence, agentRun, waiver
│
├── appview/                         # Go AppView (web UI + API)
│   ├── cmd/                         # Entry point
│   ├── handlers/                    # HTTP handlers
│   ├── templates/                   # Go HTML templates
│   ├── static/                      # CSS, JS, icons
│   ├── models/                      # Generated ATProto record types
│   ├── jetstream/                   # Jetstream event consumer
│   ├── store/                       # SQLite data access layer
│   ├── auth/                        # ATProto OAuth
│   └── go.mod
│
├── agent/                           # Python Compliance Agent
│   ├── tangled_compliance/
│   │   ├── graph.py                 # LangGraph agent definition
│   │   ├── nodes/                   # Agent nodes: diff_analyzer, policy_checker,
│   │   │                            # scanner, owner_mapper, claude_reasoner,
│   │   │                            # record_writer
│   │   ├── tools/                   # Semgrep, Gitleaks, OSV wrappers
│   │   ├── atproto_client.py        # ATProto read/write helpers
│   │   └── config.py                # Environment / settings
│   ├── pyproject.toml
│   └── Dockerfile
│
├── hook/                            # Go merge gate hook (runs on Knot)
│   ├── cmd/
│   ├── gate.go                      # Check mergeGate record before merge
│   └── go.mod
│
├── workflows/                       # Spindle workflow definitions
│   └── compliance.yml               # Triggers compliance agent on PR events
│
├── deploy/
│   ├── docker-compose.yml           # Full-stack local deployment
│   ├── nix/                         # NixOS modules for appview, hook
│   └── spindle/                     # Spindle container config
│
├── docs/
│   ├── architecture.md              # Detailed architecture documentation
│   ├── lexicon-design.md            # Lexicon schema design decisions
│   ├── self-hosting.md              # Deployment guide
│   └── contributing.md              # Contribution guidelines
│
├── flake.nix                        # Nix flake: builds appview, hook, dev shell
└── flake.lock
```

---

## UI Pages

The Tangled Org AppView provides these views:

| Page | Description |
|---|---|
| **Dashboard** | Org-wide compliance posture, risk heatmap, recent activity feed |
| **Repos** | All org repos with compliance status badges (compliant / at-risk / non-compliant) |
| **Repo Detail** | Code browser, branches, commits + compliance profile, bound policies, code owners |
| **Pull Request** | Diff view, comments + compliance panel: risk level, control results, required approvals, evidence, Claude reasoning, merge gate status |
| **Organization** | Teams, members, roles, invite management |
| **Policies** | Policy pack browser, control editor, repo binding management |
| **Audit Log** | Filterable, exportable log of every assessment, waiver, evidence record, agent run |
| **Dependency Map** | Visual graph of repo-to-repo and repo-to-service dependencies |
| **People** | Who owns what, responsibility matrix, approval history |

---

## Compliance Agent Flow

```
PR Opened / Updated
        │
        ▼
┌─────────────────┐
│  Clone & Diff    │  Read repo, compute changed files
└────────┬────────┘
         ▼
┌─────────────────┐
│  Load Profile    │  Read repoProfile, bound policyPacks, codeOwners from PDS
└────────┬────────┘
         ▼
┌─────────────────┐
│  Map Owners      │  Match changed files → responsible teams/people
└────────┬────────┘
         ▼
┌─────────────────┐
│  Run Scans       │  Semgrep (SAST), Gitleaks (secrets), OSV-Scanner (deps)
└────────┬────────┘
         ▼
┌─────────────────┐
│  Check Deps      │  Identify downstream repos/services impacted by changes
└────────┬────────┘
         ▼
┌─────────────────┐
│  Claude Reason   │  Send diff + profile + scan results + policies to Claude
│                  │  Get: risk assessment, control evaluations, required approvals
└────────┬────────┘
         ▼
┌─────────────────┐
│  Write Records   │  Publish prAssessment, controlEvaluation, requiredApproval,
│                  │  evidence, mergeGate records to ATProto
└─────────────────┘
```

---

## Enforcement Modes

| Mode | Behavior | Use Case |
|---|---|---|
| **Advisory** | Compliance panel shows results; no merge blocking | Teams onboarding to compliance |
| **Soft Enforce** | Warnings displayed; merge allowed with override | Internal projects with moderate risk |
| **Hard Enforce** | Knot-side hook blocks merge on `blocked` gate status | Regulated repos, production services |

---

## Regulatory Frameworks Supported

Tangled Org ships with starter policy packs for:

- **ISO 27001** — Information security management controls
- **GDPR** — Data protection and privacy requirements
- **EU AI Act** — AI system risk classification and transparency
- **SOC 2** — Service organization controls for SaaS
- **Custom** — Define your own controls for internal standards

---

## Development

### Prerequisites

- [Nix](https://nixos.org/download) with flakes enabled
- An ATProto account (Bluesky or Tangled)
- Anthropic API key (for Claude)

### Quick Start

```bash
# Clone
git clone https://github.com/YOUR_ORG/TangledOrg.git
cd TangledOrg

# Enter dev shell (installs Go, Python, tools)
nix develop

# Start the AppView (with live reload)
cd appview && go run ./cmd/appview

# Start the compliance agent (for local testing)
cd agent && python -m tangled_compliance

# Run tests
go test ./...
cd agent && pytest
```

### Environment Variables

```bash
# ATProto
TANGLED_ORG_PDS_HOST=https://bsky.social     # or your PDS
TANGLED_ORG_DID=did:plc:your-did-here
TANGLED_ORG_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Claude
ANTHROPIC_API_KEY=sk-ant-...

# AppView
TANGLED_ORG_PORT=8080
TANGLED_ORG_DB_PATH=./data/tangledorg.db
TANGLED_ORG_JETSTREAM_URL=wss://jetstream2.us-east.bsky.network/subscribe

# Merge Hook
TANGLED_ORG_KNOT_HOST=knot1.tangled.sh
```

---

## Roadmap

### Phase 1 — Foundation
- [ ] Define all ATProto Lexicon schemas
- [ ] Go AppView scaffold with ATProto OAuth login
- [ ] Jetstream consumer for governance records
- [ ] SQLite store for indexed records
- [ ] Basic UI: org dashboard, repo list, PR view

### Phase 2 — Compliance Agent
- [ ] Python LangGraph agent scaffold
- [ ] Diff analysis and file-to-owner mapping
- [ ] Semgrep, Gitleaks, OSV-Scanner integration
- [ ] Claude-based policy reasoning
- [ ] ATProto record writer (prAssessment, mergeGate, etc.)
- [ ] Spindle workflow definition

### Phase 3 — Enforcement & UI
- [ ] Knot-side merge gate hook
- [ ] PR compliance panel in AppView
- [ ] Policy pack management UI
- [ ] Audit log with filtering and export
- [ ] Dependency graph visualization

### Phase 4 — Production Readiness
- [ ] Starter policy packs (ISO 27001, GDPR, EU AI Act)
- [ ] Docker Compose deployment
- [ ] NixOS modules
- [ ] Documentation site
- [ ] Security hardening and rate limiting

---

## Why ATProto?

Traditional compliance tools store governance data in a proprietary database owned by the vendor. Tangled Org stores everything as **signed ATProto records** on the user's PDS:

- **Portable** — switch PDS providers; your governance data follows your identity
- **Auditable** — every record is signed by the author's DID, timestamped, and immutable
- **Interoperable** — any ATProto AppView can read and display governance records
- **Decentralized** — no single platform owns your compliance posture
- **Tamper-evident** — signed records provide cryptographic proof of who wrote what and when

---

## License

MIT
