from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .models import ConfigurationRequest, PrintMetadata
from .service import ArtifactValidationError, PrinterManager
from .storage import BridgeStore, JobConflictError


def public_job(job: dict) -> dict:
    return {
        "id": job["id"],
        "status": job["status"],
        "checksum": job["checksum"],
        "error": job["error"],
        "createdAt": job["created_at"],
        "updatedAt": job["updated_at"],
    }


def create_app(data_directory: Path, web_directory: Path | None = None, manager: PrinterManager | None = None) -> FastAPI:
    store = manager.store if manager else BridgeStore(data_directory)
    printer = manager or PrinterManager(store)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        for job in store.queued_jobs():
            asyncio.create_task(asyncio.to_thread(printer.process_job, job["id"]))
        yield
        store.close()

    app = FastAPI(title="Pete's Printer bridge", version="1.0", lifespan=lifespan)

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["Origin-Agent-Cluster"] = "?1"
        response.headers["Permissions-Policy"] = "tools=(self)"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "public, max-age=0"
        return response

    @app.get("/api/v1/capabilities")
    async def capabilities():
        return await asyncio.to_thread(printer.capabilities)

    @app.put("/api/v1/configuration")
    async def configure(request: ConfigurationRequest):
        return await asyncio.to_thread(printer.configure, request.profileId)

    @app.post("/api/v1/print-jobs")
    async def create_print_job(background: BackgroundTasks, metadata: str = Form(...), artifact: UploadFile = File(...)):
        try:
            parsed = PrintMetadata.model_validate(json.loads(metadata))
            content = await artifact.read()
            job, duplicate = await asyncio.to_thread(printer.create_job, parsed, content)
            if not duplicate and job["status"] == "queued":
                background.add_task(printer.process_job, job["id"])
            return JSONResponse(public_job(job), status_code=200 if duplicate else 201, headers={"X-Idempotent-Replay": str(duplicate).lower()})
        except (json.JSONDecodeError, ValidationError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except ArtifactValidationError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        except JobConflictError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.get("/api/v1/print-jobs/{job_id}")
    async def get_print_job(job_id: UUID):
        job = await asyncio.to_thread(store.get_job, str(job_id))
        if not job:
            raise HTTPException(status_code=404, detail="Print job not found.")
        return public_job(job)

    if web_directory and web_directory.exists():
        assets = web_directory / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{path:path}")
        async def web_app(path: str):
            requested = (web_directory / path).resolve()
            if path and requested.is_relative_to(web_directory.resolve()) and requested.is_file():
                return FileResponse(requested)
            return FileResponse(web_directory / "index.html")
    else:
        @app.get("/")
        async def root():
            return {"name": "Pete's Printer bridge", "detail": "Build the web app and pass --web-dist to serve it."}

    return app
