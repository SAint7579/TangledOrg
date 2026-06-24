# Architecture

## High-Level Architecture

```
                       ATProto Network (PDSs)
                ┌──────────────────────────────────┐
                │  sh.tangled.repo.*               │  repo / PR / issue data
                │  sh.tangled.governance.org.*     │  org / team / role records
                │  sh.tangled.governance.compliance.* │  repo profiles, assessments
                │  sh.tangled.governance.policy.*  │  policy packs, controls, SLAs
                │  sh.tangled.governance.audit.*   │  evidence, waivers, agent runs
                │  sh.tangled.governance.graph.*   │  dependency edges
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

## Component Breakdown

### 1. ATProto Lexicon Schemas (JSON)

Record type definitions that describe the shape of governance data. Published under the `sh.tangled.governance` namespace. Shared between the Go AppView and Python agent.

- Location: `lexicons/sh/tangled/governance/`
- No runtime — just schema definitions
- Used by codegen tools to produce Go structs and Python models

### 2. Tangled Org AppView (Go)

A standalone web application that:

- **Indexes** ATProto records by subscribing to Jetstream
- **Stores** them locally in SQLite for fast querying
- **Renders** the web UI with Go templates + HTMX
- **Handles** ATProto OAuth login
- **Writes** governance records back to the user's PDS (org creation, policy binding, etc.)

```
AppView Internal Architecture
┌─────────────────────────────────────────────┐
│  HTTP Server (Chi router)                    │
│  ├── handlers/          Route handlers       │
│  ├── templates/         Go HTML templates    │
│  └── static/            CSS, JS, icons       │
├─────────────────────────────────────────────┤
│  Business Logic                              │
│  ├── auth/              ATProto OAuth        │
│  ├── models/            Generated record     │
│  │                      types from lexicons  │
│  └── services/          Org, policy, audit   │
│                         business logic       │
├─────────────────────────────────────────────┤
│  Data Layer                                  │
│  ├── store/             SQLite data access   │
│  ├── jetstream/         Event consumer       │
│  └── atproto/           PDS client (indigo)  │
└─────────────────────────────────────────────┘
```

### 3. Compliance Agent (Python)

A LangGraph-based agent that runs inside Spindle containers. Triggered on PR events.

```
Agent Node Graph
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Clone   │───→│  Load    │───→│   Map    │───→│   Run    │
│  & Diff  │    │  Profile │    │  Owners  │    │  Scans   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
┌──────────┐    ┌──────────┐    ┌──────────┐          ▼
│  Write   │←───│  Decide  │←───│  Claude  │←───┌──────────┐
│  Records │    │  Gate    │    │  Reason  │    │  Check   │
└──────────┘    └──────────┘    └──────────┘    │  Deps    │
                                                └──────────┘
```

See [04-compliance-agent.md](./04-compliance-agent.md) for full design.

### 4. Merge Gate Hook (Go)

A small binary that runs on the Knot (Git server). Before allowing a merge:

1. Queries the latest `compliance.mergeGate` record for this PR via XRPC
2. If status is `blocked` → refuses the merge
3. If status is `pass` or `warning` → allows it
4. If no record exists → behavior depends on enforcement mode (advisory = allow, hard = block)

### 5. Spindle Workflow (YAML)

A `.tangled/workflows/compliance.yml` file in each governed repo that tells the Spindle to run the compliance agent container on PR events.

```yaml
name: compliance-check
on:
  pull_request:
    types: [opened, updated]
jobs:
  assess:
    runs-on: default
    steps:
      - uses: tangled-org/compliance-agent@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          pds_host: ${{ secrets.PDS_HOST }}
          agent_did: ${{ secrets.AGENT_DID }}
          agent_app_password: ${{ secrets.AGENT_APP_PASSWORD }}
```

## Data Flow: PR Assessment

```
1. Developer opens/updates PR on a governed repo
         │
2. Spindle detects PR event, starts compliance workflow
         │
3. Compliance Agent (Python container) starts
         │
4. Agent reads from ATProto:
   ├── repo's compliance.repoProfile
   ├── repo's policy.repoBinding → policy.policyPack → policy.control
   ├── repo's compliance.codeOwner records
   ├── repo's graph.codeDependency edges
   └── org.membership + org.role (for approval routing)
         │
5. Agent clones repo, computes diff
         │
6. Agent runs scans: Semgrep, Gitleaks, OSV-Scanner
         │
7. Agent sends context to Claude for policy reasoning
         │
8. Agent writes to ATProto:
   ├── compliance.prAssessment
   ├── compliance.controlEvaluation (one per control)
   ├── compliance.impactAssessment (if dependencies affected)
   ├── compliance.requiredApproval (one per required reviewer)
   ├── audit.evidence (scan results)
   ├── audit.agentRun (execution metadata)
   └── compliance.mergeGate (final verdict)
         │
9. Tangled Org AppView picks up new records via Jetstream
         │
10. UI renders compliance panel in the PR view
         │
11. Required approvers are notified
         │
12. On merge: Knot hook checks mergeGate → allow/block
         │
13. If merged + downstream impact: agent creates propagation
    records and downstream issues
```

## Deployment Topology

```
┌─────────────────────────────────────────────────────┐
│  Your Infrastructure                                 │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Tangled Org  │  │  Merge Gate  │                 │
│  │  AppView      │  │  Hook        │                 │
│  │  (Go binary)  │  │  (Go binary) │                 │
│  │  Port 8080    │  │  On Knot     │                 │
│  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                         │
│         │     ┌────────────┘                         │
│         │     │                                      │
│  ┌──────┴─────┴──┐  ┌──────────────┐               │
│  │  SQLite DB     │  │  Spindle     │               │
│  │  (local index) │  │  (CI runner) │               │
│  └───────────────┘  │  Runs Python  │               │
│                      │  agent in     │               │
│                      │  containers   │               │
│                      └──────────────┘               │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────┐
│  ATProto Network                                     │
│  ├── Your PDS (governance records)                   │
│  ├── Jetstream (real-time event stream)              │
│  └── Other users' PDSs (their PRs, approvals)       │
└─────────────────────────────────────────────────────┘
```

All components are self-hostable. The AppView and Hook are single Go binaries. The agent runs in Spindle containers. SQLite is the only local state (and it's a cache — ATProto is the source of truth).
