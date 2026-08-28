from __future__ import annotations

import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .models import BridgeConfiguration, PrintMetadata


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


class JobConflictError(Exception):
    pass


class BridgeStore:
    def __init__(self, data_directory: Path):
        self.data_directory = data_directory
        self.artifact_directory = data_directory / "artifacts"
        self.data_directory.mkdir(parents=True, exist_ok=True)
        self.artifact_directory.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(data_directory / "printer.sqlite3", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self.lock, self.connection:
            self.connection.executescript(
                """
                pragma journal_mode = WAL;
                create table if not exists configuration (
                  id integer primary key check (id = 1),
                  adapter text not null,
                  profile_id text not null,
                  updated_at text not null
                );
                create table if not exists print_jobs (
                  id text primary key,
                  checksum text not null,
                  renderer_version text not null,
                  document_json text not null,
                  artifact_path text not null,
                  width integer not null,
                  height integer not null,
                  feed_lines integer not null,
                  cut_mode text not null,
                  status text not null,
                  error text,
                  created_at text not null,
                  updated_at text not null
                );
                """
            )
            self.connection.execute(
                "insert or ignore into configuration (id, adapter, profile_id, updated_at) values (1, ?, ?, ?)",
                ("epson-tm-l90-usb", "80mm-576", now_iso()),
            )
            self.connection.execute(
                "update print_jobs set status = 'unknown', error = ?, updated_at = ? where status = 'sending'",
                ("The bridge restarted while this job was being transmitted; check the paper before reprinting.", now_iso()),
            )

    def configuration(self) -> BridgeConfiguration:
        with self.lock:
            row = self.connection.execute("select adapter, profile_id from configuration where id = 1").fetchone()
        return BridgeConfiguration(adapter=row["adapter"], profile_id=row["profile_id"])

    def save_configuration(self, configuration: BridgeConfiguration) -> BridgeConfiguration:
        with self.lock, self.connection:
            self.connection.execute(
                "update configuration set adapter = ?, profile_id = ?, updated_at = ? where id = 1",
                (configuration.adapter, configuration.profile_id, now_iso()),
            )
        return configuration

    def create_job(self, metadata: PrintMetadata, artifact: bytes, document_json: str) -> tuple[dict[str, Any], bool]:
        job_id = str(metadata.id)
        artifact_path = self.artifact_directory / f"{job_id}.png"
        with self.lock, self.connection:
            existing = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
            if existing:
                if existing["checksum"] != metadata.checksum:
                    raise JobConflictError("This job ID already belongs to a different artifact.")
                return dict(existing), True
            artifact_path.write_bytes(artifact)
            timestamp = now_iso()
            self.connection.execute(
                """insert into print_jobs
                (id, checksum, renderer_version, document_json, artifact_path, width, height, feed_lines, cut_mode, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)""",
                (job_id, metadata.checksum, metadata.rendererVersion, document_json, str(artifact_path), metadata.width, metadata.height, metadata.feedLines, metadata.cutMode, timestamp, timestamp),
            )
            row = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
        return dict(row), False

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
        return dict(row) if row else None

    def queued_jobs(self) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.connection.execute("select * from print_jobs where status = 'queued' order by created_at").fetchall()
        return [dict(row) for row in rows]

    def set_status(self, job_id: str, status: str, error: str | None = None) -> dict[str, Any]:
        with self.lock, self.connection:
            self.connection.execute("update print_jobs set status = ?, error = ?, updated_at = ? where id = ?", (status, error, now_iso(), job_id))
        job = self.get_job(job_id)
        if not job:
            raise KeyError(job_id)
        return job

    def close(self) -> None:
        with self.lock:
            self.connection.close()
