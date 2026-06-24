"""ATProto client wrapper for Tangled Org governance records.

Handles authentication, record CRUD, and repo listing against a PDS.
Uses the MarshalX/atproto SDK under the hood.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from atproto import Client, models

from src.models.base import ATProtoRecord


class TangledATProtoClient:
    """High-level client for reading/writing governance records on a PDS."""

    def __init__(self, pds_host: str, handle: str, app_password: str):
        self._pds_host = pds_host
        self._handle = handle
        self._app_password = app_password
        self._client: Optional[Client] = None
        self._did: Optional[str] = None

    @property
    def did(self) -> str:
        if not self._did:
            raise RuntimeError("Not logged in. Call login() first.")
        return self._did

    @property
    def client(self) -> Client:
        if not self._client:
            raise RuntimeError("Not logged in. Call login() first.")
        return self._client

    def login(self) -> str:
        """Authenticate with the PDS and return the DID."""
        self._client = Client(base_url=self._pds_host)
        profile = self._client.login(self._handle, self._app_password)
        self._did = profile.did
        return self._did

    # --- repo listing (read Tangled's own records) ---

    def list_repos(self, did: Optional[str] = None) -> list[dict]:
        """List sh.tangled.repo records for a DID (defaults to self)."""
        target_did = did or self.did
        response = self.client.com.atproto.repo.list_records(
            models.ComAtprotoRepoListRecords.Params(
                repo=target_did,
                collection="sh.tangled.repo",
                limit=100,
            )
        )
        return [
            {
                "uri": r.uri,
                "cid": r.cid,
                "value": r.value,
            }
            for r in response.records
        ]

    # --- generic record operations ---

    def create_record(
        self,
        record: ATProtoRecord,
        rkey: Optional[str] = None,
    ) -> dict:
        """Create an ATProto record on the authenticated user's PDS.

        Returns {"uri": ..., "cid": ...}.
        """
        data = record.to_record()
        response = self.client.com.atproto.repo.create_record(
            models.ComAtprotoRepoCreateRecord.Data(
                repo=self.did,
                collection=record.COLLECTION,
                rkey=rkey,
                record=data,
            )
        )
        return {"uri": response.uri, "cid": response.cid}

    def get_record(
        self,
        collection: str,
        rkey: str,
        did: Optional[str] = None,
    ) -> Optional[dict]:
        """Fetch a single record by collection + rkey."""
        target_did = did or self.did
        try:
            response = self.client.com.atproto.repo.get_record(
                models.ComAtprotoRepoGetRecord.Params(
                    repo=target_did,
                    collection=collection,
                    rkey=rkey,
                )
            )
            return {
                "uri": response.uri,
                "cid": response.cid,
                "value": response.value,
            }
        except Exception:
            return None

    def list_records(
        self,
        collection: str,
        did: Optional[str] = None,
        limit: int = 100,
        cursor: Optional[str] = None,
    ) -> dict:
        """List records of a given collection. Returns {"records": [...], "cursor": ...}."""
        target_did = did or self.did
        response = self.client.com.atproto.repo.list_records(
            models.ComAtprotoRepoListRecords.Params(
                repo=target_did,
                collection=collection,
                limit=limit,
                cursor=cursor,
            )
        )
        records = [
            {
                "uri": r.uri,
                "cid": r.cid,
                "value": r.value,
            }
            for r in response.records
        ]
        return {"records": records, "cursor": response.cursor}

    def delete_record(self, collection: str, rkey: str) -> None:
        """Delete a record by collection + rkey."""
        self.client.com.atproto.repo.delete_record(
            models.ComAtprotoRepoDeleteRecord.Data(
                repo=self.did,
                collection=collection,
                rkey=rkey,
            )
        )

    # --- convenience helpers ---

    def list_governance_records(self, collection_suffix: str, **kwargs) -> dict:
        """List records under the sh.tangled.governance.* namespace.

        e.g. list_governance_records("org.organization")
        """
        full_collection = f"sh.tangled.governance.{collection_suffix}"
        return self.list_records(full_collection, **kwargs)

    def create_governance_record(
        self, record: ATProtoRecord, rkey: Optional[str] = None
    ) -> dict:
        """Create a governance record (validates COLLECTION starts with our namespace)."""
        if not record.COLLECTION.startswith("sh.tangled.governance."):
            raise ValueError(
                f"Record collection {record.COLLECTION} is not a governance record"
            )
        return self.create_record(record, rkey=rkey)

    def resolve_handle(self, handle: str) -> str:
        """Resolve a handle to a DID."""
        response = self.client.com.atproto.identity.resolve_handle(
            models.ComAtprotoIdentityResolveHandle.Params(handle=handle)
        )
        return response.did

    def get_profile_info(self) -> dict:
        """Get basic profile info for the logged-in user."""
        return {
            "did": self.did,
            "handle": self._handle,
            "pds": self._pds_host,
        }
