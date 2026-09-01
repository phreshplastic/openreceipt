from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import uvicorn
from platformdirs import user_data_path

from .app import create_app
from .auth import ALL_SCOPES
from .storage import BridgeStore


def main() -> None:
    parser = argparse.ArgumentParser(description="Pete's Printer local web and printer bridge")
    parser.add_argument("--host", default=os.environ.get("PETES_PRINTER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PETES_PRINTER_PORT", "8731")))
    parser.add_argument("--data-dir", type=Path, default=user_data_path("petes-printer"))
    parser.add_argument("--web-dist", type=Path)
    tokens = parser.add_mutually_exclusive_group()
    tokens.add_argument("--create-token", metavar="NAME", help="Create a scoped headless API token.")
    tokens.add_argument("--list-tokens", action="store_true", help="List headless API tokens without revealing secrets.")
    tokens.add_argument("--revoke-token", metavar="ID", help="Revoke a headless API token.")
    parser.add_argument("--scope", action="append", default=[], choices=sorted(ALL_SCOPES), help="Scope for --create-token; repeat as needed.")
    args = parser.parse_args()
    if args.create_token or args.list_tokens or args.revoke_token:
        store = BridgeStore(args.data_dir)
        try:
            if args.create_token:
                if not args.scope:
                    parser.error("--create-token requires at least one --scope")
                record, token = store.create_token(args.create_token, args.scope)
                token_directory = args.data_dir / "tokens"
                token_directory.mkdir(mode=0o700, parents=True, exist_ok=True)
                token_path = token_directory / f"{record['id']}.token"
                descriptor = os.open(token_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "w") as target:
                    target.write(f"{token}\n")
                print(json.dumps(record | {"tokenFile": str(token_path)}, indent=2))
            elif args.list_tokens:
                print(json.dumps(store.list_tokens(), indent=2))
            elif not store.revoke_token(args.revoke_token):
                parser.error(f"No active token has ID {args.revoke_token}")
        finally:
            store.close()
        return
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        parser.error("The local bridge only binds to loopback hosts (127.0.0.1, localhost, or ::1).")
    app = create_app(args.data_dir, args.web_dist)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
