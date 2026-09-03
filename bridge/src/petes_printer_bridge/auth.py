from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, Response

from .storage import BridgeStore


ALL_SCOPES = {
    "receipt:read",
    "receipt:write",
    "events:read",
    "print:request",
    "print:approve",
    "print:status",
    "print:direct",
}
SESSION_COOKIE = "petes_printer_session"
SESSION_HEADER = "x-bridge-session"


class AuthManager:
    def __init__(self, store: BridgeStore, allowed_origins: set[str] | None = None):
        self.store = store
        self.allowed_origins = allowed_origins or {"http://localhost", "http://127.0.0.1", "http://[::1]"}
        self.secret_path = store.data_directory / "session-secret"
        self.secret = self._load_secret()

    def _load_secret(self) -> bytes:
        if self.secret_path.exists():
            return self.secret_path.read_bytes()
        secret = secrets.token_bytes(32)
        descriptor = os.open(self.secret_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as target:
            target.write(secret)
        return secret

    def create_session(self, response: Response, *, cross_origin: bool = False) -> dict[str, str]:
        nonce = secrets.token_urlsafe(24)
        signature = self._sign(f"session:{nonce}")
        csrf = self._sign(f"csrf:{nonce}")
        response.set_cookie(
            SESSION_COOKIE,
            f"{nonce}.{signature}",
            httponly=True,
            samesite="none" if cross_origin else "strict",
            secure=cross_origin,
            path="/",
        )
        # Cross-origin browser requests can lose third-party cookies, especially
        # when the public site is open in a privacy-hardened browser. Return the
        # same short-lived session credential so the frontend can send it explicitly.
        return {"csrfToken": csrf, "sessionToken": f"{nonce}.{signature}"}

    def authorize(self, request: Request, required_scopes: set[str], *, unsafe: bool = False, ui_only: bool = False) -> dict:
        authorization = request.headers.get("authorization", "")
        if authorization.startswith("Bearer ") and not ui_only:
            record = self.store.token_for_bearer(authorization[7:])
            if not record:
                raise HTTPException(status_code=401, detail="The API token is invalid or revoked.")
            scopes = set(json.loads(record["scopes_json"]))
            if not required_scopes.issubset(scopes):
                raise HTTPException(status_code=403, detail="The API token does not grant the required scope.")
            return {"kind": "api", "tokenId": record["id"], "scopes": sorted(scopes)}

        cookie = request.headers.get(SESSION_HEADER, "") or request.cookies.get(SESSION_COOKIE, "")
        try:
            nonce, signature = cookie.rsplit(".", 1)
        except ValueError as error:
            raise HTTPException(status_code=401, detail="Start a local browser session before using this endpoint.") from error
        if not hmac.compare_digest(signature, self._sign(f"session:{nonce}")):
            raise HTTPException(status_code=401, detail="The browser session is invalid.")
        if unsafe:
            csrf = request.headers.get("x-csrf-token", "")
            if not hmac.compare_digest(csrf, self._sign(f"csrf:{nonce}")):
                raise HTTPException(status_code=403, detail="The CSRF token is missing or invalid.")
            origin = request.headers.get("origin")
            if origin:
                parsed = urlsplit(origin)
                if parsed.scheme not in {"http", "https"} or origin.rstrip("/") not in self.allowed_origins:
                    raise HTTPException(status_code=403, detail="Cross-origin state changes are not allowed.")
        return {"kind": "browser", "scopes": sorted(ALL_SCOPES)}

    def _sign(self, value: str) -> str:
        return hmac.new(self.secret, value.encode(), hashlib.sha256).hexdigest()
