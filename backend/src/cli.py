"""CLI entrypoint for testing ATProto connectivity and governance records."""

import json
from datetime import datetime, timezone

import click
from rich.console import Console
from rich.table import Table

from src.atproto_client import TangledATProtoClient
from src.config import settings
from src.models.org import Organization, Role
from src.models.base import RoleSlug, Permission, EnforcementMode

console = Console()


def get_client() -> TangledATProtoClient:
    if not settings.handle or not settings.app_password:
        console.print(
            "[red]Error:[/red] Set TANGLED_ORG_HANDLE and TANGLED_ORG_APP_PASSWORD "
            "in your .env file or environment."
        )
        raise click.Abort()

    client = TangledATProtoClient(
        pds_host=settings.pds_host,
        handle=settings.handle,
        app_password=settings.app_password,
    )
    return client


@click.group()
def main():
    """Tangled Org — governance & compliance layer for Tangled."""
    pass


@main.command()
def whoami():
    """Authenticate and show your identity."""
    client = get_client()
    with console.status("Logging in..."):
        did = client.login()

    info = client.get_profile_info()
    console.print(f"\n[green]Authenticated successfully[/green]\n")

    table = Table(title="Your Identity")
    table.add_column("Field", style="bold")
    table.add_column("Value")
    table.add_row("Handle", info["handle"])
    table.add_row("DID", info["did"])
    table.add_row("PDS", info["pds"])
    console.print(table)


@main.command()
def repos():
    """List your Tangled repos."""
    client = get_client()
    with console.status("Logging in..."):
        client.login()

    with console.status("Fetching repos..."):
        repo_list = client.list_repos()

    if not repo_list:
        console.print("\n[yellow]No repos found.[/yellow] Create some on tangled.org first.\n")
        return

    table = Table(title=f"Your Tangled Repos ({len(repo_list)})")
    table.add_column("#", style="dim")
    table.add_column("Name", style="bold")
    table.add_column("AT-URI", style="dim")
    for i, repo in enumerate(repo_list, 1):
        name = ""
        if hasattr(repo["value"], "name"):
            name = repo["value"].name
        elif isinstance(repo["value"], dict):
            name = repo["value"].get("name", "")
        table.add_row(str(i), name or "(unnamed)", repo["uri"])

    console.print(f"\n")
    console.print(table)


@main.command()
def orgs():
    """List governance organizations you've created."""
    client = get_client()
    with console.status("Logging in..."):
        client.login()

    with console.status("Fetching organizations..."):
        result = client.list_governance_records("org.organization")

    if not result["records"]:
        console.print(
            "\n[yellow]No organizations found.[/yellow] "
            "Use 'create-org' to create one.\n"
        )
        return

    table = Table(title="Your Organizations")
    table.add_column("Name", style="bold")
    table.add_column("AT-URI", style="dim")
    for rec in result["records"]:
        val = rec["value"]
        name = val.get("name", "") if isinstance(val, dict) else getattr(val, "name", "")
        table.add_row(name or "(unnamed)", rec["uri"])

    console.print(f"\n")
    console.print(table)


@main.command()
@click.argument("name")
@click.option("--description", "-d", default=None, help="Org description")
def create_org(name: str, description: str | None):
    """Create a new governance organization."""
    client = get_client()
    with console.status("Logging in..."):
        did = client.login()

    org = Organization(
        name=name,
        description=description,
        ownerDid=did,
        createdAt=datetime.now(timezone.utc),
    )

    with console.status(f"Creating organization '{name}'..."):
        result = client.create_governance_record(org)

    console.print(f"\n[green]Organization created![/green]\n")

    table = Table(title=f"Organization: {name}")
    table.add_column("Field", style="bold")
    table.add_column("Value")
    table.add_row("Name", name)
    table.add_row("Owner", did)
    table.add_row("AT-URI", result["uri"])
    table.add_row("CID", result["cid"])
    if description:
        table.add_row("Description", description)
    console.print(table)


@main.command()
@click.argument("collection_suffix")
def list_records(collection_suffix: str):
    """List governance records by collection suffix.

    Example: list-records org.organization
    """
    client = get_client()
    with console.status("Logging in..."):
        client.login()

    with console.status(f"Fetching {collection_suffix}..."):
        result = client.list_governance_records(collection_suffix)

    records = result["records"]
    if not records:
        console.print(f"\n[yellow]No records found for {collection_suffix}[/yellow]\n")
        return

    console.print(f"\n[bold]Records: sh.tangled.governance.{collection_suffix}[/bold]")
    console.print(f"Count: {len(records)}\n")

    for rec in records:
        console.print(f"[dim]URI:[/dim] {rec['uri']}")
        val = rec["value"]
        if isinstance(val, dict):
            console.print(json.dumps(val, indent=2, default=str))
        else:
            console.print(str(val))
        console.print("---")


if __name__ == "__main__":
    main()
