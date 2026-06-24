# Roadmap

Phased implementation plan from foundation to production readiness.

---

## Phase 1 — Foundation

**Goal**: Core data model and project scaffolding. Everything else builds on this.

**Duration**: ~2 weeks

### Tasks

- [ ] Define all ATProto Lexicon schemas (24 record types)
  - Organization: org.organization, org.membership, org.team, org.role
  - Compliance: repoProfile, codeOwner, incident, slaTracker, prAssessment, controlEvaluation, requiredApproval, mergeGate, impactAssessment, propagation
  - Policy: policyPack, control, repoBinding, slaRule
  - Graph: repoDependency, serviceDependency, codeDependency
  - Audit: evidence, agentRun, waiver
- [ ] Go AppView scaffold
  - Project structure (cmd, handlers, templates, static, models, store)
  - Chi router setup
  - SQLite database with migrations
  - ATProto OAuth login flow
  - Jetstream consumer (subscribe to governance records)
- [ ] Python agent scaffold
  - Project structure (tangled_compliance package)
  - LangGraph graph definition with placeholder nodes
  - ATProto client wrapper (MarshalX/atproto)
  - Docker/Nixery container setup
- [ ] Go codegen from lexicons (using lexgen or manual struct generation)
- [ ] Python Pydantic models from lexicons

### Deliverable

Both projects run locally. You can authenticate via ATProto and the agent container builds and starts (but doesn't do anything useful yet).

---

## Phase 2 — Compliance Agent

**Goal**: The agent can analyze a PR and produce structured compliance records.

**Duration**: ~3 weeks

### Tasks

- [ ] `clone_diff` node — clone repo, compute diff, list changed files
- [ ] `load_profile` node — read repoProfile, policyPacks, controls, codeOwners from ATProto
- [ ] `map_owners` node — match changed files to code owner patterns
- [ ] `run_scans` node — Semgrep, Gitleaks, OSV-Scanner integration
  - Semgrep: install, run, parse JSON output
  - Gitleaks: install, run, parse JSON output
  - OSV-Scanner: install, run, parse JSON output
- [ ] `check_deps` node — walk codeDependency graph, identify downstream impact
- [ ] `claude_reason` node — build prompt, call Claude API, parse structured response
- [ ] `decide_gate` node — aggregate control evaluations into merge gate verdict
- [ ] `write_records` node — write all ATProto records (prAssessment, controlEvaluation, requiredApproval, impactAssessment, evidence, agentRun, mergeGate)
- [ ] Spindle workflow YAML definition
- [ ] End-to-end test: trigger agent on a test PR, verify records are written

### Deliverable

The agent runs in a Spindle container, analyzes a PR, and writes a full set of compliance records to ATProto.

---

## Phase 3 — Enforcement & Core UI

**Goal**: The AppView renders compliance data and the merge hook enforces it.

**Duration**: ~3 weeks

### Tasks

- [ ] Knot-side merge gate hook
  - Query latest mergeGate record for a PR via XRPC
  - Block merge if status is "blocked" (hard enforcement)
  - Allow with warning if "warning" (soft enforcement)
- [ ] AppView UI pages
  - Dashboard (org-wide compliance posture, risk heatmap)
  - Repo list with compliance badges
  - Repo detail with compliance profile
  - PR compliance panel (controls, approvals, evidence, AI summary)
  - Organization page (teams, members, roles)
  - Policy pack browser
  - Audit log with filtering
- [ ] Policy management UI
  - Create/edit policy packs
  - Add/edit controls within a pack
  - Bind packs to repos with per-repo overrides
  - SLA rule configuration
- [ ] Code ownership UI
  - Add/edit/delete code owner patterns per repo
- [ ] Approval flow
  - Show pending approvals to the right people
  - Allow role-based approval (any ISMS manager can approve)
  - Update requiredApproval records on approval/rejection
- [ ] Incident classification bot
  - Background Spindle job or webhook listener
  - Classify new issues, create incident + slaTracker records
- [ ] HTMX interactivity (dynamic updates without full page reloads)

### Deliverable

A working AppView with compliance panels in PRs, policy management, and merge enforcement. The full workflow from PR → assessment → approval → merge works end-to-end.

---

## Phase 4 — Advanced Features

**Goal**: Incident flow, dependency graph, downstream propagation.

**Duration**: ~2 weeks

### Tasks

- [ ] Incident tracker UI page
  - List incidents with SLA status
  - Drill-down to incident detail
  - Link incidents to PRs
- [ ] SLA monitoring
  - Background job to check slaTracker deadlines
  - Update status to at-risk/breached
  - Send notifications on escalation
- [ ] Dependency graph UI
  - Per-repo dependency view (upstream/downstream)
  - Org-wide dependency visualization
  - Add/edit/delete code dependency edges
- [ ] Post-merge propagation
  - Auto-create issues in downstream repos
  - Write propagation records
  - Update SLA tracker on resolution
- [ ] Waiver management
  - Grant waivers with expiry and justification
  - Waiver approval workflow (require second approver for critical)
  - Auto-expire waivers

### Deliverable

Full incident lifecycle works. Dependency graph is visible and used by the agent. Downstream propagation creates issues automatically.

---

## Phase 5 — Production Readiness

**Goal**: Deployable, documented, secure product.

**Duration**: ~2 weeks

### Tasks

- [ ] Starter policy packs
  - ISO 27001 Base (12 controls)
  - GDPR Data Pack (8 controls)
  - EU AI Act ML Pack (6 controls)
  - SOC 2 Base Pack
- [ ] Deployment
  - Docker Compose for full-stack local deployment
  - NixOS modules for appview and merge hook
  - Container image for compliance agent
  - Environment variable documentation
- [ ] Security hardening
  - Rate limiting on API endpoints
  - Input validation on all user inputs
  - CSRF protection
  - Content Security Policy headers
- [ ] Documentation
  - Self-hosting guide
  - Policy authoring guide
  - API reference
  - Contributing guide
- [ ] Testing
  - Go unit tests for handlers and business logic
  - Python unit tests for each agent node
  - Integration tests with test PDS
  - Claude response fixtures for deterministic tests
- [ ] Monitoring
  - Health check endpoints
  - Agent run metrics (duration, token usage, error rate)
  - SLA breach alerts

### Deliverable

Production-ready product that can be deployed by any organization using Tangled.

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|---|---|---|
| 1. Foundation | ~2 weeks | Lexicons + project scaffolds |
| 2. Compliance Agent | ~3 weeks | Working PR analysis agent |
| 3. Enforcement & UI | ~3 weeks | AppView + merge enforcement |
| 4. Advanced Features | ~2 weeks | Incidents, deps, propagation |
| 5. Production | ~2 weeks | Deployment, docs, starter packs |
| **Total** | **~12 weeks** | |

---

## What to Build for Demos

For each demo scenario (see [06-demo-scenarios.md](./06-demo-scenarios.md)), we need:

### GDPR Demo
- 1 org with 4 members (Alice, Bob, Carol, Dave)
- 2 repos (patient-service, billing-service)
- GDPR + ISO 27001 packs bound
- Code owner rules configured
- 1 code dependency edge (billing → patient)
- 1 PR with intentional issues (secret, CVE, PII change)

### ISO 27001 Audit Demo
- 1 org with 12 members
- 8 repos with compliance profiles
- ISO 27001 Base pack bound to all repos
- 30 days of assessment history (seeded data)
- 1 active waiver
- Dashboard + audit log views

### Incident Flow Demo
- Same org as GDPR demo
- 1 critical incident (data leak)
- SLA tracking with 48h deadline
- PR fix with ISMS Manager approval
- Post-merge downstream issue propagation
