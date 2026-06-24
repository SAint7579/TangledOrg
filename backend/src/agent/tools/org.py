"""Tools for querying organization structure records.

Covers: Organization, Membership, Team, Role.
The agent uses these to resolve who owns a repo, what roles people hold,
and which teams must approve changes before a PR can merge.
"""

from typing import Optional

from langchain_core.tools import tool

from src.models import Membership, Organization, Role, Team

from ._client import _val, get_client


@tool
def list_organizations(did: Optional[str] = None) -> list[dict]:
    """List all Organization records stored on the PDS.

    Returns name, displayName, ownerDid, and settings for each org.
    Pass a DID to list orgs owned by a different user; omit to use the
    authenticated agent's own DID.
    """
    result = get_client().list_records(Organization.COLLECTION, did=did)
    return result["records"]


@tool
def get_organization(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single Organization record by its record key (rkey).

    The rkey is the last segment of an AT-URI
    (e.g. `at://did:plc:abc/sh.tangled.governance.org.organization/my-org` → rkey is `my-org`).
    Returns None if the record does not exist.
    """
    return get_client().get_record(Organization.COLLECTION, rkey=rkey, did=did)


@tool
def list_memberships_for_org(org_uri: str, did: Optional[str] = None) -> list[dict]:
    """List all Membership records for a specific organization AT-URI.

    Returns each member's DID, their role AT-URI, and any team AT-URIs they
    belong to. Use this to find who is in an org and what roles they hold
    when routing approvals.
    """
    result = get_client().list_records(Membership.COLLECTION, did=did)
    return [r for r in result["records"] if _val(r).get("org") == org_uri]


@tool
def get_memberships_for_member(
    member_did: str,
    org_uri: Optional[str] = None,
    did: Optional[str] = None,
) -> list[dict]:
    """Find Membership records for a specific member DID.

    Optionally narrow to a single org by passing org_uri. Use this to check
    what role a person holds — e.g. to verify they have `compliance.approve`
    permission before setting an approval as satisfied.
    """
    result = get_client().list_records(Membership.COLLECTION, did=did)
    records = [
        r for r in result["records"] if _val(r).get("memberDid") == member_did
    ]
    if org_uri:
        records = [r for r in records if _val(r).get("org") == org_uri]
    return records


@tool
def list_teams(
    org_uri: Optional[str] = None,
    did: Optional[str] = None,
) -> list[dict]:
    """List Team records, optionally filtered to a specific organization AT-URI.

    Returns each team's name, displayName, leadDid, and org reference.
    Use this to find which team owns a code path and must be notified about
    a policy violation.
    """
    result = get_client().list_records(Team.COLLECTION, did=did)
    records = result["records"]
    if org_uri:
        records = [r for r in records if _val(r).get("org") == org_uri]
    return records


@tool
def get_team(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single Team record by its rkey.

    Returns None if not found.
    """
    return get_client().get_record(Team.COLLECTION, rkey=rkey, did=did)


@tool
def list_roles(
    org_uri: Optional[str] = None,
    did: Optional[str] = None,
) -> list[dict]:
    """List Role records, optionally filtered to a specific organization AT-URI.

    Returns each role's slug (e.g. security-lead, dpo), name, and the full
    list of permissions it grants. Use this to understand what approvals a
    given role slug can satisfy (e.g. `compliance.approve`).
    """
    result = get_client().list_records(Role.COLLECTION, did=did)
    records = result["records"]
    if org_uri:
        records = [r for r in records if _val(r).get("org") == org_uri]
    return records


@tool
def get_role(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single Role record by its rkey.

    Returns the role's slug, name, permissions list, and org reference.
    Returns None if not found.
    """
    return get_client().get_record(Role.COLLECTION, rkey=rkey, did=did)
