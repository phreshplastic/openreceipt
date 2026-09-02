from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

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


def create_app(data_directory: Path, web_directory: Path | None = None, manager: PrinterManager | None = None) -> FastAPI:
    store = manager.store if manager else BridgeStore(data_directory)
    printer = manager or PrinterManager(store)
    local = LocalApplication(store, printer)
    auth = AuthManager(store)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        for job in store.queued_jobs():
            asyncio.create_task(asyncio.to_thread(printer.process_job, job["id"]))
        yield
        store.close()

    app = FastAPI(title="Pete's Printer bridge", version="1.0", lifespan=lifespan)

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
    async def create_browser_session(response: Response):
        return auth.create_session(response)

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
        auth.authorize(request, {"events:read"})
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
            job, replay = await asyncio.to_thread(local.create_print_request, parsed, content)
            if not replay and job["status"] == "queued":
                background.add_task(printer.process_job, job["id"])
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
                background.add_task(printer.process_job, job["id"])
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
            job, duplicate = await asyncio.to_thread(printer.create_job, parsed, content)
            if not duplicate and job["status"] == "queued":
                background.add_task(printer.process_job, job["id"])
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
