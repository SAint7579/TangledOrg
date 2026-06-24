"""SQLite-backed session store for ATProto OAuth tokens."""

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class SessionStore:
    def __init__(self, db_path: str = "./data/sessions.db"):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    did TEXT NOT NULL,
                    handle TEXT NOT NULL,
                    pds_issuer TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT NOT NULL,
                    dpop_private_key TEXT NOT NULL,
                    expires_at TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS oauth_state (
                    state TEXT PRIMARY KEY,
                    handle TEXT NOT NULL,
                    code_verifier TEXT NOT NULL,
                    dpop_private_key TEXT NOT NULL,
                    pds_issuer TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)

    def create_oauth_state(
        self,
        state: str,
        handle: str,
        code_verifier: str,
        dpop_private_key: str,
        pds_issuer: str,
    ) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO oauth_state
                   (state, handle, code_verifier, dpop_private_key, pds_issuer, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (state, handle, code_verifier, dpop_private_key, pds_issuer,
                 datetime.now(timezone.utc).isoformat()),
            )

    def get_oauth_state(self, state: str) -> Optional[dict]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM oauth_state WHERE state = ?", (state,)
            ).fetchone()
            if row:
                conn.execute("DELETE FROM oauth_state WHERE state = ?", (state,))
                return dict(row)
        return None

    def create_session(
        self,
        did: str,
        handle: str,
        pds_issuer: str,
        access_token: str,
        refresh_token: str,
        dpop_private_key: str,
        expires_at: Optional[str] = None,
    ) -> str:
        session_id = secrets.token_urlsafe(32)
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (session_id, did, handle, pds_issuer, access_token, refresh_token,
                    dpop_private_key, expires_at, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (session_id, did, handle, pds_issuer, access_token, refresh_token,
                 dpop_private_key, expires_at,
                 datetime.now(timezone.utc).isoformat()),
            )
        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            return dict(row) if row else None

    def update_tokens(
        self,
        session_id: str,
        access_token: str,
        refresh_token: str,
        expires_at: Optional[str] = None,
    ) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """UPDATE sessions
                   SET access_token = ?, refresh_token = ?, expires_at = ?
                   WHERE session_id = ?""",
                (access_token, refresh_token, expires_at, session_id),
            )

    def delete_session(self, session_id: str) -> None:
        with self._get_conn() as conn:
            conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))

    def cleanup_expired(self) -> None:
        with self._get_conn() as conn:
            conn.execute(
                "DELETE FROM oauth_state WHERE created_at < datetime('now', '-10 minutes')"
            )
