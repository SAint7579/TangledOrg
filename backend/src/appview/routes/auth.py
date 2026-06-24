"""ATProto OAuth authentication routes."""

import json
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse

from atproto_oauth import (
    resolve_handle_to_did,
    resolve_did_to_pds,
    resolve_authorization_server,
    fetch_authorization_server_metadata,
    discover_token_endpoint,
    generate_dpop_key,
    make_pkce,
    dpop_post_form,
    jwk_to_key,
    key_to_jwk,
    public_jwk,
)

from src.appview.session import SessionStore
from src.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

_session_store: SessionStore | None = None

COOKIE_NAME = "tangled_org_session"


def _get_store() -> SessionStore:
    global _session_store
    if _session_store is None:
        db_path = settings.db_path.replace("tangledorg.db", "sessions.db")
        _session_store = SessionStore(db_path=db_path)
    return _session_store


@router.get("/login")
async def login(handle: str, request: Request):
    """Initiate ATProto OAuth login flow."""
    store = _get_store()
    base_url = settings.backend_url or str(request.base_url).rstrip("/")
    client_id = f"{base_url}/.well-known/atproto-client-metadata.json"
    redirect_uri = f"{base_url}/auth/callback"

    try:
        did = resolve_handle_to_did(handle)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Could not resolve handle: {handle}")

    try:
        pds_url = resolve_did_to_pds(did)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Could not find PDS for: {did}")

    try:
        auth_server_url = resolve_authorization_server(pds_url)
        auth_meta = fetch_authorization_server_metadata(auth_server_url)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not discover authorization server")

    par_endpoint = auth_meta.get("pushed_authorization_request_endpoint")
    authorization_endpoint = auth_meta.get("authorization_endpoint")

    if not par_endpoint or not authorization_endpoint:
        raise HTTPException(status_code=500, detail="PDS missing OAuth endpoints")

    code_verifier, code_challenge = make_pkce()
    state = secrets.token_urlsafe(32)

    private_key = generate_dpop_key()
    private_jwk = key_to_jwk(private_key)
    pub_jwk = public_jwk(private_jwk)

    par_data = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "atproto transition:generic",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "login_hint": handle,
    }

    par_response = dpop_post_form(par_endpoint, par_data, private_key, pub_jwk)

    request_uri = par_response.get("request_uri")
    if not request_uri:
        raise HTTPException(status_code=500, detail=f"PAR failed: {par_response}")

    store.create_oauth_state(
        state=state,
        handle=handle,
        code_verifier=code_verifier,
        dpop_private_key=json.dumps(private_jwk),
        pds_issuer=pds_url,
    )

    auth_url = (
        f"{authorization_endpoint}?"
        f"{urlencode({'client_id': client_id, 'request_uri': request_uri})}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def callback(code: str, state: str, request: Request):
    """Handle OAuth callback — exchange code for tokens, redirect to frontend with session token."""
    store = _get_store()
    base_url = settings.backend_url or str(request.base_url).rstrip("/")
    client_id = f"{base_url}/.well-known/atproto-client-metadata.json"
    redirect_uri = f"{base_url}/auth/callback"

    oauth_state = store.get_oauth_state(state)
    if not oauth_state:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    private_jwk = json.loads(oauth_state["dpop_private_key"])
    private_key = jwk_to_key(private_jwk)
    pub_jwk = public_jwk(private_jwk)

    token_endpoint = discover_token_endpoint(oauth_state["pds_issuer"])

    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": oauth_state["code_verifier"],
    }

    tokens = dpop_post_form(token_endpoint, token_data, private_key, pub_jwk)

    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {tokens}")

    sub = tokens.get("sub", "")
    did = sub if sub.startswith("did:") else resolve_handle_to_did(oauth_state["handle"])

    session_id = store.create_session(
        did=did,
        handle=oauth_state["handle"],
        pds_issuer=oauth_state["pds_issuer"],
        access_token=access_token,
        refresh_token=tokens.get("refresh_token", ""),
        dpop_private_key=json.dumps(private_jwk),
        expires_at=tokens.get("expires_at"),
    )

    frontend_url = settings.frontend_url or "http://localhost:3000"
    redirect_to = f"{frontend_url}/auth/callback?session={session_id}"
    return RedirectResponse(url=redirect_to)


@router.get("/me")
async def me(request: Request):
    """Return current user info from session."""
    session = get_authenticated_session(request)
    return {
        "did": session["did"],
        "handle": session["handle"],
        "pds": session["pds_issuer"],
    }


@router.post("/logout")
async def logout(request: Request):
    """Clear session."""
    store = _get_store()
    token = _extract_token(request)
    if token:
        store.delete_session(token)
    return {"ok": True}


def _extract_token(request: Request) -> str | None:
    """Extract session token from Authorization header or cookie."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get(COOKIE_NAME)


def get_authenticated_session(request: Request) -> dict:
    """Extract and validate the session from request.

    Accepts both Authorization: Bearer <token> and cookie-based sessions.
    """
    store = _get_store()
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = store.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    return session
