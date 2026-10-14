#!/usr/bin/env python3
"""Provision client credentials and the private tunnel on a Linux Docker host."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
RELEASES = "https://api.github.com/repos/openai/tunnel-client/releases"
SCOPES = ["receipt:read", "receipt:write", "events:read", "print:request", "print:status"]


class SetupError(Exception):
    pass


def run(arguments, *, checkout=None, environment=None):
    result = subprocess.run([str(arg) for arg in arguments], cwd=checkout, env=environment,
                            stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if result.returncode:
        # Child output can contain account information. Let the owner inspect it locally.
        raise SetupError(f"{Path(str(arguments[0])).name} failed (exit {result.returncode}). Check that command on the printer host.")
    return result.stdout


def private_write(path: Path, content: str | bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as target:
        temporary = Path(target.name)
        target.write(content.encode() if isinstance(content, str) else content)
    temporary.chmod(0o600)
    temporary.replace(path)


def absolute_path(value: str) -> Path:
    path = Path(value).expanduser().resolve()
    if any(character in str(path) for character in "\n\r\x00"):
        raise SetupError("Paths must not contain newlines or NUL characters.")
    return path


def docker(checkout: Path, *arguments):
    return run(["docker", "compose", *arguments], checkout=checkout)


def credential(checkout: Path, destination: Path, name: str, automatic: bool):
    scopes = SCOPES + (["print:automatic"] if automatic else [])
    record_file = destination.with_suffix(".json")
    if destination.exists():
        if not record_file.exists():
            raise SetupError(f"{destination} already exists without its credential record; choose another token file.")
        saved = json.loads(record_file.read_text())
        records = json.loads(docker(checkout, "exec", "-T", "bridge", "petes-printer", "--data-dir", "/data", "--list-tokens"))
        active = next((item for item in records if item["id"] == saved["id"] and not item["revoked_at"]), None)
        if not active or not set(scopes).issubset(json.loads(active["scopes_json"])):
            raise SetupError("The saved credential is revoked or lacks the requested permissions. Choose a new token file; existing permissions are not silently increased.")
        destination.chmod(0o600)
        return
    arguments = ["exec", "-T", "bridge", "petes-printer", "--data-dir", "/data", "--create-token", name]
    for scope in scopes:
        arguments += ["--scope", scope]
    # Retain the ID before copying, so a failed copy can be retried without minting another token.
    if record_file.exists():
        record = json.loads(record_file.read_text())
    else:
        record = json.loads(docker(checkout, *arguments))
        private_write(record_file, json.dumps(record))
    if not re.fullmatch(r"[a-f0-9]{16}", record.get("id", "")):
        raise SetupError("The bridge returned an invalid credential ID.")
    if not set(scopes).issubset(record.get("scopes", [])):
        raise SetupError("The saved credential record lacks the requested scopes. Choose a new token file.")
    records = json.loads(docker(checkout, "exec", "-T", "bridge", "petes-printer", "--data-dir", "/data", "--list-tokens"))
    if not any(item["id"] == record["id"] and not item["revoked_at"] for item in records):
        raise SetupError("The credential was revoked before it could be copied. Choose a new token file.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    docker(checkout, "cp", f"bridge:/data/tokens/{record['id']}.token", destination)
    destination.chmod(0o600)


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "OpenReceipt-setup", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def verify_download(content: bytes, filename: str, checksums: bytes):
    expected = None
    for line in checksums.decode().splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1].lstrip("*") == filename:
            expected = fields[0]
            break
    if not expected or hashlib.sha256(content).hexdigest() != expected:
        raise SetupError(f"The official checksum did not match {filename}.")


def install_client(directory: Path, version: str):
    architecture = {"aarch64": "arm64", "arm64": "arm64", "x86_64": "amd64"}.get(platform.machine())
    if platform.system() != "Linux" or not architecture:
        raise SetupError("The tunnel host installer supports 64-bit Linux ARM64 and AMD64. Run it on the printer host.")
    endpoint = "latest" if version == "latest" else f"tags/{version}"
    release = json.loads(download(f"{RELEASES}/{endpoint}"))
    tag = release["tag_name"]
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9]+)*", tag):
        raise SetupError("The release has an unexpected version tag.")
    filename = f"tunnel-client-{tag}-linux-{architecture}.zip"
    assets = {asset["name"]: asset["browser_download_url"] for asset in release["assets"]}
    for name in (filename, "SHA256SUMS.txt"):
        if name not in assets:
            raise SetupError(f"The official release does not contain {name}.")
    binary = directory / "bin/tunnel-client"
    receipt = directory / "client-version.json"
    if binary.exists() and receipt.exists():
        installed = json.loads(receipt.read_text())
        if installed.get("version") == tag and installed.get("binarySha256") == hashlib.sha256(binary.read_bytes()).hexdigest():
            return tag
    checksums = download(assets["SHA256SUMS.txt"])
    archive = download(assets[filename])
    verify_download(archive, filename, checksums)
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        candidates = [entry for entry in zipped.infolist() if Path(entry.filename).name == "tunnel-client" and not entry.is_dir()]
        if len(candidates) != 1 or candidates[0].file_size > 200_000_000:
            raise SetupError("The official archive did not contain one bounded tunnel-client binary.")
        content = zipped.read(candidates[0])
    private_write(binary, content)
    binary.chmod(0o700)
    license_name = filename.replace(".zip", "-licenses.txt")
    if license_name in assets:
        licenses = download(assets[license_name])
        verify_download(licenses, license_name, checksums)
        private_write(directory / "licenses.txt", licenses)
    private_write(receipt, json.dumps({"version": tag, "archiveSha256": hashlib.sha256(archive).hexdigest(), "binarySha256": hashlib.sha256(content).hexdigest()}))
    return tag


def unit_value(value: str) -> str:
    return '"' + value.replace("%", "%%").replace("\\", "\\\\").replace('"', '\\"') + '"'


def service_text(owner: str, directory: Path) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner) or owner == "root":
        raise SetupError("Run setup as the ordinary Docker user, not root.")
    return "\n".join([
        "[Unit]", "Description=OpenReceipt private OpenAI MCP tunnel",
        "After=network-online.target docker.service", "Wants=network-online.target", "Requires=docker.service", "",
        "[Service]", "Type=simple", f"User={owner}",
        f"WorkingDirectory={str(directory).replace('%', '%%')}", f"EnvironmentFile={unit_value(str(directory / 'runtime.env'))}",
        f"ExecStart={unit_value(str(directory / 'bin/tunnel-client'))} run --profile openreceipt --profile-dir {unit_value(str(directory / 'profiles'))}",
        "Restart=always", "RestartSec=5", "UMask=0077", "", "[Install]", "WantedBy=multi-user.target", "",
    ])


def save_account(checkout: Path, directory: Path):
    tunnel_id = sys.stdin.readline().strip()
    api_key = sys.stdin.readline().strip()
    if not re.fullmatch(r"tunnel_[A-Za-z0-9_-]+", tunnel_id) or not re.fullmatch(r"sk-[A-Za-z0-9_-]+", api_key):
        raise SetupError("Activation requires a tunnel ID and runtime API key on stdin. Do not put credentials in command arguments.")
    values = {"CONTROL_PLANE_TUNNEL_ID": tunnel_id, "CONTROL_PLANE_API_KEY": api_key,
              "OPENRECEIPT_HOME": str(checkout), "OPENRECEIPT_CHATGPT_TOKEN_FILE": str(directory / "chatgpt.token")}
    private_write(directory / "runtime.env", "".join(f"{key}={json.dumps(value, ensure_ascii=False)}\n" for key, value in values.items()))


def activate(checkout: Path, directory: Path, owner: str, health_port: int):
    values = {}
    for line in (directory / "runtime.env").read_text().splitlines():
        key, _, value = line.partition("=")
        if key in {"CONTROL_PLANE_TUNNEL_ID", "CONTROL_PLANE_API_KEY", "OPENRECEIPT_HOME", "OPENRECEIPT_CHATGPT_TOKEN_FILE"}:
            values[key] = json.loads(value)
    if not re.fullmatch(r"tunnel_[A-Za-z0-9_-]+", values.get("CONTROL_PLANE_TUNNEL_ID", "")) or not re.fullmatch(r"sk-[A-Za-z0-9_-]+", values.get("CONTROL_PLANE_API_KEY", "")):
        raise SetupError("Save the tunnel ID and runtime credential before activation.")
    if values.get("OPENRECEIPT_HOME") != str(checkout) or values.get("OPENRECEIPT_CHATGPT_TOKEN_FILE") != str(directory / "chatgpt.token"):
        raise SetupError("Account settings belong to another checkout or directory. Save the account settings again.")
    environment = dict(os.environ) | values
    client = directory / "bin/tunnel-client"
    run([client, "init", "--force", "--profile", "openreceipt", "--profile-dir", directory / "profiles", "--tunnel-id", values["CONTROL_PLANE_TUNNEL_ID"],
         "--mcp-command", shlex.quote(str(directory / "mcp.sh")), "--health-listen-addr", f"127.0.0.1:{health_port}"], environment=environment)
    run([client, "doctor", "--profile", "openreceipt", "--profile-dir", directory / "profiles", "--explain"], environment=environment)
    service = f"openreceipt-tunnel-{owner}.service"
    private_write(directory / service, service_text(owner, directory))
    run(["sudo", "install", "-m", "644", directory / service, f"/etc/systemd/system/{service}"])
    run(["sudo", "systemctl", "daemon-reload"])
    run(["sudo", "systemctl", "enable", service])
    run(["sudo", "systemctl", "restart", service])
    print(f"Started {service}. Check readiness at http://127.0.0.1:{health_port}/readyz.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkout", default=str(ROOT), help="Absolute OpenReceipt checkout on this host.")
    commands = parser.add_subparsers(dest="command", required=True)
    token = commands.add_parser("token", help="Create or reuse a scoped client token without printing its secret.")
    token.add_argument("--name", required=True)
    token.add_argument("--token-file", required=True)
    token.add_argument("--automatic", action="store_true", help="Explicitly grant print:automatic; the owner's bridge policy still applies.")
    tunnel = commands.add_parser("tunnel", help="Prepare the tunnel binary, credential and wrapper, or activate the service.")
    tunnel.add_argument("--directory", default=str(Path.home() / ".local/share/openreceipt/tunnel"))
    tunnel.add_argument("--version", default="latest", help="Official release tag, or latest (default). The installed version is recorded.")
    tunnel.add_argument("--automatic", action="store_true")
    action = tunnel.add_mutually_exclusive_group()
    action.add_argument("--save-account", action="store_true", help="Read tunnel ID and API key from stdin and save privately.")
    action.add_argument("--activate", action="store_true", help="Configure the saved account and start systemd; sudo may prompt on the terminal.")
    tunnel.add_argument("--health-port", type=int, default=8736)
    args = parser.parse_args()
    checkout = absolute_path(args.checkout)
    if not (checkout / "compose.yaml").is_file():
        raise SetupError("The checkout must contain compose.yaml. Clone and start the Docker stack first.")
    if not shutil.which("docker"):
        raise SetupError("Install Docker with Compose on the printer host first.")
    if args.command == "token":
        destination = absolute_path(args.token_file)
        credential(checkout, destination, args.name, args.automatic)
        print(f"Credential saved privately to {destination}. Its secret was not printed.")
        return
    directory = absolute_path(args.directory)
    if not 1 <= args.health_port <= 65535:
        raise SetupError("Choose a health port between 1 and 65535.")
    owner = run(["id", "-un"]).strip()
    service_text(owner, directory)  # Validate the owner before any changes.
    if args.save_account:
        save_account(checkout, directory)
        print("Account linking inputs saved privately; the key was not printed.")
    elif args.activate:
        if not (directory / "chatgpt.token").exists() or not (directory / "bin/tunnel-client").exists():
            raise SetupError("Prepare the tunnel before activating it.")
        activate(checkout, directory, owner, args.health_port)
    else:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        directory.chmod(0o700)
        version = install_client(directory, args.version)
        credential(checkout, directory / "chatgpt.token", "chatgpt", args.automatic)
        private_write(directory / "mcp.sh", (checkout / "deploy/tunnel-mcp.sh").read_bytes())
        (directory / "mcp.sh").chmod(0o700)
        print(f"Prepared tunnel-client {version}, a dedicated credential, and the wrapper in {directory}.")


if __name__ == "__main__":
    try:
        main()
    except (SetupError, OSError, ValueError, KeyError) as error:
        print(f"Setup failed: {error}", file=sys.stderr)
        raise SystemExit(1)
