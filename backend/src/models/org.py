"""Organization structure records: org, membership, team, role."""

from datetime import datetime
from typing import ClassVar, Optional

from pydantic import Field

from src.models.base import (
    ATProtoRecord,
    NAMESPACE_PREFIX,
    EnforcementMode,
    Permission,
    RoleSlug,
)


class OrgSettings(ATProtoRecord):
    default_enforcement: Optional[EnforcementMode] = Field(
        None, alias="defaultEnforcement"
    )
    require_compliance_profile: Optional[bool] = Field(
        None, alias="requireComplianceProfile"
    )


class Organization(ATProtoRecord):
    """sh.tangled.governance.org.organization"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.org.organization"

    name: str = Field(..., max_length=100)
    display_name: Optional[str] = Field(None, alias="displayName", max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    owner_did: str = Field(..., alias="ownerDid")
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")
    settings: Optional[OrgSettings] = None
    created_at: datetime = Field(..., alias="createdAt")


class Membership(ATProtoRecord):
    """sh.tangled.governance.org.membership"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.org.membership"

    org: str = Field(..., description="AT-URI of the organization record")
    member_did: str = Field(..., alias="memberDid")
    role: str = Field(..., description="AT-URI of the role record")
    teams: Optional[list[str]] = Field(None, description="AT-URIs of team records")
    invited_by: Optional[str] = Field(None, alias="invitedBy")
    created_at: datetime = Field(..., alias="createdAt")


class Team(ATProtoRecord):
    """sh.tangled.governance.org.team"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.org.team"

    org: str = Field(..., description="AT-URI of the organization record")
    name: str = Field(..., max_length=100)
    display_name: Optional[str] = Field(None, alias="displayName", max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    lead_did: Optional[str] = Field(None, alias="leadDid")
    created_at: datetime = Field(..., alias="createdAt")


class Role(ATProtoRecord):
    """sh.tangled.governance.org.role"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.org.role"

    org: str = Field(..., description="AT-URI of the organization record")
    slug: RoleSlug
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: list[Permission]
