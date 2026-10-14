from __future__ import annotations

import argparse
import json
import os
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

import uvicorn
from platformdirs import user_data_path

from .app import create_app
from .auth import ALL_SCOPES
from .storage import BridgeStore
from .transports import create_usb_transport
from .service import classify_usb_error


def main() -> None:
    parser = argparse.ArgumentParser(description="Pete's Printer local web and printer bridge")
    parser.add_argument("--host", default=os.environ.get("PETES_PRINTER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PETES_PRINTER_PORT", "8731")))
    parser.add_argument("--data-dir", type=Path, default=user_data_path("petes-printer"))
    parser.add_argument("--web-dist", type=Path)
    parser.add_argument("--print-file", type=Path, help="Print a PNG file directly to the Epson TM-L90 over USB.")
    parser.add_argument("--diagnose", action="store_true", help="Report bridge and USB availability without printing.")
    parser.add_argument("--no-runtime", action="store_true", help="Use a separately managed Node renderer (Docker).")
    parser.add_argument("--container-network", action="store_true", help="Allow a container-internal bind; publish ports on host loopback only.")
    parser.add_argument("--runtime", type=Path, help="Path to the built Node receipt renderer.")
    parser.add_argument("--backup", type=Path, help="Create a consistent backup of data, artifacts, and credentials.")
    parser.add_argument("--restore", type=Path, help="Restore a backup into an empty data directory.")
    tokens = parser.add_mutually_exclusive_group()
    tokens.add_argument("--create-token", metavar="NAME", help="Create a scoped headless API token.")
    tokens.add_argument("--list-tokens", action="store_true", help="List headless API tokens without revealing secrets.")
    tokens.add_argument("--revoke-token", metavar="ID", help="Revoke a headless API token.")
    parser.add_argument("--scope", action="append", default=[], choices=sorted(ALL_SCOPES), help="Scope for --create-token; repeat as needed.")
    args = parser.parse_args()
    if args.backup or args.restore:
        from .maintenance import backup, restore
        if args.backup and args.restore:
            parser.error("Choose backup or restore, not both.")
        if args.backup:
            backup(args.data_dir, args.backup)
        else:
            restore(args.data_dir, args.restore)
        return
    if args.diagnose:
        result = {}
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/api/v1/capabilities", timeout=35) as response:
                result = json.load(response)
        except (urllib.error.URLError, TimeoutError):
            result = {"bridgeOnline": False, "bridgeCode": "bridge_not_running"}
        if not result.get("bridgeOnline"):
            transport = None
            try:
                transport = create_usb_transport()
                transport.prepare()
                result |= {"printerConnected": True, "code": "ready"}
            except Exception as error:
                result |= {"printerConnected": False, "code": classify_usb_error(error), "detail": str(error)}
            finally:
                try:
                    if transport:
                        transport.close()
                except Exception:
                    pass
        print(json.dumps(result, indent=2))
        return
    if args.print_file:
        transport = create_usb_transport()
        try:
            transport.prepare()
            transport.print_image(args.print_file.read_bytes(), 4, "full")
        finally:
            transport.close()
        print(f"Printed {args.print_file}")
        return
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
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not args.container_network:
        parser.error("The local bridge only binds to loopback hosts (127.0.0.1, localhost, or ::1).")
    app = create_app(args.data_dir, args.web_dist, port=args.port)
    runtime = args.runtime or ((args.web_dist.resolve().parent / "dist-mcp/runtime.mjs") if args.web_dist else Path("dist-mcp/runtime.mjs"))
    child = None
    try:
        if not args.no_runtime:
            if not runtime.exists():
                parser.error("Build the Node runtime with npm run build:mcp, or use --no-runtime with a separately managed renderer.")
            child = subprocess.Popen(["node", str(runtime)])
        uvicorn.run(app, host=args.host, port=args.port)
    finally:
        if child:
            child.terminate()
            child.wait(timeout=10)


if __name__ == "__main__":
    main()
