"""Shared ATProto client singleton for all agent tools.

All tools import `get_client()` from here so authentication happens once per
process rather than on every tool call.
"""

from typing import Optional

from src.atproto_client.client import TangledATProtoClient
from src.config import settings

_client: Optional[TangledATProtoClient] = None


def get_client() -> TangledATProtoClient:
    """Return the logged-in ATProto client, initializing on first call."""
    global _client
    if _client is None:
        _client = TangledATProtoClient(
            pds_host=settings.pds_host,
            handle=settings.handle,
            app_password=settings.app_password,
        )
        _client.login()
    return _client


def _val(record: dict) -> dict:
    """Extract a record's value field as a plain dict.

    The atproto SDK may return value as a dict, Namespace, or Pydantic model
    depending on whether the collection has a registered lexicon. This helper
    normalises all three cases so filter comparisons work reliably.
    """
    v = record.get("value") or {}
    if isinstance(v, dict):
        return v
    # Pydantic model (e.g. known SDK type)
    if hasattr(v, "model_dump"):
        return v.model_dump(by_alias=True, exclude_none=True)
    # Namespace / SimpleNamespace / DataDict
    try:
        return dict(v)
    except (TypeError, ValueError):
        return vars(v) if hasattr(v, "__dict__") else {}
