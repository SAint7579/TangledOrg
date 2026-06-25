"""Agent tools package.

Pass `ALL_TOOLS` to your LangGraph `ToolNode` or `bind_tools` call:

    from src.agent.tools import ALL_TOOLS
    from langgraph.prebuilt import ToolNode

    tool_node = ToolNode(ALL_TOOLS)
    model_with_tools = model.bind_tools(ALL_TOOLS)

Domain-specific subsets are also exported if you want to give a node access
to only a slice of the tool surface.

TANGLED_TOOLS covers native Tangled data (repos, issues, PRs, file tree, commits).
ALL_TOOLS includes both governance tools and Tangled-native tools.
"""

from src.agent.tools.tangled import (
    get_org_summary,
    get_repo,
    get_repo_log,
    get_repo_tree,
    get_file_content,
    get_issue,
    get_pull,
    list_all_issues,
    list_all_pulls,
    list_issues,
    list_pulls,
    list_repos,
    search_issues,
    create_issue,
    close_issue,
    reopen_issue,
    comment_on_issue,
    close_pull,
    merge_pull,
    comment_on_pull,
)
from src.agent.tools.audit import (
    complete_agent_run,
    create_evidence,
    get_active_waiver,
    get_agent_run,
    list_agent_runs_for_pr,
    list_evidence_for_assessment,
    list_waivers,
    start_agent_run,
)
from src.agent.tools.compliance import (
    create_control_evaluation,
    create_impact_assessment,
    create_incident,
    create_merge_gate,
    create_pr_assessment,
    create_propagation,
    create_repo_profile,
    create_required_approval,
    create_sla_tracker,
    get_incident,
    get_merge_gate,
    get_pr_assessment,
    get_repo_profile,
    list_code_owners,
    list_control_evaluations_for_assessment,
    list_incidents_for_repo,
    list_pr_assessments_for_pr,
    list_repo_profiles,
    list_required_approvals_for_assessment,
    list_sla_trackers_for_incident,
)
from src.agent.tools.graph import (
    create_code_dependency,
    create_repo_dependency,
    list_code_dependencies,
    list_code_dependencies_for_path,
    list_downstream_code_dependencies,
    list_repo_dependencies,
    list_service_dependencies,
    list_upstream_repo_dependencies,
)
from src.agent.tools.org import (
    get_memberships_for_member,
    get_organization,
    get_role,
    get_team,
    list_memberships_for_org,
    list_organizations,
    list_roles,
    list_teams,
)
from src.agent.tools.policy import (
    get_control,
    get_policy_pack,
    get_repo_binding,
    list_controls_for_pack,
    list_policy_packs,
    list_repo_bindings,
    list_sla_rules_for_pack,
)

# ---------------------------------------------------------------------------
# Domain subsets — useful for assigning different tool sets to different nodes
# ---------------------------------------------------------------------------

ORG_TOOLS = [
    list_organizations,
    get_organization,
    list_memberships_for_org,
    get_memberships_for_member,
    list_teams,
    get_team,
    list_roles,
    get_role,
]

POLICY_TOOLS = [
    list_policy_packs,
    get_policy_pack,
    list_controls_for_pack,
    get_control,
    get_repo_binding,
    list_repo_bindings,
    list_sla_rules_for_pack,
]

COMPLIANCE_TOOLS = [
    get_repo_profile,
    list_repo_profiles,
    create_repo_profile,
    list_code_owners,
    list_incidents_for_repo,
    get_incident,
    create_incident,
    list_sla_trackers_for_incident,
    create_sla_tracker,
    list_pr_assessments_for_pr,
    get_pr_assessment,
    create_pr_assessment,
    create_control_evaluation,
    list_control_evaluations_for_assessment,
    create_required_approval,
    list_required_approvals_for_assessment,
    get_merge_gate,
    create_merge_gate,
    create_impact_assessment,
    create_propagation,
]

GRAPH_TOOLS = [
    list_repo_dependencies,
    list_upstream_repo_dependencies,
    list_service_dependencies,
    list_code_dependencies,
    list_downstream_code_dependencies,
    list_code_dependencies_for_path,
    create_repo_dependency,
    create_code_dependency,
]

AUDIT_TOOLS = [
    start_agent_run,
    complete_agent_run,
    get_agent_run,
    list_agent_runs_for_pr,
    create_evidence,
    list_evidence_for_assessment,
    get_active_waiver,
    list_waivers,
]

TANGLED_TOOLS = [
    get_org_summary,
    list_repos,
    get_repo,
    list_issues,
    get_issue,
    list_all_issues,
    search_issues,
    list_pulls,
    get_pull,
    list_all_pulls,
    get_repo_tree,
    get_repo_log,
    get_file_content,
    create_issue,
    close_issue,
    reopen_issue,
    comment_on_issue,
    close_pull,
    merge_pull,
    comment_on_pull,
]

ALL_TOOLS = TANGLED_TOOLS + ORG_TOOLS + POLICY_TOOLS + COMPLIANCE_TOOLS + GRAPH_TOOLS + AUDIT_TOOLS

__all__ = [
    # subsets
    "ORG_TOOLS",
    "POLICY_TOOLS",
    "COMPLIANCE_TOOLS",
    "GRAPH_TOOLS",
    "AUDIT_TOOLS",
    "TANGLED_TOOLS",
    "ALL_TOOLS",
    # tangled native — read
    "get_org_summary",
    "list_repos",
    "get_repo",
    "list_issues",
    "get_issue",
    "list_all_issues",
    "search_issues",
    "list_pulls",
    "get_pull",
    "list_all_pulls",
    "get_repo_tree",
    "get_repo_log",
    "get_file_content",
    # tangled native — write
    "create_issue",
    "close_issue",
    "reopen_issue",
    "comment_on_issue",
    "close_pull",
    "merge_pull",
    "comment_on_pull",
    # org
    "list_organizations",
    "get_organization",
    "list_memberships_for_org",
    "get_memberships_for_member",
    "list_teams",
    "get_team",
    "list_roles",
    "get_role",
    # policy
    "list_policy_packs",
    "get_policy_pack",
    "list_controls_for_pack",
    "get_control",
    "get_repo_binding",
    "list_repo_bindings",
    "list_sla_rules_for_pack",
    # compliance
    "get_repo_profile",
    "list_repo_profiles",
    "create_repo_profile",
    "list_code_owners",
    "list_incidents_for_repo",
    "get_incident",
    "create_incident",
    "list_sla_trackers_for_incident",
    "create_sla_tracker",
    "list_pr_assessments_for_pr",
    "get_pr_assessment",
    "create_pr_assessment",
    "create_control_evaluation",
    "list_control_evaluations_for_assessment",
    "create_required_approval",
    "list_required_approvals_for_assessment",
    "get_merge_gate",
    "create_merge_gate",
    "create_impact_assessment",
    "create_propagation",
    # graph
    "list_repo_dependencies",
    "list_upstream_repo_dependencies",
    "list_service_dependencies",
    "list_code_dependencies",
    "list_downstream_code_dependencies",
    "list_code_dependencies_for_path",
    "create_repo_dependency",
    "create_code_dependency",
    # audit
    "start_agent_run",
    "complete_agent_run",
    "get_agent_run",
    "list_agent_runs_for_pr",
    "create_evidence",
    "list_evidence_for_assessment",
    "get_active_waiver",
    "list_waivers",
]
