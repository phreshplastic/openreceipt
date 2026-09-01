from __future__ import annotations

import hashlib
import json
from importlib.resources import files
from typing import Any

from jsonschema import Draft202012Validator

from .models import Actor, PrintDecisionRequest, PrintMetadata, PrintRequestMetadata, ReceiptCommitRequest, SettingsUpdateRequest
from .service import PrinterManager
from .storage import BridgeStore, JobConflictError, RevisionConflictError


MAX_REVISION_JUMP = 10_000


class ContractValidationError(Exception):
    pass


class LocalApplication:
    """Canonical local domain module. HTTP and future MCP are adapters around this interface."""

    def __init__(self, store: BridgeStore, printer: PrinterManager):
        self.store = store
        self.printer = printer
        schema_path = files("petes_printer_bridge").joinpath("receipt-document-v2.schema.json")
        self.receipt_validator = Draft202012Validator(json.loads(schema_path.read_text()))

    @staticmethod
    def _canonical(value: Any) -> str:
        return json.dumps(value, separators=(",", ":"), sort_keys=True)

    @classmethod
    def _checksum(cls, value: Any) -> str:
        return hashlib.sha256(cls._canonical(value).encode()).hexdigest()

    def read_receipt(self) -> dict[str, Any] | None:
        row = self.store.receipt()
        if not row:
            return None
        return {
            "document": json.loads(row["document_json"]),
            "source": json.loads(row["source_json"]) if row["source_json"] else None,
            "revision": row["revision"],
            "checksum": row["checksum"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def commit_receipt(self, request: ReceiptCommitRequest) -> tuple[dict[str, Any], bool]:
        errors = sorted(self.receipt_validator.iter_errors(request.document), key=lambda error: list(error.path))
        if errors:
            error = errors[0]
            path = ".".join(str(part) for part in error.path) or "document"
            raise ContractValidationError(f"{path}: {error.message}")
        current = self.store.receipt()
        current_revision = current["revision"] if current else None
        if not self.store.mutation(str(request.mutationId)):
            if request.proposedRevision <= (current_revision if current_revision is not None else -1):
                raise ContractValidationError("proposedRevision must be greater than the current revision.")
            base = current_revision if current_revision is not None else 0
            if request.proposedRevision - base > MAX_REVISION_JUMP:
                raise ContractValidationError(f"proposedRevision may advance by at most {MAX_REVISION_JUMP} revisions.")
        document_json = self._canonical(request.document)
        old_blocks = {block.get("id"): self._canonical(block) for block in json.loads(current["document_json"])["blocks"]} if current else {}
        current_ids = {block.get("id") for block in request.document["blocks"]}
        changed = [block.get("id") for block in request.document["blocks"] if old_blocks.get(block.get("id")) != self._canonical(block)]
        changed.extend(block_id for block_id in old_blocks if block_id not in current_ids)
        actor = request.actor.model_dump(exclude_none=True)
        payload = request.model_dump(mode="json")
        return self.store.commit_receipt(
            mutation_id=str(request.mutationId),
            payload_checksum=self._checksum(payload),
            expected_revision=request.expectedRevision,
            proposed_revision=request.proposedRevision,
            document_json=document_json,
            source_json=self._canonical(request.source.model_dump()) if request.source else None,
            checksum=hashlib.sha256(document_json.encode()).hexdigest(),
            event_payload={
                "mutationId": str(request.mutationId),
                "actor": actor,
                "summary": request.summary,
                "changedBlockIds": changed,
            },
        )

    def read_settings(self) -> dict[str, Any]:
        row = self.store.settings()
        return {
            "revision": row["revision"],
            "initialized": bool(row["initialized"]),
            "configured": bool(row["configured"]),
            "printPolicy": row["print_policy"],
            "trustedTemplateIds": json.loads(row["trusted_template_ids_json"]),
            "updatedAt": row["updated_at"],
        }

    def update_settings(self, request: SettingsUpdateRequest) -> tuple[dict[str, Any], bool]:
        payload = request.model_dump(mode="json")
        return self.store.update_settings(
            mutation_id=str(request.mutationId),
            payload_checksum=self._checksum(payload),
            expected_revision=request.expectedRevision,
            configured=request.configured,
            print_policy=request.printPolicy,
            trusted_template_ids=request.trustedTemplateIds,
            actor=request.actor.model_dump(exclude_none=True),
        )

    def create_print_request(self, metadata: PrintRequestMetadata, artifact: bytes) -> tuple[dict[str, Any], bool]:
        mutation_id = str(metadata.mutationId)
        mutation_checksum = self._checksum(metadata.model_dump(mode="json"))
        replay = self.store.mutation(mutation_id)
        if replay:
            if replay["payload_checksum"] != mutation_checksum:
                raise JobConflictError("This mutation ID was already used for a different request.")
            result = json.loads(replay["result_json"])
            replay_metadata = PrintMetadata(
                id=result["id"],
                checksum=metadata.checksum,
                rendererVersion=result["renderer_version"],
                document=json.loads(result["document_json"]),
                width=metadata.width,
                height=metadata.height,
                feedLines=metadata.feedLines,
                cutMode=metadata.cutMode,
            )
            self.printer.validate_artifact(replay_metadata, artifact)
            return result, True
        receipt = self.store.receipt()
        if not receipt or receipt["revision"] != metadata.expectedRevision:
            raise RevisionConflictError(receipt)
        generic = PrintMetadata(
            id=metadata.id,
            checksum=metadata.checksum,
            rendererVersion=metadata.rendererVersion,
            document=json.loads(receipt["document_json"]),
            width=metadata.width,
            height=metadata.height,
            feedLines=metadata.feedLines,
            cutMode=metadata.cutMode,
        )
        self.printer.validate_artifact(generic, artifact)
        settings = self.read_settings()
        source = json.loads(receipt["source_json"]) if receipt["source_json"] else None
        trusted = bool(
            settings["printPolicy"] == "approved"
            and source
            and source.get("kind") == "template"
            and source.get("id") in settings["trustedTemplateIds"]
        )
        status = "queued" if settings["printPolicy"] == "autonomous" or trusted else "awaiting_approval"
        job, replay = self.store.create_job(
            generic,
            artifact,
            receipt["document_json"],
            initial_status=status,
            receipt_revision=metadata.expectedRevision,
            reason=metadata.reason,
            requester_json=self._canonical(metadata.requester.model_dump(exclude_none=True)),
        )
        if not replay:
            self.store.record_mutation(mutation_id, mutation_checksum, job)
            self.store.add_event("print_request.updated", {"id": job["id"], "status": status, "requester": metadata.requester.model_dump(exclude_none=True)})
        return job, replay

    def decide_print_request(self, job_id: str, request: PrintDecisionRequest) -> tuple[dict[str, Any], bool]:
        return self.store.decide_job(job_id, str(request.mutationId), request.decision, request.actor.model_dump(exclude_none=True))

    def get_print_request(self, job_id: str) -> dict[str, Any] | None:
        return self.store.get_job(job_id)

    def list_print_requests(self, status: str | None = None) -> list[dict[str, Any]]:
        return self.store.list_jobs(status)
