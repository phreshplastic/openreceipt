from __future__ import annotations

import hashlib
import io
import json
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
        "document": {"schemaVersion": 1, "title": "API receipt"},
        "width": 576,
        "height": 80,
        "feedLines": 4,
        "cutMode": "full",
    }
    with TestClient(app) as client:
        capabilities = client.get("/api/v1/capabilities")
        assert capabilities.status_code == 200
        assert capabilities.json()["connected"] is True

        first = client.post("/api/v1/print-jobs", data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
        assert first.status_code == 201
        assert first.json()["id"] == job_id

        status = client.get(f"/api/v1/print-jobs/{job_id}")
        assert status.status_code == 200
        assert status.json()["status"] == "succeeded"

        replay = client.post("/api/v1/print-jobs", data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")})
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
        assert client.post("/api/v1/print-jobs", data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", artifact, "image/png")}).status_code == 201
        changed = make_png(color=0)
        metadata["checksum"] = hashlib.sha256(changed).hexdigest()
        response = client.post("/api/v1/print-jobs", data={"metadata": json.dumps(metadata)}, files={"artifact": ("receipt.png", changed, "image/png")})
        assert response.status_code == 409
