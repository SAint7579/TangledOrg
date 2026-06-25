# Tangled Org


**Protocol-native organization governance, compliance, and code-safety layer for [Tangled](https://tangled.org).**

Tangled Org gives regulated software teams organizational structure, policy enforcement, dependency tracking, and audit-ready compliance — all stored as signed, portable ATProto records.

## What It Does

- **Organizations & Teams** — define org structure, roles, and code ownership as ATProto records
- **Policy Packs** — composable, reusable compliance rule sets (ISO 27001, GDPR, EU AI Act, custom)
- **Automated PR Assessment** — a Claude-powered LangGraph agent runs SAST, secret detection, dependency audits, and policy reasoning on every PR
- **Merge Enforcement** — Knot-side hooks block non-compliant merges based on signed gate records
- **Dependency Graph** — fine-grained code-to-code edges across repos for blast radius analysis
- **Incident Lifecycle** — SLA tracking, ISMS approval, and automatic downstream issue propagation
- **Audit Trail** — every assessment, approval, waiver, and evidence record is signed and tamper-evident

## Tech Stack

All-Python backend — one codebase, shared models, single deployment.

| Component | Key Tech |
|---|---|
| AppView (web UI + API) | FastAPI, Jinja2, HTMX, Tailwind, SQLite |
| Compliance Agent | LangGraph, Claude, Semgrep, Gitleaks, OSV-Scanner |
| ATProto Client | MarshalX/atproto SDK |
| Data Models | Pydantic (24 governance record types) |

## Documentation

All planning and design docs live in [`docs/plan/`](./docs/plan/):

| Document | Contents |
|---|---|
| [00-overview.md](./docs/plan/00-overview.md) | Project overview, problem statement, why ATProto |
| [01-architecture.md](./docs/plan/01-architecture.md) | System architecture, component diagram, data flow |
| [02-tech-stack.md](./docs/plan/02-tech-stack.md) | Full technology stack with rationale and deployment options |
| [03-lexicons.md](./docs/plan/03-lexicons.md) | All 24 ATProto Lexicon record definitions |
| [04-compliance-agent.md](./docs/plan/04-compliance-agent.md) | LangGraph agent design, node graph, Claude prompts |
| [05-ui-pages.md](./docs/plan/05-ui-pages.md) | AppView UI pages, rule definition interfaces, wireframes |
| [06-demo-scenarios.md](./docs/plan/06-demo-scenarios.md) | GDPR, ISO 27001, and incident flow demo walkthroughs |
| [07-incident-flow.md](./docs/plan/07-incident-flow.md) | Incident-to-resolution lifecycle, SLA tracking, propagation |
| [08-roadmap.md](./docs/plan/08-roadmap.md) | 5-phase implementation plan (~12 weeks) |

## License

MIT
