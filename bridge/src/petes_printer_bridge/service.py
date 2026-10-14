from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
from io import BytesIO
from pathlib import Path
from typing import Callable

from PIL import Image

from .models import BridgeConfiguration, PrintMetadata
from .storage import BridgeStore
from .transports import PrintTransport, create_dummy_transport, create_usb_transport


PROFILES = [
    {"id": "80mm-576", "label": "80 mm · 576 dots", "paperWidthMm": 80, "printableWidthDots": 576, "paddingDots": 28},
    {"id": "58mm-420", "label": "58 mm · 420 dots", "paperWidthMm": 58, "printableWidthDots": 420, "paddingDots": 22},
]


class ArtifactValidationError(Exception):
    pass


class PrinterManager:
    def __init__(self, store: BridgeStore, transport_factory: Callable[[], PrintTransport] | None = None):
        self.store = store
        self.transport_factory = transport_factory
        self.device_lock = threading.RLock()
        self.wake = threading.Event()
        self.stopping = threading.Event()
        self.worker: threading.Thread | None = None
        self.owner_file = None

    def start(self) -> None:
        import fcntl
        self.owner_file = (self.store.data_directory / "printer-worker.lock").open("a")
        try:
            fcntl.flock(self.owner_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.owner_file.close()
            raise RuntimeError("Another bridge already owns this printer queue.")
        self.store.recover_jobs()
        self.stopping.clear()
        self.worker = threading.Thread(target=self._run, name="openreceipt-printer", daemon=True)
        self.worker.start()

    def stop(self) -> None:
        self.stopping.set()
        self.wake.set()
        if self.worker:
            self.worker.join()
        if self.owner_file:
            self.owner_file.close()

    def _run(self) -> None:
        while not self.stopping.is_set():
            self.wake.clear()
            if not self.store.queue_paused():
                for job in self.store.queued_jobs():
                    if self.stopping.is_set() or self.store.queue_paused():
                        break
                    result = self.process_job(job["id"])
                    if result and result["status"] == "waiting_for_printer":
                        break
            self.wake.wait(2)

    def _use_virtual_transport(self) -> bool:
        if os.environ.get("PETES_PRINTER_TRANSPORT", "usb") == "dummy":
            return True
        return self.store.configuration().adapter == "virtual"

    def _transport(self) -> PrintTransport:
        if self.transport_factory:
            return self.transport_factory()
        if self._use_virtual_transport():
            return create_dummy_transport(self.store.data_directory / "last-print.bin")
        return create_usb_transport()

    def capabilities(self, probe: bool = True) -> dict:
        with self.device_lock:
            return self._capabilities(probe)

    def _capabilities(self, probe: bool) -> dict:
        configuration = self.store.configuration()
        virtual = self._use_virtual_transport()
        transport_name = "dummy" if virtual else "usb"
        connected = False
        detail = "Printer probe was skipped."
        code = "not_probed"
        if probe and virtual:
            connected = True
            detail = "Virtual file output is ready; no physical printer is connected."
            code = "virtual_ready"
        elif probe:
            transport = None
            try:
                transport = self._transport()
                transport.prepare()
                connected = True
                detail = "Bridge and printer are ready."
                code = "ready"
            except Exception as error:
                detail = str(error)[:240] or "The Epson TM-L90 was not detected."
                code = classify_usb_error(error)
            finally:
                try:
                    if transport:
                        transport.close()
                except Exception:
                    pass
        return {
            "connected": connected,
            "bridgeOnline": True,
            "printerConnected": connected and not virtual,
            "printerReady": connected,
            "code": code,
            "queuePaused": self.store.queue_paused(),
            "adapter": configuration.adapter if not virtual else "virtual",
            "model": "Epson TM-L90" if transport_name == "usb" else "Virtual printer (file output)",
            "transport": transport_name,
            "cutModes": ["full", "partial"],
            "profiles": PROFILES,
            "configuredProfileId": configuration.profile_id,
            "detail": detail,
        }

    def configure(self, profile_id: str, adapter: str = "epson-tm-l90-usb") -> dict:
        self.store.save_configuration(BridgeConfiguration(adapter=adapter, profile_id=profile_id))
        return self.capabilities()

    @staticmethod
    def validate_artifact(metadata: PrintMetadata, artifact: bytes) -> None:
        digest = hashlib.sha256(artifact).hexdigest()
        if digest != metadata.checksum:
            raise ArtifactValidationError(f"Artifact checksum mismatch: expected {metadata.checksum}, got {digest}.")
        try:
            with Image.open(BytesIO(artifact)) as image:
                if image.format != "PNG":
                    raise ArtifactValidationError("Print artifacts must be PNG images.")
                if image.size != (metadata.width, metadata.height):
                    raise ArtifactValidationError(f"Artifact dimensions {image.size} do not match the job metadata.")
        except ArtifactValidationError:
            raise
        except Exception as error:
            raise ArtifactValidationError("The print artifact is not a readable PNG image.") from error

    def create_job(self, metadata: PrintMetadata, artifact: bytes) -> tuple[dict, bool]:
        self.validate_artifact(metadata, artifact)
        return self.store.create_job(metadata, artifact, json.dumps(metadata.document, separators=(",", ":"), sort_keys=True))

    def process_job(self, job_id: str) -> dict:
        with self.device_lock:
            return self._process_job(job_id)

    def _process_job(self, job_id: str) -> dict:
        job = self.store.get_job(job_id)
        if not job or job["status"] not in {"queued", "waiting_for_printer"} or self.store.queue_paused():
            return job
        try:
            artifact = Path(job["artifact_path"]).read_bytes()
        except OSError as error:
            return self._set_status(job_id, "failed", f"Stored artifact unavailable: {error}", pending_only=True)
        transport = None
        try:
            transport = self._transport()
            transport.prepare()
        except Exception as error:
            try:
                if transport:
                    transport.close()
            except Exception:
                pass
            message = f"{classify_usb_error(error)}: {str(error)[:500]}"
            if job["status"] == "waiting_for_printer" and job["error"] == message:
                return job
            return self._set_status(job_id, "waiting_for_printer", message, pending_only=True)

        if not self.store.claim_job(job_id):
            try:
                transport.close()
            except Exception:
                logging.getLogger(__name__).warning("USB cleanup failed for unclaimed job %s", job_id, exc_info=True)
            return self.store.get_job(job_id)
        self.store.add_event("print_request.updated", {"id": job_id, "status": "sending"})
        try:
            transport.print_image(artifact, job["feed_lines"], job["cut_mode"])
            transport.close()
        except Exception as error:
            try:
                transport.close()
            except Exception:
                pass
            return self._set_status(job_id, "unknown", f"Transmission failed after sending began: {str(error)[:500]}")
        return self._set_status(job_id, "succeeded")

    def _set_status(self, job_id: str, status: str, error: str | None = None, pending_only: bool = False) -> dict:
        job = self.store.set_status(job_id, status, error, pending_only)
        self.store.add_event("print_request.updated", {"id": job_id, "status": job["status"], "error": job["error"]})
        return job


def classify_usb_error(error: Exception) -> str:
    detail = str(error).lower()
    errno = getattr(error, "errno", None)
    if errno in {13, -3} or "access denied" in detail or "permission" in detail:
        return "usb_permission_denied"
    if errno in {16, -6} or "busy" in detail or "claimed" in detail:
        return "usb_interface_busy"
    if "backend" in detail or "libusb" in detail:
        return "usb_backend_unavailable"
    if "not found" in detail or "absent" in detail or "not detected" in detail:
        return "usb_device_missing"
    return "usb_connection_failed"
