from __future__ import annotations

import hashlib
import io
import json
import os
import subprocess
import sys
from uuid import uuid4

from fastapi.testclient import TestClient
from PIL import Image

from petes_printer_bridge.app import create_app
from petes_printer_bridge.service import PrinterManager
from petes_printer_bridge.storage import BridgeStore


class SuccessfulTransport:
    def prepare(self):
        pass

    def print_image(self, image_bytes, feed_lines, cut_mode):
        pass

    def close(self):
        pass


def make_png(color=1):
    output = io.BytesIO()
    Image.new("1", (576, 80), color).save(output, format="PNG")
    return output.getvalue()


def browser_session(client):
    response = client.post("/api/v1/session")
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrfToken"]}


def receipt_document(title="API receipt"):
    return {
        "schemaVersion": 2,
        "id": str(uuid4()),
        "title": title,
        "page": {"paperWidthMm": 80, "printableWidthDots": 576, "paddingDots": 28},
        "blocks": [{
            "id": str(uuid4()), "type": "text", "text": "Remember the thing", "size": "body",
            "weight": "regular", "italic": False, "underline": False, "align": "left",
        }],
    }


def commit_receipt(client, headers, document=None, expected=None, proposed=0, mutation_id=None, source=None):
    return client.put("/api/v1/receipt", headers=headers, json={
        "mutationId": mutation_id or str(uuid4()),
        "expectedRevision": expected,
        "proposedRevision": proposed,
        "document": document or receipt_document(),
        "source": source,
        "actor": {"kind": "human", "label": "Test"},
        "summary": "Test update",
    })


def test_public_static_site_serves_clean_routes_and_real_404s(tmp_path):
    web = tmp_path / "web"
    (web / "guides" / "example").mkdir(parents=True)
    (web / "index.html").write_text("<h1>Home</h1>")
    (web / "guides" / "example" / "index.html").write_text("<h1>Guide</h1>")
    (web / "404.html").write_text("<h1>Missing</h1>")
    (web / ".public-site").write_text("https://example.test\n")

    app = create_app(tmp_path / "data", web, manager=PrinterManager(BridgeStore(tmp_path / "data"), transport_factory=SuccessfulTransport))
    with TestClient(app) as client:
        assert client.get("/guides/example").text == "<h1>Guide</h1>"
        missing = client.get("/not-a-page")
        assert missing.status_code == 404
        assert missing.text == "<h1>Missing</h1>"


def test_public_bridge_interface_and_idempotent_replay(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=SuccessfulTransport)
    app = create_app(tmp_path, manager=manager)
    artifact = make_png()
    job_id = str(uuid4())
    metadata = {
        "id": job_id,
        "checksum": hashlib.sha256(artifact).hexdigest(),
        "rendererVersion": "test-v1",
        "document": {"schemaVersion": 2, "title": "API receipt"},
        "width": 576,
        "height": 80,
        "feedLines": 4,
        "cutMode": "full",
    }
    with TestClient(app) as client:
        headers = browser_session(client)
        capabilities = client.get("/api/v1/capabilities")
        assert capabilities.status_code == 200
        assert capabilities.json()["connected"] is True

        first = client.post("/api/v1/print-jobs", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert first.status_code == 201
        assert first.json()["id"] == job_id

        status = client.get(f"/api/v1/print-jobs/{job_id}")
        assert status.status_code == 200
        assert status.json()["status"] == "succeeded"

        replay = client.post("/api/v1/print-jobs", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert replay.status_code == 200
        assert replay.headers["X-Idempotent-Replay"] == "true"


def test_conflicting_job_id_returns_409(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=SuccessfulTransport)
    app = create_app(tmp_path, manager=manager)
    artifact = make_png()
    metadata = {
        "id": str(uuid4()),
        "checksum": hashlib.sha256(artifact).hexdigest(),
        "rendererVersion": "test-v1",
        "document": {"schemaVersion": 1},
        "width": 576,
        "height": 80,
    }
    with TestClient(app) as client:
        headers = browser_session(client)
        assert client.post("/api/v1/print-jobs", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")}).status_code == 201
        changed = make_png(color=0)
        metadata["checksum"] = hashlib.sha256(changed).hexdigest()
        response = client.post("/api/v1/print-jobs", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", changed, "image/png")})
        assert response.status_code == 409


def test_rejects_unknown_receipt_schema_versions(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=SuccessfulTransport)
    app = create_app(tmp_path, manager=manager)
    artifact = make_png()
    metadata = {
        "id": str(uuid4()),
        "checksum": hashlib.sha256(artifact).hexdigest(),
        "rendererVersion": "test-v1",
        "document": {"schemaVersion": 3},
        "width": 576,
        "height": 80,
    }
    with TestClient(app) as client:
        headers = browser_session(client)
        response = client.post("/api/v1/print-jobs", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert response.status_code == 422


def test_receipt_initialization_revision_conflict_and_mutation_replay(tmp_path):
    store = BridgeStore(tmp_path)
    app = create_app(tmp_path, manager=PrinterManager(store, transport_factory=SuccessfulTransport))
    with TestClient(app) as client:
        headers = browser_session(client)
        assert client.get("/api/v1/receipt").status_code == 404
        document = receipt_document()
        mutation_id = str(uuid4())
        first = commit_receipt(client, headers, document, proposed=4, mutation_id=mutation_id)
        assert first.status_code == 200
        assert first.json()["revision"] == 4

        replay = commit_receipt(client, headers, document, proposed=4, mutation_id=mutation_id)
        assert replay.status_code == 200
        assert replay.headers["X-Idempotent-Replay"] == "true"

        changed = receipt_document("Another client")
        stale = commit_receipt(client, headers, changed, expected=0, proposed=5)
        assert stale.status_code == 409
        assert stale.json()["error"]["current"]["revision"] == 4


def test_receipt_schema_validation_and_bounded_revision_jump(tmp_path):
    store = BridgeStore(tmp_path)
    app = create_app(tmp_path, manager=PrinterManager(store, transport_factory=SuccessfulTransport))
    with TestClient(app) as client:
        headers = browser_session(client)
        invalid = receipt_document()
        invalid["page"] = {"paperWidthMm": 58, "printableWidthDots": 576, "paddingDots": 22}
        assert commit_receipt(client, headers, invalid).status_code == 422
        assert commit_receipt(client, headers, receipt_document(), proposed=10_001).status_code == 422


def test_confirm_approval_stales_and_autonomous_prints(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=SuccessfulTransport)
    app = create_app(tmp_path, manager=manager)
    artifact = make_png()
    with TestClient(app) as client:
        headers = browser_session(client)
        receipt = receipt_document()
        assert commit_receipt(client, headers, receipt).status_code == 200
        metadata = {
            "id": str(uuid4()), "mutationId": str(uuid4()), "checksum": hashlib.sha256(artifact).hexdigest(),
            "rendererVersion": "test-v1", "expectedRevision": 0, "requester": {"kind": "api", "label": "Codex"},
            "reason": "Print the reminder", "width": 576, "height": 80, "feedLines": 4, "cutMode": "full",
        }
        pending = client.post("/api/v1/print-requests", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert pending.status_code == 201
        assert pending.json()["status"] == "awaiting_approval"

        changed = receipt_document("Updated")
        assert commit_receipt(client, headers, changed, expected=0, proposed=1).status_code == 200
        assert client.get(f"/api/v1/print-requests/{metadata['id']}").json()["status"] == "stale"

        settings = client.get("/api/v1/settings").json()
        update = client.put("/api/v1/settings", headers=headers, json={
            "mutationId": str(uuid4()), "expectedRevision": settings["revision"], "configured": True,
            "printPolicy": "autonomous", "trustedTemplateIds": [], "actor": {"kind": "human"},
        })
        assert update.status_code == 200
        metadata |= {"id": str(uuid4()), "mutationId": str(uuid4()), "expectedRevision": 1}
        automatic = client.post("/api/v1/print-requests", headers=headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert automatic.status_code == 201
        assert client.get(f"/api/v1/print-requests/{metadata['id']}").json()["status"] == "succeeded"


def test_csrf_and_scoped_bearer_authorization(tmp_path):
    store = BridgeStore(tmp_path)
    _, read_token = store.create_token("reader", ["receipt:read"])
    _, writer_token = store.create_token("writer", ["receipt:read", "receipt:write"])
    app = create_app(tmp_path, manager=PrinterManager(store, transport_factory=SuccessfulTransport))
    payload = {
        "mutationId": str(uuid4()), "expectedRevision": None, "proposedRevision": 0,
        "document": receipt_document(), "actor": {"kind": "api", "label": "Headless test"},
    }
    with TestClient(app) as client:
        csrf = browser_session(client)
        assert client.put("/api/v1/receipt", json=payload).status_code == 403
        assert client.put("/api/v1/receipt", headers={"Authorization": f"Bearer {read_token}"}, json=payload).status_code == 403
        written = client.put("/api/v1/receipt", headers={"Authorization": f"Bearer {writer_token}"}, json=payload)
        assert written.status_code == 200
        assert client.get("/api/v1/receipt", headers={"Authorization": f"Bearer {read_token}"}).status_code == 200
        assert client.put("/api/v1/settings", headers={"Authorization": f"Bearer {writer_token}"}, json={
            "mutationId": str(uuid4()), "expectedRevision": 0, "configured": False,
            "printPolicy": "confirm", "trustedTemplateIds": [], "actor": {"kind": "api"},
        }).status_code == 403
        assert csrf["X-CSRF-Token"]


def test_print_decision_is_idempotent_and_requires_approval_scope(tmp_path):
    store = BridgeStore(tmp_path)
    _, requester_token = store.create_token("requester", ["receipt:read", "receipt:write", "print:request", "print:status"])
    _, approver_token = store.create_token("approver", ["print:approve", "print:status"])
    app = create_app(tmp_path, manager=PrinterManager(store, transport_factory=SuccessfulTransport))
    artifact = make_png()
    with TestClient(app) as client:
        receipt_headers = {"Authorization": f"Bearer {requester_token}"}
        assert commit_receipt(client, receipt_headers).status_code == 200
        job_id = str(uuid4())
        metadata = {
            "id": job_id, "mutationId": str(uuid4()), "checksum": hashlib.sha256(artifact).hexdigest(),
            "rendererVersion": "test-v1", "expectedRevision": 0, "requester": {"kind": "mcp", "label": "Future MCP"},
            "width": 576, "height": 80,
        }
        created = client.post("/api/v1/print-requests", headers=receipt_headers, data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert created.json()["status"] == "awaiting_approval"
        decision = {"mutationId": str(uuid4()), "decision": "approve", "actor": {"kind": "human", "label": "Chat confirmation"}}
        assert client.post(f"/api/v1/print-requests/{job_id}/decision", headers=receipt_headers, json=decision).status_code == 403
        approved = client.post(f"/api/v1/print-requests/{job_id}/decision", headers={"Authorization": f"Bearer {approver_token}"}, json=decision)
        assert approved.status_code == 200
        replay = client.post(f"/api/v1/print-requests/{job_id}/decision", headers={"Authorization": f"Bearer {approver_token}"}, json=decision)
        assert replay.status_code == 200
        assert replay.headers["X-Idempotent-Replay"] == "true"


def test_application_state_and_events_survive_restart(tmp_path):
    store = BridgeStore(tmp_path)
    app = create_app(tmp_path, manager=PrinterManager(store, transport_factory=SuccessfulTransport))
    with TestClient(app) as client:
        headers = browser_session(client)
        assert commit_receipt(client, headers, proposed=3).status_code == 200
        current = client.get("/api/v1/settings").json()
        assert client.put("/api/v1/settings", headers=headers, json={
            "mutationId": str(uuid4()), "expectedRevision": current["revision"], "configured": True,
            "printPolicy": "confirm", "trustedTemplateIds": ["checklist"], "actor": {"kind": "human"},
        }).status_code == 200

    restarted = BridgeStore(tmp_path)
    assert restarted.receipt()["revision"] == 3
    assert restarted.settings()["print_policy"] == "confirm"
    events = restarted.events_after(0)
    assert [event["type"] for event in events] == ["receipt.updated", "settings.updated"]
    restarted.close()


def test_token_cli_writes_secret_once_with_owner_only_permissions(tmp_path):
    result = subprocess.run([
        sys.executable, "-m", "petes_printer_bridge.cli", "--data-dir", str(tmp_path),
        "--create-token", "codex", "--scope", "receipt:read", "--scope", "print:request",
    ], check=True, capture_output=True, text=True)
    record = json.loads(result.stdout)
    token_path = record["tokenFile"]
    assert os.stat(token_path).st_mode & 0o777 == 0o600
    secret = open(token_path, encoding="utf-8").read().strip()
    database_bytes = (tmp_path / "printer.sqlite3").read_bytes()
    assert secret.encode() not in database_bytes


def test_trusted_template_policy_queues_only_trusted_sources_and_rejection_is_terminal(tmp_path):
    store = BridgeStore(tmp_path)
    app = create_app(tmp_path, manager=PrinterManager(store, transport_factory=SuccessfulTransport))
    artifact = make_png()
    with TestClient(app) as client:
        headers = browser_session(client)
        assert commit_receipt(client, headers, source={"kind": "template", "id": "checklist", "revision": 1}).status_code == 200
        settings = client.get("/api/v1/settings").json()
        assert client.put("/api/v1/settings", headers=headers, json={
            "mutationId": str(uuid4()), "expectedRevision": settings["revision"], "configured": True,
            "printPolicy": "approved", "trustedTemplateIds": ["checklist"], "actor": {"kind": "human"},
        }).status_code == 200

        def request_metadata(revision):
            return {
                "id": str(uuid4()), "mutationId": str(uuid4()), "checksum": hashlib.sha256(artifact).hexdigest(),
                "rendererVersion": "test-v1", "expectedRevision": revision, "requester": {"kind": "mcp"},
                "width": 576, "height": 80,
            }

        trusted = request_metadata(0)
        assert client.post("/api/v1/print-requests", headers=headers, data={"metadata": json.dumps(trusted)}, files={"artifact": ("receipt.png", artifact, "image/png")}).status_code == 201
        assert client.get(f"/api/v1/print-requests/{trusted['id']}").json()["status"] == "succeeded"

        assert commit_receipt(client, headers, expected=0, proposed=1, source={"kind": "template", "id": "blank", "revision": 1}).status_code == 200
        untrusted = request_metadata(1)
        pending = client.post("/api/v1/print-requests", headers=headers, data={"metadata": json.dumps(untrusted)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert pending.json()["status"] == "awaiting_approval"
        rejected = client.post(f"/api/v1/print-requests/{untrusted['id']}/decision", headers=headers, json={
            "mutationId": str(uuid4()), "decision": "reject", "actor": {"kind": "human"},
        })
        assert rejected.json()["status"] == "rejected"
        assert client.post(f"/api/v1/print-requests/{untrusted['id']}/decision", headers=headers, json={
            "mutationId": str(uuid4()), "decision": "approve", "actor": {"kind": "human"},
        }).status_code == 409


def test_events_accept_a_query_session_token_but_writes_never_do(tmp_path):
    """EventSource cannot send headers, so the read-only stream takes the token in the
    query string. Nothing that mutates state may be authorized that way."""
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=SuccessfulTransport)
    app = create_app(tmp_path, manager=manager)
    with TestClient(app) as client:
        session = client.post("/api/v1/session").json()
        token = session["sessionToken"]
        client.cookies.clear()

        assert client.get("/api/v1/events?after=0").status_code == 401
        assert client.get("/api/v1/events?after=0&session=bogus.deadbeef").status_code == 401

        configuration = {"adapter": "virtual", "profileId": "80mm-576"}
        assert client.put(f"/api/v1/configuration?session={token}", json=configuration).status_code == 401
        assert client.get(f"/api/v1/receipt?session={token}").status_code == 401
