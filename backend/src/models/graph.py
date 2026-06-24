"""Dependency graph records: repo, service, and code-level edges."""

from datetime import datetime
from typing import ClassVar, Optional

from pydantic import Field

from src.models.base import (
    ATProtoRecord,
    NAMESPACE_PREFIX,
    CodeDependencyType,
    DependencyType,
    ServiceType,
)


class RepoDependency(ATProtoRecord):
    """sh.tangled.governance.graph.repoDependency"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.graph.repoDependency"

    source_repo: str = Field(..., alias="sourceRepo")
    target_repo: str = Field(..., alias="targetRepo")
    dependency_type: DependencyType = Field(..., alias="dependencyType")
    description: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(..., alias="createdAt")


class ServiceDependency(ATProtoRecord):
    """sh.tangled.governance.graph.serviceDependency"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.graph.serviceDependency"

    repo: str
    service_name: str = Field(..., alias="serviceName", max_length=200)
    service_url: Optional[str] = Field(None, alias="serviceUrl")
    service_type: Optional[ServiceType] = Field(None, alias="serviceType")
    description: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(..., alias="createdAt")


class CodeDependency(ATProtoRecord):
    """sh.tangled.governance.graph.codeDependency

    Fine-grained edge: file/module in repo A depends on file/module in repo B.
    """

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.graph.codeDependency"

    source_repo: str = Field(..., alias="sourceRepo")
    source_path: str = Field(..., alias="sourcePath")
    source_label: Optional[str] = Field(None, alias="sourceLabel")
    target_repo: str = Field(..., alias="targetRepo")
    target_path: str = Field(..., alias="targetPath")
    target_label: Optional[str] = Field(None, alias="targetLabel")
    dependency_type: CodeDependencyType = Field(..., alias="dependencyType")
    description: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(..., alias="createdAt")
