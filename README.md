<p align="center">
  <img src="./assets/logo.webp" alt="HSB Logo" width="420" />
</p>

<h1 align="center">HSB: Tangled Challenge</h1>

<p align="center">
  AI-powered governance and compliance layer for <a href="https://tangled.org">Tangled</a> — the decentralized coding platform built on AT Protocol.
</p>

---

## What is this?

HSB adds a compliance and security layer on top of Tangled's decentralized Git platform. It uses AI agents to automatically scan code against policy packs (MISRA-C, ISO 27001, standard coding practices), detect cross-repo dependency issues, and track incidents — all stored as signed, portable ATProto records.

**Key capabilities:**
- Policy pack management with per-control severity and SLA rules
- AI-powered repo scans and PR compliance checks (Claude + LangGraph)
- Cross-repo dependency graph with code-level linking
- Incident tracking with superseded scan deduplication
- Full audit trail of every AI check

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | FastAPI (Python) |
| AI Agent | LangGraph, Claude (Anthropic) |
| Protocol | AT Protocol (ATProto) via MarshalX SDK |
| Data | PDS (Personal Data Server) — 24 custom governance lexicons + 7 native Tangled collections |

## Running Locally

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Tangled account (`*.tngl.sh`)
- Anthropic API key (for AI features)

### Frontend

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000`

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your credentials
uvicorn src.appview.main:app --reload --port 8000
```

Runs on `http://localhost:8000`

### Environment Variables

```
TANGLED_HANDLE=yourhandle.tngl.sh
TANGLED_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
ANTHROPIC_API_KEY=sk-ant-...
```

## License

MIT
