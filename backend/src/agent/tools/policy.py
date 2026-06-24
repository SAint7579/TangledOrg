"""Tools for querying policy definition records.

Covers: PolicyPack, Control, RepoBinding, SLARule.
The agent reads these to know *what rules apply* to a repo before evaluating
a PR. Controls define individual checks; RepoBinding links a policy pack to a
specific repo (with optional overrides); SLARules set resolution deadlines by
severity.
"""

from typing import Optional

from langchain_core.tools import tool

from src.models import Control, PolicyPack, RepoBinding, SLARule

from ._client import _val, get_client


@tool
def list_policy_packs(
    org_uri: Optional[str] = None,
    did: Optional[str] = None,
) -> list[dict]:
    """List PolicyPack records, optionally filtered to a specific organization AT-URI.

    Returns each pack's name, framework (iso-27001, gdpr, soc2, …), version,
    and whether it is a starter pack. Use this to discover which policy packs
    exist before resolving which one is bound to a repo.
    """
    result = get_client().list_records(PolicyPack.COLLECTION, did=did)
    records = result["records"]
    if org_uri:
        records = [r for r in records if _val(r).get("org") == org_uri]
    return records


@tool
def get_policy_pack(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single PolicyPack record by its rkey.

    Returns name, framework, version, and description. Returns None if not found.
    """
    return get_client().get_record(PolicyPack.COLLECTION, rkey=rkey, did=did)


@tool
def list_controls_for_pack(
    policy_pack_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List all Control records belonging to a PolicyPack AT-URI.

    Each control has: controlId, name, checkType (gate/scan/approval/…),
    enforcement (advisory/soft/hard), scanTool (semgrep/gitleaks/osv-scanner),
    requiredApproverRole, and severityThreshold.
    Use this after resolving a repo's binding to get the full list of checks
    the agent must evaluate.
    """
    result = get_client().list_records(Control.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("policyPack") == policy_pack_uri
    ]


@tool
def get_control(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single Control record by its rkey.

    Returns controlId, checkType, enforcement, scanTool, severityThreshold,
    and the requiredApproverRole (AT-URI). Returns None if not found.
    """
    return get_client().get_record(Control.COLLECTION, rkey=rkey, did=did)


@tool
def get_repo_binding(repo_uri: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch the RepoBinding record that links a repo AT-URI to its PolicyPack.

    Returns the policyPack AT-URI, any enforcement override, and the lists of
    explicitly enabled/disabled control IDs. Returns None if the repo has no
    binding (meaning no policy pack is applied).

    This is a key early step: call this right after get_repo_profile to find
    which policy pack governs the repo.
    """
    result = get_client().list_records(RepoBinding.COLLECTION, did=did)
    for r in result["records"]:
        if _val(r).get("repo") == repo_uri:
            return r
    return None


@tool
def list_repo_bindings(did: Optional[str] = None) -> list[dict]:
    """List all RepoBinding records on the PDS.

    Returns repo AT-URI, policyPack AT-URI, and any overrides for each binding.
    """
    result = get_client().list_records(RepoBinding.COLLECTION, did=did)
    return result["records"]


@tool
def list_sla_rules_for_pack(
    policy_pack_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List SLARule records for a PolicyPack AT-URI.

    Each rule maps a severity level to a maximum resolution time in hours,
    an optional escalation threshold, and the role required to approve resolution.
    Use this to compute the deadline when creating an SLATracker for an incident.
    """
    result = get_client().list_records(SLARule.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("policyPack") == policy_pack_uri
    ]
