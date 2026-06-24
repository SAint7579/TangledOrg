"""ATProto OAuth client metadata for Tangled Org."""


def get_client_metadata(base_url: str) -> dict:
    """Generate the OAuth client metadata document.

    This is served at /.well-known/atproto-client-metadata.json and
    acts as the client_id for the ATProto OAuth flow.
    """
    return {
        "client_id": f"{base_url}/.well-known/atproto-client-metadata.json",
        "client_name": "Tangled Org",
        "client_uri": base_url,
        "redirect_uris": [f"{base_url}/auth/callback"],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "scope": "atproto transition:generic",
        "token_endpoint_auth_method": "none",
        "application_type": "web",
        "dpop_bound_access_tokens": True,
    }
