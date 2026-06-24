# Tech Stack

## Decision: Hybrid Go + Python

We use **Go** for infrastructure-facing components (AppView, merge hook) and **Python** for the AI-facing component (compliance agent). This aligns with where each language's ecosystem is strongest.

| Component | Language | Reason |
|---|---|---|
| AppView (web UI + API) | Go | Matches Tangled's stack, single binary deployment, indigo library |
| Merge Gate Hook | Go | Runs on Knot alongside Tangled's Go codebase |
| Compliance Agent | Python | Superior AI/LLM ecosystem, LangGraph, Anthropic SDK |
| Lexicon Schemas | JSON | ATProto standard, language-agnostic |

## Go Components

### AppView

| Layer | Technology | Version | Why |
|---|---|---|---|
| Language | Go | 1.24+ | Tangled ecosystem compatibility |
| Router | chi | v5 | Lightweight, idiomatic, same as Tangled |
| Templates | html/template | stdlib | Server-rendered, no SPA framework needed |
| Interactivity | HTMX | 2.0 | Progressive enhancement, minimal JS |
| Styling | Tailwind CSS | 4.x | Utility-first, matches Tangled's aesthetic |
| Database | SQLite | via mattn/go-sqlite3 | Zero-ops, sufficient for record indexing |
| ATProto | bluesky-social/indigo | latest | Same ATProto library Tangled uses |
| Event Stream | Jetstream client | custom | Subscribe to governance record events |
| Auth | ATProto OAuth | via indigo | Sign in with any ATProto identity |
| Build | Nix flakes | — | Deterministic, matches Tangled's build system |

### Merge Gate Hook

| Layer | Technology | Why |
|---|---|---|
| Language | Go | Runs alongside Knot |
| ATProto | bluesky-social/indigo | Query mergeGate records via XRPC |
| Deployment | Systemd service or Git hook | Lightweight, single binary |

## Python Components

### Compliance Agent

| Layer | Technology | Version | Why |
|---|---|---|---|
| Language | Python | 3.12+ | AI ecosystem, fast prototyping |
| Agent Framework | LangGraph | latest | Stateful agent orchestration with defined node graph |
| AI | Anthropic Claude API | claude-sonnet-4-20250514+ | Policy reasoning, structured output |
| ATProto | MarshalX/atproto | latest | Read/write ATProto records from Python |
| SAST | Semgrep | OSS | Language-agnostic static analysis |
| Secret Detection | Gitleaks | latest | Detect secrets in diffs |
| Dependency Audit | OSV-Scanner | latest | Check deps against OSV vulnerability DB |
| Git | GitPython or subprocess | — | Clone repos, compute diffs |
| Package Manager | uv | latest | Fast Python package management |
| Container | Docker / Nixery | — | Runs inside Spindle |

## Shared / Infrastructure

| Component | Technology | Why |
|---|---|---|
| Lexicon Schemas | JSON (ATProto Lexicon v1) | Protocol standard |
| Go Codegen | lexgen (Tangled's tool) | Generate Go structs from lexicons |
| Python Codegen | atproto CLI or manual Pydantic models | Generate Python models from lexicons |
| CI | Tangled Spindles | Dogfooding |
| Deployment | Docker Compose + NixOS modules | Self-hostable |
| Dev Environment | Nix flakes (nix develop) | Deterministic dev shell |

## External Services

| Service | What For | Required? |
|---|---|---|
| Anthropic API | Claude for policy reasoning | Yes (agent won't work without it) |
| ATProto PDS | Store/read governance records | Yes (any PDS: bsky.social, tngl.sh, self-hosted) |
| Tangled Knot | Git hosting | Yes (managed or self-hosted) |
| Tangled Spindle | Run compliance agent | Yes (managed or self-hosted) |
| Jetstream | Real-time ATProto event stream | Yes (public infrastructure) |

## What We Don't Need

| Technology | Why Not |
|---|---|
| PostgreSQL / MySQL | SQLite is sufficient; ATProto is the source of truth |
| Redis | Only needed for OAuth sessions, which the AppView handles in-memory or SQLite |
| Kubernetes | Overkill; single binary + Docker Compose is enough |
| React / Vue / Next.js | HTMX + Go templates gives us interactivity without a JS build pipeline |
| AWS / GCP | Everything runs on any Linux box; no cloud vendor lock-in |

## Deployment Options

### Option 1: Docker Compose (simplest)

```yaml
services:
  appview:
    image: tangledorg/appview:latest
    ports: ["8080:8080"]
    volumes: ["./data:/data"]
    environment:
      - PDS_HOST=https://bsky.social
      - JETSTREAM_URL=wss://jetstream2.us-east.bsky.network/subscribe
  
  # Hook is deployed directly on the Knot machine
  # Agent runs inside Spindle (no separate deployment)
```

### Option 2: NixOS Module

```nix
services.tangled-org.appview = {
  enable = true;
  port = 8080;
  pdsHost = "https://bsky.social";
  jetstreamUrl = "wss://jetstream2.us-east.bsky.network/subscribe";
  dataDir = "/var/lib/tangled-org";
};

services.tangled-org.mergeHook = {
  enable = true;
  knotHost = "knot1.tangled.sh";
};
```

### Option 3: Bare Binary

```bash
# Download and run
./tangled-org-appview --port 8080 --db ./data/tangledorg.db
./tangled-org-hook --knot-host knot1.tangled.sh
```
