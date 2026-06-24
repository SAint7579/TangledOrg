# Tangled Org — Overview

## What Is Tangled Org?

Tangled Org is a **protocol-native organization governance, compliance, and code-safety layer** for [Tangled](https://tangled.org) — the decentralized Git collaboration platform built on the AT Protocol.

It gives regulated software teams organizational structure, policy enforcement, dependency tracking, and audit-ready compliance — all stored as signed, portable ATProto records.

## The Problem

Tangled is great for decentralized Git collaboration but lacks a full organizational governance system. Regulated teams (fintech, healthcare, government, AI companies) need:

- **Who owns which code** and who must approve changes
- **What compliance rules apply** to each repo (ISO 27001, GDPR, EU AI Act)
- **Automated policy checks** on every pull request
- **Audit trails** with tamper-evident evidence
- **Dependency impact analysis** across repos
- **Merge enforcement** tied to policy outcomes
- **SLA tracking** for security incidents
- **Downstream propagation** when fixes affect dependent repos

## Why Tangled + ATProto?

Traditional compliance tools store governance data in a proprietary database owned by the vendor. Tangled Org stores everything as **signed ATProto records** on the user's PDS:

| Property | What It Means |
|---|---|
| **Portable** | Switch PDS providers; your governance data follows your identity |
| **Auditable** | Every record is signed by the author's DID, timestamped, and immutable |
| **Interoperable** | Any ATProto AppView can read and display governance records |
| **Decentralized** | No single platform owns your compliance posture |
| **Tamper-evident** | Signed records provide cryptographic proof of who wrote what and when |

## What We're Building

| Component | What It Does | Language |
|---|---|---|
| **ATProto Lexicons** | Record type definitions for all governance data | JSON |
| **Tangled Org AppView** | Web UI: repos, PRs, compliance panels, org dashboard, audit log | Go |
| **Compliance Agent** | Analyzes PRs, runs scans, calls Claude, writes assessment records | Python |
| **Merge Gate Hook** | Knot-side hook that blocks non-compliant merges | Go |
| **Spindle Workflow** | CI pipeline definition that triggers the agent on PR events | YAML |

## This Is Not Just "GitHub Orgs for Tangled"

It's a protocol-native regulated software governance system where:

- **Git** stores code (on Knots)
- **ATProto** stores signed governance/compliance metadata (on PDSs)
- **Spindles** run enforcement (CI pipelines)
- **Claude** performs policy reasoning and review assistance
- **The AppView** exposes an auditable organization-wide dashboard

## Document Index

| Document | Contents |
|---|---|
| [01-architecture.md](./01-architecture.md) | System architecture, component diagram, data flow |
| [02-tech-stack.md](./02-tech-stack.md) | Full technology stack with rationale |
| [03-lexicons.md](./03-lexicons.md) | All ATProto Lexicon record definitions |
| [04-compliance-agent.md](./04-compliance-agent.md) | LangGraph agent design, node graph, Claude prompts |
| [05-ui-pages.md](./05-ui-pages.md) | AppView UI pages, rule definition interfaces |
| [06-demo-scenarios.md](./06-demo-scenarios.md) | GDPR and ISO 27001 demo walkthroughs |
| [07-incident-flow.md](./07-incident-flow.md) | Incident-to-resolution lifecycle, SLA tracking, downstream propagation |
| [08-roadmap.md](./08-roadmap.md) | Phased implementation plan |
