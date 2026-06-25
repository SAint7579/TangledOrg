# Tangled Org — AI Agent

A LangGraph-based AI agent that can read repos, issues, PRs, compliance records, and governance data from the Tangled platform, and run full compliance assessments on pull requests.

---

## File map

```
backend/src/agent/
├── chat.py          ← Conversational agent (ReAct loop, uses all tools)
├── nodes/
│   └── __init__.py  ← Compliance pipeline (8-node LangGraph graph)
└── tools/
    ├── __init__.py  ← Exports ALL_TOOLS, TANGLED_TOOLS, domain subsets
    ├── _client.py   ← Shared ATProto client singleton
    ├── tangled.py   ← Repos, issues, PRs, file tree, commits  ← START HERE
    ├── org.py       ← Organizations, members, teams, roles
    ├── policy.py    ← Policy packs, controls, repo bindings
    ├── compliance.py← Assessments, incidents, merge gates
    ├── graph.py     ← Repo/code dependency edges
    └── audit.py     ← Agent runs, evidence, waivers
```

---

## Setup

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install -e ".[agent]"   # installs langgraph, langchain-anthropic, etc.
```

`.env` needs:

```
TANGLED_ORG_HANDLE=yourhandle.tngl.sh
TANGLED_ORG_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
TANGLED_ORG_ANTHROPIC_API_KEY=sk-ant-...
```

---

## Quick test

```bash
python test_agent.py
```

Or interactively:

```python
from src.agent.chat import run_chat

print(run_chat("What repos do we have?"))
print(run_chat("Show open issues in payments-api"))
print(run_chat("Any open incidents?"))
```

---

## Tools reference

### Tangled-native tools (`tools/tangled.py`)

These read and write live data from the Tangled PDS and knot servers.

**Read tools**

| Tool | Description |
|------|-------------|
| `get_org_summary()` | Counts: repos, open issues, open PRs, incidents, members |
| `list_repos()` | All repos with compliance profiles |
| `get_repo(rkey)` | Single repo with profile + policy binding |
| `list_issues(repo_rkey, state)` | Issues for one repo (`open`/`closed`/`all`) |
| `get_issue(issue_uri)` | Full detail on one issue |
| `list_all_issues(state)` | Issues across the whole org |
| `search_issues(query, state)` | Keyword search in issue titles + bodies |
| `list_pulls(repo_rkey, status)` | PRs for one repo (`open`/`merged`/`closed`/`all`) |
| `get_pull(pull_uri)` | Full detail on one PR |
| `list_all_pulls(status)` | PRs across the whole org |
| `get_repo_tree(repo_rkey, ref, path)` | Browse file tree via knot server |
| `get_repo_log(repo_rkey, ref, limit)` | Commit history via knot server |

**Write tools**

| Tool | Description |
|------|-------------|
| `create_issue(repo_rkey, title, body)` | Open a new issue in a repo |
| `close_issue(issue_uri)` | Close an issue (writes a state record) |
| `reopen_issue(issue_uri)` | Reopen a closed issue |
| `comment_on_issue(issue_uri, body)` | Post a comment on an issue |
| `close_pull(pull_uri)` | Close a PR without merging |
| `merge_pull(pull_uri)` | Mark a PR as merged (record only, no git merge) |
| `comment_on_pull(pull_uri, body)` | Post a comment on a PR |

### Governance tools

| File | Tools | What they cover |
|------|-------|-----------------|
| `org.py` | 8 tools | Orgs, memberships, teams, roles |
| `policy.py` | 7 tools | Policy packs, controls, bindings, SLA rules |
| `compliance.py` | 20 tools | Repo profiles, incidents, PR assessments, merge gates |
| `graph.py` | 8 tools | Repo-to-repo and file-level dependency edges |
| `audit.py` | 8 tools | Agent runs, scan evidence, compliance waivers |

All tools are exported as `ALL_TOOLS` from `tools/__init__.py`.

---

## Chat agent (`chat.py`)

Uses all 57 tools in a ReAct loop (LangGraph `create_react_agent`).

```python
from src.agent.chat import run_chat

# Single turn
response = run_chat("What repos do we have?")

# Multi-turn with history
history = [
    {"role": "human", "content": "List repos"},
    {"role": "assistant", "content": "You have 3 repos: ..."},
]
response = run_chat("Which one has the most open issues?", history=history)
```

**API endpoint:** `POST /api/agent/chat`

```json
{
  "message": "Show open PRs",
  "history": []
}
```

Response:
```json
{
  "response": "Here are the open pull requests across all repos: ..."
}
```

---

## Compliance pipeline (`nodes/__init__.py`)

An 8-node LangGraph graph that runs a full compliance assessment on a PR:

```
clone_diff → load_profile → map_owners → run_scans →
check_deps → claude_reason → decide_gate → write_records
```

Writes ~10 ATProto records per run (assessment, evidence, gate decision, etc.).

```python
from src.agent.nodes import graph, ComplianceState

result = graph.invoke(ComplianceState(
    pr_uri="at://...",
    repo_uri="at://...",
    repo_clone_url="https://tngl.sh/user/repo.git",
    pr_branch="feature/my-change",
    base_branch="main",
))
print(result.gate_status)  # pass | warning | needs-human-review | blocked
```

**API endpoint:** `POST /api/agent/run`

```json
{
  "pr_uri": "at://...",
  "repo_uri": "at://...",
  "repo_clone_url": "https://tngl.sh/user/repo.git",
  "pr_branch": "feature/change",
  "base_branch": "main"
}
```

Scan tools (semgrep, gitleaks, osv-scanner) are optional — the agent skips them gracefully if not installed.

---

## Adding a new tool

1. Add a `@tool`-decorated function to the relevant file in `tools/`
2. Import and add it to the appropriate list in `tools/__init__.py`
3. Add it to `ALL_TOOLS` (or its subset list — it's included automatically)

The chat agent and compliance pipeline both pick up tools from `ALL_TOOLS` automatically.
