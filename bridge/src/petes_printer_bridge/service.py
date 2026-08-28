from __future__ import annotations

import hashlib
import json
import os
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

    def _transport(self) -> PrintTransport:
        if self.transport_factory:
            return self.transport_factory()
        if os.environ.get("PETES_PRINTER_TRANSPORT", "usb") == "dummy":
            return create_dummy_transport(self.store.data_directory / "last-print.bin")
        return create_usb_transport()

    def capabilities(self, probe: bool = True) -> dict:
        configuration = self.store.configuration()
        transport_name = "dummy" if os.environ.get("PETES_PRINTER_TRANSPORT", "usb") == "dummy" else "usb"
        connected = False
        detail = "Printer probe was skipped."
        if probe:
            transport = self._transport()
            try:
                transport.prepare()
                connected = True
                detail = "Bridge and printer are ready."
            except Exception as error:
                detail = str(error)[:240] or "The Epson TM-L90 was not detected."
            finally:
                try:
                    transport.close()
                except Exception:
                    pass
        return {
            "connected": connected,
            "adapter": "dummy" if transport_name == "dummy" else configuration.adapter,
            "model": "Epson TM-L90" if transport_name == "usb" else "Dummy file transport",
            "transport": transport_name,
            "cutModes": ["full", "partial"],
            "profiles": PROFILES,
            "configuredProfileId": configuration.profile_id,
            "detail": detail,
        }

    def configure(self, profile_id: str) -> dict:
        self.store.save_configuration(BridgeConfiguration(profile_id=profile_id))
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
        job = self.store.get_job(job_id)
        if not job or job["status"] != "queued":
            return job
        transport = self._transport()
        try:
            transport.prepare()
        except Exception as error:
            try:
                transport.close()
            except Exception:
                pass
            return self.store.set_status(job_id, "failed", f"Printer unavailable before transmission: {str(error)[:500]}")

        self.store.set_status(job_id, "sending")
        try:
            artifact = Path(job["artifact_path"]).read_bytes()
            transport.print_image(artifact, job["feed_lines"], job["cut_mode"])
            transport.close()
        except Exception as error:
            try:
                transport.close()
            except Exception:
                pass
            return self.store.set_status(job_id, "unknown", f"Transmission failed after sending began: {str(error)[:500]}")
        return self.store.set_status(job_id, "succeeded")
