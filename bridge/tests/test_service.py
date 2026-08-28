from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
from uuid import uuid4

from PIL import Image

from petes_printer_bridge.models import PrintMetadata
from petes_printer_bridge.service import ArtifactValidationError, PrinterManager
from petes_printer_bridge.storage import BridgeStore, JobConflictError


class FakeTransport:
    def __init__(self, fail_prepare=False, fail_send=False):
        self.fail_prepare = fail_prepare
        self.fail_send = fail_send
        self.printed = False

    def prepare(self):
        if self.fail_prepare:
            raise OSError("printer absent")

    def print_image(self, image_bytes, feed_lines, cut_mode):
        self.printed = True
        if self.fail_send:
            raise OSError("connection lost")

    def close(self):
        pass


def png(width=576, height=80):
    output = io.BytesIO()
    Image.new("1", (width, height), 1).save(output, format="PNG")
    return output.getvalue()


def metadata(artifact, job_id=None):
    return PrintMetadata.model_validate({
        "id": str(job_id or uuid4()),
        "checksum": hashlib.sha256(artifact).hexdigest(),
        "rendererVersion": "test-v1",
        "document": {"schemaVersion": 1, "title": "Test"},
        "width": 576,
        "height": 80,
        "feedLines": 4,
        "cutMode": "full",
    })


def test_job_is_idempotent_and_conflicting_content_is_rejected(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=FakeTransport)
    artifact = png()
    value = metadata(artifact)
    first, duplicate = manager.create_job(value, artifact)
    second, replay = manager.create_job(value, artifact)
    assert not duplicate
    assert replay
    assert first["id"] == second["id"]
    changed = png(height=81)
    conflict = metadata(changed, value.id)
    conflict.height = 81
    try:
        manager.create_job(conflict, changed)
        raise AssertionError("expected conflict")
    except JobConflictError:
        pass


def test_checksum_and_dimensions_are_verified(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=FakeTransport)
    artifact = png()
    value = metadata(artifact)
    value.checksum = "0" * 64
    try:
        manager.create_job(value, artifact)
        raise AssertionError("expected checksum failure")
    except ArtifactValidationError:
        pass


def test_failures_before_and_after_sending_have_different_statuses(tmp_path):
    artifact = png()
    before_store = BridgeStore(tmp_path / "before")
    before_manager = PrinterManager(before_store, transport_factory=lambda: FakeTransport(fail_prepare=True))
    before, _ = before_manager.create_job(metadata(artifact), artifact)
    assert before_manager.process_job(before["id"])["status"] == "failed"

    after_store = BridgeStore(tmp_path / "after")
    after_manager = PrinterManager(after_store, transport_factory=lambda: FakeTransport(fail_send=True))
    after, _ = after_manager.create_job(metadata(artifact), artifact)
    assert after_manager.process_job(after["id"])["status"] == "unknown"


def test_restart_turns_sending_into_unknown(tmp_path):
    artifact = png()
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, transport_factory=FakeTransport)
    job, _ = manager.create_job(metadata(artifact), artifact)
    store.set_status(job["id"], "sending")
    store.close()
    restarted = BridgeStore(tmp_path)
    assert restarted.get_job(job["id"])["status"] == "unknown"
