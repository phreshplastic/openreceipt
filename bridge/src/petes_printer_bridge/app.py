from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID, uuid5, NAMESPACE_URL

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
import httpx

from .application import ContractValidationError, LocalApplication
from .auth import AuthManager
from .models import ConfigurationRequest, PrintDecisionRequest, PrintMetadata, PrintRequestMetadata, ReceiptCommitRequest, SettingsUpdateRequest
from .service import ArtifactValidationError, PrinterManager
from .storage import BridgeStore, JobConflictError, PrintDecisionConflictError, RevisionConflictError, SettingsConflictError


def public_job(job: dict) -> dict:
    return {
        "id": job["id"],
        "status": job["status"],
        "checksum": job["checksum"],
        "error": job["error"],
        "receiptRevision": job.get("receipt_revision"),
        "receiptId": job.get("receipt_id"),
        "reason": job.get("reason"),
        "requester": json.loads(job["requester_json"]) if job.get("requester_json") else None,
        "document": json.loads(job["document_json"]) if job.get("document_json") else None,
        "width": job.get("width"),
        "height": job.get("height"),
        "createdAt": job["created_at"],
        "updatedAt": job["updated_at"],
    }


def error_response(status: int, code: str, message: str, **context) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message, **context}}, status_code=status)


def create_app(data_directory: Path, web_directory: Path | None = None, manager: PrinterManager | None = None, port: int = 8731) -> FastAPI:
    store = manager.store if manager else BridgeStore(data_directory)
    printer = manager or PrinterManager(store)
    local = LocalApplication(store, printer)
    allowed_origins = {
        origin.strip().rstrip("/")
        for origin in os.environ.get("PETES_PRINTER_ALLOWED_ORIGINS", "https://openreceipt.phreshplastic.com").split(",")
        if origin.strip()
    }
    allowed_origins.update({
        "http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173",
        "http://localhost:8731", "http://127.0.0.1:8731", "http://[::1]:8731",
    })
    allowed_origins.update({f"http://{host}:{port}" for host in ("localhost", "127.0.0.1", "[::1]")})
    auth = AuthManager(store, allowed_origins)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        printer.start()
        try:
            yield
        finally:
            await asyncio.to_thread(printer.stop)
            store.close()

    app = FastAPI(title="Pete's Printer bridge", version="1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Bridge-Session"],
    )

    @app.exception_handler(RequestValidationError)
    async def request_validation_error(_: Request, error: RequestValidationError):
        return error_response(422, "invalid_request", "The request does not match the API contract.", issues=jsonable_encoder(error.errors()))

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, error: HTTPException):
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found"}.get(error.status_code, "request_failed")
        return error_response(error.status_code, code, str(error.detail))

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["Origin-Agent-Cluster"] = "?1"
        response.headers["Permissions-Policy"] = "tools=(self)"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "public, max-age=0"
        return response

    @app.post("/api/v1/session")
    async def create_browser_session(request: Request, response: Response):
        origin = request.headers.get("origin", "").rstrip("/")
        return auth.create_session(response, cross_origin=origin in allowed_origins)

    @app.get("/healthz")
    async def health():
        return {"status": "ok", "workerAlive": bool(printer.worker and printer.worker.is_alive())}

    @app.get("/api/v1/status")
    async def status(request: Request):
        identity = auth.authorize(request, {"receipt:read"})
        result = await asyncio.to_thread(printer.capabilities)
        settings = local.read_settings()
        automatic = identity["kind"] != "api" or "print:automatic" in identity["scopes"]
        return result | {"configured": settings["configured"], "printPolicy": settings["printPolicy"] if automatic else "confirm"}

    @app.get("/api/v1/queue")
    async def queue(request: Request):
        auth.authorize(request, {"print:status"})
        return {"paused": store.queue_paused()}

    @app.put("/api/v1/queue")
    async def pause_queue(request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        payload = await request.json()
        if not isinstance(payload.get("paused"), bool):
            return error_response(422, "invalid_request", "paused must be a boolean.")
        store.pause_queue(payload["paused"])
        printer.wake.set()
        return {"paused": store.queue_paused()}

    @app.post("/api/v1/print-requests/{job_id}/cancel")
    async def cancel_print(job_id: UUID, request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        try:
            return public_job(store.cancel_job(str(job_id)))
        except KeyError:
            return error_response(404, "not_found", "Print job not found.")
        except PrintDecisionConflictError:
            return error_response(409, "sending", "A job already being sent cannot be cancelled.")

    async def render_document(document: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(os.environ.get("PETES_PRINTER_RENDER_URL", "http://127.0.0.1:8734") + "/render", json={"document": document})
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(503, "The receipt renderer is unavailable. Start the Node runtime.") from error

    @app.post("/api/v1/render")
    async def render_preview(request: Request):
        auth.authorize(request, {"receipt:read"}, unsafe=True)
        payload = await request.json()
        document = payload.get("document", {})
        errors = list(local.receipt_validator.iter_errors(document))
        if errors:
            return error_response(422, "invalid_receipt", errors[0].message)
        return await render_document(document)

    @app.get("/api/v1/receipts")
    async def receipts(request: Request):
        auth.authorize(request, {"receipt:read"})
        return {"items": [local.read_receipt(row["id"]) for row in store.list_receipts()]}

    @app.get("/api/v1/receipts/{receipt_id}")
    async def named_receipt(receipt_id: UUID, request: Request):
        auth.authorize(request, {"receipt:read"})
        found = local.read_receipt(str(receipt_id))
        return found if found else error_response(404, "receipt_not_found", "Receipt not found.")

    @app.put("/api/v1/receipts/{receipt_id}")
    async def commit_named_receipt(receipt_id: UUID, payload: ReceiptCommitRequest, request: Request):
        auth.authorize(request, {"receipt:write"}, unsafe=True)
        try:
            result, replay = await asyncio.to_thread(local.commit_receipt, payload, str(receipt_id))
            return JSONResponse(result, headers={"X-Idempotent-Replay": str(replay).lower()})
        except ContractValidationError as error:
            return error_response(422, "invalid_receipt", str(error))
        except RevisionConflictError:
            return error_response(409, "stale_revision", "The receipt changed.", current=local.read_receipt(str(receipt_id)))
        except JobConflictError as error:
            return error_response(409, "mutation_conflict", str(error))

    @app.get("/api/v1/templates")
    async def templates(request: Request):
        auth.authorize(request, {"receipt:read"})
        return {"items": store.list_templates()}

    @app.delete("/api/v1/receipts/{receipt_id}")
    async def archive_receipt(receipt_id: UUID, request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        store.archive_receipt(str(receipt_id))
        return {"archived": True}

    @app.delete("/api/v1/templates/{template_id}")
    async def delete_template(template_id: str, request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        store.delete_template(template_id)
        return {"deleted": True}

    @app.post("/api/v1/shelf/import")
    async def import_shelf(request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        payload = await request.json()
        imported = 0
        with store.lock:
            for item in payload.get("drafts", [])[:100]:
                document = item.get("document", {})
                if list(local.receipt_validator.iter_errors(document)) or store.receipt(document.get("id")):
                    continue
                commit = ReceiptCommitRequest(mutationId=uuid5(NAMESPACE_URL, f"openreceipt-import:{document['id']}"), expectedRevision=None, proposedRevision=0, document=document, actor={"kind": "human", "label": "Browser import"})
                local.commit_receipt(commit, document["id"])
                imported += 1
            existing = {item["name"] for item in store.list_templates()}
            for item in payload.get("templates", [])[:100]:
                document = item.get("document", {})
                name = item.get("name", "")
                if not name or len(name) > 80 or name in existing or list(local.receipt_validator.iter_errors(document)):
                    continue
                store.save_template(name, document)
                existing.add(name)
        return {"imported": imported}

    @app.post("/api/v1/receipts/{receipt_id}/open")
    async def open_saved_receipt(receipt_id: UUID, request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        with store.lock, store.connection:
            row = store.receipt(str(receipt_id))
            if not row:
                return error_response(404, "receipt_not_found", "Receipt not found.")
            store.connection.execute("insert into active_receipt values (1, ?, ?, ?, ?, ?, ?) on conflict(id) do update set document_json=excluded.document_json, source_json=excluded.source_json, revision=excluded.revision, checksum=excluded.checksum, created_at=excluded.created_at, updated_at=excluded.updated_at", (row["document_json"], row["source_json"], row["revision"], row["checksum"], row["created_at"], row["updated_at"]))
            store.add_event("receipt.updated", {"receiptId": str(receipt_id), "revision": row["revision"], "summary": "Opened a saved receipt"})
        return local.read_receipt()

    @app.post("/api/v1/templates")
    async def save_template(request: Request):
        auth.authorize(request, {"receipt:write"}, unsafe=True)
        payload = await request.json()
        name = payload.get("name")
        document = payload.get("document", {})
        errors = list(local.receipt_validator.iter_errors(document))
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80 or errors:
            return error_response(422, "invalid_template", "A template needs a name and valid receipt.")
        return store.save_template(name.strip(), document)

    @app.get("/api/v1/capabilities")
    async def capabilities():
        return await asyncio.to_thread(printer.capabilities)

    @app.put("/api/v1/configuration")
    async def configure(payload: ConfigurationRequest, request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        return await asyncio.to_thread(printer.configure, payload.profileId, payload.adapter)

    @app.get("/api/v1/receipt")
    async def get_receipt(request: Request):
        auth.authorize(request, {"receipt:read"})
        receipt = await asyncio.to_thread(local.read_receipt)
        if not receipt:
            return error_response(404, "receipt_not_initialized", "The shared receipt has not been initialized.")
        return receipt

    @app.put("/api/v1/receipt")
    async def put_receipt(payload: ReceiptCommitRequest, request: Request):
        auth.authorize(request, {"receipt:write"}, unsafe=True)
        try:
            result, replay = await asyncio.to_thread(local.commit_receipt, payload)
            return JSONResponse(result, headers={"X-Idempotent-Replay": str(replay).lower()})
        except ContractValidationError as error:
            return error_response(422, "invalid_receipt", str(error))
        except RevisionConflictError as error:
            return error_response(409, "stale_revision", "The receipt changed in another client.", current=local.read_receipt() if error.current else None)
        except JobConflictError as error:
            return error_response(409, "mutation_conflict", str(error))

    @app.get("/api/v1/settings")
    async def get_settings(request: Request):
        auth.authorize(request, set(), ui_only=True)
        return await asyncio.to_thread(local.read_settings)

    @app.put("/api/v1/settings")
    async def put_settings(payload: SettingsUpdateRequest, request: Request):
        auth.authorize(request, set(), unsafe=True, ui_only=True)
        try:
            result, replay = await asyncio.to_thread(local.update_settings, payload)
            return JSONResponse(result, headers={"X-Idempotent-Replay": str(replay).lower()})
        except SettingsConflictError:
            return error_response(409, "stale_settings", "Settings changed in another browser.", current=local.read_settings())
        except JobConflictError as error:
            return error_response(409, "mutation_conflict", str(error))

    @app.get("/api/v1/events")
    async def events(request: Request, after: int = 0):
        auth.authorize(request, {"events:read"}, allow_query_token=True)
        header = request.headers.get("last-event-id")
        cursor = max(after, int(header)) if header and header.isdigit() else after

        async def stream():
            nonlocal cursor
            heartbeat = 0
            while not await request.is_disconnected():
                found = await asyncio.to_thread(store.events_after, cursor)
                for event in found:
                    cursor = event["id"]
                    data = json.dumps(event["payload"], separators=(",", ":"))
                    yield f"id: {event['id']}\nevent: {event['type']}\ndata: {data}\n\n"
                heartbeat += 1
                if not found and heartbeat % 30 == 0:
                    yield ": keepalive\n\n"
                await asyncio.sleep(0.5)

        return StreamingResponse(stream(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"})

    @app.post("/api/v1/print-requests")
    async def create_print_request(background: BackgroundTasks, request: Request, metadata: str = Form(...), artifact: UploadFile = File(...)):
        auth.authorize(request, {"print:request"}, unsafe=True)
        try:
            parsed = PrintRequestMetadata.model_validate(json.loads(metadata))
            content = await artifact.read()

            def submit():
                # An upload can outlive its credential. Recheck authorization under
                # the same lock as insertion so revocation cannot miss this job.
                with store.lock:
                    identity = auth.authorize(request, {"print:request"}, unsafe=True)
                    automatic = identity["kind"] != "api" or "print:automatic" in identity["scopes"]
                    if identity["kind"] == "api":
                        parsed.requester.clientId = identity["tokenId"]
                    return local.create_print_request(parsed, content, automatic)

            job, replay = await asyncio.to_thread(submit)
            if not replay and job["status"] == "queued":
                background.add_task(printer.wake.set)
            return JSONResponse(public_job(job), status_code=200 if replay else 201, headers={"X-Idempotent-Replay": str(replay).lower()})
        except (json.JSONDecodeError, ValidationError) as error:
            return error_response(422, "invalid_request", str(error))
        except ArtifactValidationError as error:
            return error_response(422, "invalid_artifact", str(error))
        except RevisionConflictError:
            return error_response(409, "stale_revision", "The print request does not target the current receipt.", current=local.read_receipt())
        except JobConflictError as error:
            return error_response(409, "request_conflict", str(error))

    @app.get("/api/v1/print-requests")
    async def list_print_requests(request: Request, status: str | None = None):
        auth.authorize(request, {"print:status"})
        jobs = await asyncio.to_thread(local.list_print_requests, status)
        return {"items": [public_job(job) for job in jobs]}

    @app.get("/api/v1/print-requests/{job_id}")
    async def get_print_request(job_id: UUID, request: Request):
        auth.authorize(request, {"print:status"})
        job = await asyncio.to_thread(local.get_print_request, str(job_id))
        if not job:
            return error_response(404, "print_request_not_found", "Print request not found.")
        return public_job(job)

    @app.post("/api/v1/print-requests/{job_id}/decision")
    async def decide_print_request(job_id: UUID, payload: PrintDecisionRequest, request: Request, background: BackgroundTasks):
        auth.authorize(request, {"print:approve"}, unsafe=True)
        try:
            job, replay = await asyncio.to_thread(local.decide_print_request, str(job_id), payload)
            if not replay and job["status"] == "queued":
                background.add_task(printer.wake.set)
            return JSONResponse(public_job(job), headers={"X-Idempotent-Replay": str(replay).lower()})
        except KeyError:
            return error_response(404, "print_request_not_found", "Print request not found.")
        except PrintDecisionConflictError as error:
            return error_response(409, "decision_conflict", "This print request can no longer be decided.", current=public_job(error.current))
        except JobConflictError as error:
            return error_response(409, "mutation_conflict", str(error))

    @app.post("/api/v1/print-jobs")
    async def create_print_job(background: BackgroundTasks, request: Request, metadata: str = Form(...), artifact: UploadFile = File(...)):
        auth.authorize(request, {"print:direct"}, unsafe=True)
        try:
            parsed = PrintMetadata.model_validate(json.loads(metadata))
            content = await artifact.read()

            def submit():
                with store.lock:
                    auth.authorize(request, {"print:direct"}, unsafe=True)
                    return printer.create_job(parsed, content)

            job, duplicate = await asyncio.to_thread(submit)
            if not duplicate and job["status"] == "queued":
                background.add_task(printer.wake.set)
            return JSONResponse(public_job(job), status_code=200 if duplicate else 201, headers={"X-Idempotent-Replay": str(duplicate).lower()})
        except (json.JSONDecodeError, ValidationError) as error:
            return error_response(422, "invalid_request", str(error))
        except ArtifactValidationError as error:
            return error_response(422, "invalid_artifact", str(error))
        except JobConflictError as error:
            return error_response(409, "request_conflict", str(error))

    @app.get("/api/v1/print-jobs/{job_id}")
    async def get_print_job(job_id: UUID, request: Request):
        auth.authorize(request, {"print:status"})
        job = await asyncio.to_thread(store.get_job, str(job_id))
        if not job:
            return error_response(404, "print_request_not_found", "Print job not found.")
        return public_job(job)

    if web_directory and web_directory.exists():
        assets = web_directory / "assets"
        public_site = (web_directory / ".public-site").exists()
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{path:path}")
        async def web_app(path: str):
            requested = (web_directory / path).resolve()
            if path and requested.is_relative_to(web_directory.resolve()) and requested.is_file():
                return FileResponse(requested)
            directory_index = requested / "index.html"
            if path and requested.is_relative_to(web_directory.resolve()) and directory_index.is_file():
                return FileResponse(directory_index)
            if public_site:
                return FileResponse(web_directory / "404.html", status_code=404)
            return FileResponse(web_directory / "index.html")
    else:
        @app.get("/")
        async def root():
            return {"name": "Pete's Printer bridge", "detail": "Build the web app and pass --web-dist to serve it."}

    return app
