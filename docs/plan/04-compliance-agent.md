# Compliance Agent

The compliance agent is a Python-based LangGraph agent that runs inside Spindle containers. It is the "brain" of Tangled Org — triggered on PR events, it analyzes code changes against organizational policies and produces structured compliance records.

## Agent Framework

We use **LangGraph** for agent orchestration because:

- Defined node graph with explicit state transitions (not free-form agent loops)
- Built-in state management across nodes
- Supports conditional branching (e.g., skip dependency check if no edges exist)
- Easy to test individual nodes in isolation
- Production-ready with retries and error handling

## Node Graph

```
                    ┌──────────────┐
                    │   START      │
                    │   (trigger)  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  clone_diff  │  Clone repo, compute diff, list changed files
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ load_profile │  Read repoProfile, policyPacks, controls,
                    │              │  codeOwners, codeDependencies from ATProto
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  map_owners  │  Match changed files to codeOwner patterns,
                    │              │  resolve to DIDs and teams
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  run_scans   │  Run Semgrep, Gitleaks, OSV-Scanner
                    │              │  Parse results into structured findings
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  check_deps  │  Walk codeDependency graph from changed files,
                    │              │  identify downstream repos/files affected
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ claude_reason│  Send context to Claude:
                    │              │  diff + profile + scan results + policies +
                    │              │  dependency impact + owners
                    │              │  Get: risk assessment, control evaluations,
                    │              │  required approvals, reasoning summary
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ decide_gate  │  Aggregate control results into final
                    │              │  mergeGate verdict: pass/warning/
                    │              │  needs-human-review/blocked
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ write_records│  Write all ATProto records:
                    │              │  prAssessment, controlEvaluation(s),
                    │              │  requiredApproval(s), impactAssessment,
                    │              │  evidence, agentRun, mergeGate
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │     END      │
                    └──────────────┘
```

## Agent State

The LangGraph state object passed between nodes:

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ComplianceState:
    # Input
    pr_uri: str
    repo_uri: str
    repo_clone_url: str
    pr_branch: str
    base_branch: str

    # From clone_diff
    diff_text: str = ""
    changed_files: list[str] = field(default_factory=list)

    # From load_profile
    repo_profile: Optional[dict] = None
    policy_packs: list[dict] = field(default_factory=list)
    controls: list[dict] = field(default_factory=list)
    code_owners: list[dict] = field(default_factory=list)
    code_dependencies: list[dict] = field(default_factory=list)
    org_memberships: list[dict] = field(default_factory=list)

    # From map_owners
    file_owner_map: dict[str, list[dict]] = field(default_factory=dict)
    affected_owners: list[str] = field(default_factory=list)
    affected_teams: list[str] = field(default_factory=list)

    # From run_scans
    semgrep_results: list[dict] = field(default_factory=list)
    gitleaks_results: list[dict] = field(default_factory=list)
    osv_results: list[dict] = field(default_factory=list)

    # From check_deps
    affected_edges: list[dict] = field(default_factory=list)
    downstream_repos: list[str] = field(default_factory=list)
    impact_risk_level: str = "none"

    # From claude_reason
    risk_level: str = "none"
    summary: str = ""
    control_evaluations: list[dict] = field(default_factory=list)
    required_approvals: list[dict] = field(default_factory=list)

    # From decide_gate
    gate_status: str = "pass"
    gate_reason: str = ""
    blocked_controls: list[str] = field(default_factory=list)
    post_merge_actions: list[dict] = field(default_factory=list)

    # Metadata
    agent_run_started: str = ""
    agent_run_duration_ms: int = 0
    claude_tokens_in: int = 0
    claude_tokens_out: int = 0
    error: Optional[str] = None
```

## Node Implementations

### 1. `clone_diff`

```python
def clone_diff(state: ComplianceState) -> ComplianceState:
    """Clone the repo and compute the diff between PR branch and base."""
    # git clone --depth=50 <repo_clone_url>
    # git diff <base_branch>...<pr_branch>
    # Parse diff to get list of changed files
    ...
```

### 2. `load_profile`

```python
def load_profile(state: ComplianceState) -> ComplianceState:
    """Read governance records from ATProto for this repo."""
    # Query PDS for:
    #   - compliance.repoProfile where repo == state.repo_uri
    #   - policy.repoBinding where repo == state.repo_uri
    #   - policy.policyPack for each binding
    #   - policy.control for each pack
    #   - compliance.codeOwner where repo == state.repo_uri
    #   - graph.codeDependency where targetRepo == state.repo_uri
    #   - org.membership for the org
    ...
```

### 3. `map_owners`

```python
def map_owners(state: ComplianceState) -> ComplianceState:
    """Match changed files to code owner patterns."""
    # For each changed file:
    #   For each codeOwner record:
    #     If fnmatch(file, pattern): add owner to file_owner_map
    # Collect unique affected_owners and affected_teams
    ...
```

### 4. `run_scans`

```python
def run_scans(state: ComplianceState) -> ComplianceState:
    """Run security scanning tools and parse results."""
    # semgrep --config=auto --json <repo_dir>
    # gitleaks detect --source=<repo_dir> --report-format=json
    # osv-scanner --json <repo_dir>
    # Parse each tool's JSON output into structured findings
    ...
```

### 5. `check_deps`

```python
def check_deps(state: ComplianceState) -> ComplianceState:
    """Walk the code dependency graph to find downstream impact."""
    # For each changed file:
    #   Find codeDependency edges where targetPath matches
    #   Record the downstream repo + path + edge
    # Assess impact risk level based on count and severity
    ...
```

### 6. `claude_reason`

```python
def claude_reason(state: ComplianceState) -> ComplianceState:
    """Send context to Claude for policy reasoning."""
    # Build prompt with:
    #   - Diff summary
    #   - Repo profile (data classification, regulations)
    #   - Applicable controls
    #   - Scan results
    #   - Owner mapping
    #   - Dependency impact
    # Ask Claude to:
    #   1. Assess overall risk level
    #   2. Evaluate each control (pass/fail/warning with reason)
    #   3. Identify required approvals with justification
    #   4. Provide a human-readable summary
    # Parse structured response
    ...
```

### 7. `decide_gate`

```python
def decide_gate(state: ComplianceState) -> ComplianceState:
    """Aggregate control results into final merge gate verdict."""
    # If any hard-enforcement control failed: status = "blocked"
    # If any approval-type control is pending: status = "needs-human-review"
    # If any soft-enforcement control failed: status = "warning"
    # Otherwise: status = "pass"
    #
    # If downstream repos affected: add "propagate-issues" post-merge action
    ...
```

### 8. `write_records`

```python
def write_records(state: ComplianceState) -> ComplianceState:
    """Write all assessment records to ATProto."""
    # Create records via com.atproto.repo.createRecord:
    #   1. audit.agentRun
    #   2. compliance.prAssessment
    #   3. compliance.controlEvaluation (one per control)
    #   4. compliance.requiredApproval (one per required reviewer)
    #   5. compliance.impactAssessment (if deps affected)
    #   6. audit.evidence (one per scan tool + claude reasoning)
    #   7. compliance.mergeGate (final verdict)
    ...
```

## Claude Prompt Design

The prompt sent to Claude in the `claude_reason` node follows a structured format:

```
You are a compliance analyst reviewing a pull request against organizational policies.

## Repository Profile
- Name: {repo_name}
- Data Classification: {data_classification}
- Handles: {handles_data}
- Applicable Regulations: {applicable_regulations}
- Risk Tier: {risk_tier}

## Pull Request
- Changed Files: {changed_files_list}
- Diff Summary: {diff_summary}

## Applicable Controls
{for each control:}
- {control_id}: {control_name}
  Description: {description}
  Check Type: {check_type}
  Enforcement: {enforcement}
  ISO Reference: {iso_reference}

## Scan Results
### Semgrep (SAST): {findings_count} findings
{findings_summary}

### Gitleaks (Secrets): {findings_count} findings
{findings_summary}

### OSV-Scanner (Dependencies): {findings_count} vulnerabilities
{findings_summary}

## Code Owners Affected
{file_owner_map}

## Downstream Dependencies Affected
{affected_edges}

---

Evaluate this PR against each applicable control. For each control, provide:
1. Status: pass | fail | warning
2. Reason: brief explanation

Then provide:
- Overall risk level: critical | high | medium | low | none
- Required approvals: who must approve and why (reference specific controls)
- Summary: 2-3 sentence human-readable assessment

Respond in JSON format:
{response_schema}
```

## Post-Merge Hook

After a PR is merged and the `mergeGate` has `postMergeActions`, a separate lightweight process (or the same agent re-triggered) handles:

1. **propagate-issues**: Create issues in downstream repos identified by `impactAssessment`
2. **notify-owners**: Send notifications to affected code owners
3. **trigger-scan**: Trigger compliance scans on downstream repos
4. **update-sla**: Update the SLA tracker status to "resolved"

## Error Handling

- If any node fails, the agent writes an `agentRun` record with `status: "failed"` and the error message
- The `mergeGate` defaults to `needs-human-review` on agent failure (fail-open for advisory/soft, fail-closed for hard enforcement)
- Retries: the Spindle workflow can be configured to retry on transient failures (network, PDS timeout)

## Testing Strategy

- **Unit tests**: Each node tested in isolation with mock state
- **Claude mock**: Recorded fixture responses for deterministic tests
- **Integration tests**: Full agent run against a local test PDS
- **Scan mocks**: Pre-generated scan result JSON for consistent test output
