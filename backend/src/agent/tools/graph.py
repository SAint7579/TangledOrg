"""Tools for querying and writing dependency graph records.

Covers: RepoDependency, ServiceDependency, CodeDependency.
The agent uses these to understand blast radius — which downstream repos
are affected when a PR changes an API surface, shared model, or database schema.
Fine-grained CodeDependency edges are the primary input to ImpactAssessment.
"""

from datetime import datetime, timezone
from typing import Optional

from langchain_core.tools import tool

from src.models import CodeDependency, RepoDependency, ServiceDependency

from ._client import _val, get_client


@tool
def list_repo_dependencies(
    source_repo_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List all RepoDependency edges where source_repo_uri is the upstream repo.

    Returns the targetRepo AT-URI and dependencyType (runtime/build/test/api/data)
    for each downstream dependency. Use this to find which repos depend on the
    repo being changed.
    """
    result = get_client().list_records(RepoDependency.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("sourceRepo") == source_repo_uri
    ]


@tool
def list_upstream_repo_dependencies(
    target_repo_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List all RepoDependency edges where target_repo_uri is the downstream repo.

    Returns which repos this repo depends on (i.e. its upstream providers).
    """
    result = get_client().list_records(RepoDependency.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("targetRepo") == target_repo_uri
    ]


@tool
def list_service_dependencies(
    repo_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List all ServiceDependency records for a repository AT-URI.

    Returns the external service name, URL, and type (database/api/queue/cache/
    storage/auth) that the repo depends on. Use this to understand external
    infrastructure exposure when evaluating a PR.
    """
    result = get_client().list_records(ServiceDependency.COLLECTION, did=did)
    return [r for r in result["records"] if _val(r).get("repo") == repo_uri]


@tool
def list_code_dependencies(
    source_repo_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List fine-grained CodeDependency edges where source_repo_uri is the caller.

    Each edge records the specific source file/module path, the target repo and
    path it depends on, and the dependency type (api-call/import/shared-model/
    event-consumer/database-shared/config-ref/grpc/graphql).
    Use this to identify exactly which downstream code paths are affected by
    changes in a PR.
    """
    result = get_client().list_records(CodeDependency.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("sourceRepo") == source_repo_uri
    ]


@tool
def list_downstream_code_dependencies(
    target_repo_uri: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List CodeDependency edges where target_repo_uri is the provider being called.

    Returns all callers of this repo — i.e. every (sourceRepo, sourcePath) that
    imports from or calls into the target repo. Use this to find who is affected
    if the target repo's API or models change.
    """
    result = get_client().list_records(CodeDependency.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("targetRepo") == target_repo_uri
    ]


@tool
def list_code_dependencies_for_path(
    target_repo_uri: str,
    target_path: str,
    did: Optional[str] = None,
) -> list[dict]:
    """List CodeDependency edges pointing at a specific file path in a target repo.

    Narrows `list_downstream_code_dependencies` to a single file/module. Use
    this when you know which files a PR modifies and want to find exactly which
    downstream code imports them.
    """
    result = get_client().list_records(CodeDependency.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("targetRepo") == target_repo_uri
        and _val(r).get("targetPath") == target_path
    ]


@tool
def create_repo_dependency(
    source_repo_uri: str,
    target_repo_uri: str,
    dependency_type: str,
    description: Optional[str] = None,
) -> dict:
    """Create a RepoDependency edge between two repos.

    dependency_type: one of runtime, build, test, api, data
    Returns the created record's URI and CID.
    Use this when the agent discovers a repo dependency that was not previously
    recorded.
    """
    edge = RepoDependency(
        source_repo=source_repo_uri,
        target_repo=target_repo_uri,
        dependency_type=dependency_type,
        description=description,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(edge)


@tool
def create_code_dependency(
    source_repo_uri: str,
    source_path: str,
    target_repo_uri: str,
    target_path: str,
    dependency_type: str,
    source_label: Optional[str] = None,
    target_label: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Create a fine-grained CodeDependency edge between a specific file in one repo
    and a specific file in another repo.

    dependency_type: one of api-call, import, shared-model, event-consumer,
                     database-shared, config-ref, grpc, graphql
    source_label / target_label: human-readable labels (e.g. function or class name)
    Returns the created record's URI and CID.
    """
    edge = CodeDependency(
        source_repo=source_repo_uri,
        source_path=source_path,
        source_label=source_label,
        target_repo=target_repo_uri,
        target_path=target_path,
        target_label=target_label,
        dependency_type=dependency_type,
        description=description,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(edge)
