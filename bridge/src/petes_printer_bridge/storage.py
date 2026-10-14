from __future__ import annotations

import sqlite3
import threading
import json
import secrets
import hashlib
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
        existing_database = (data_directory / "printer.sqlite3").exists()
        self.connection = sqlite3.connect(data_directory / "printer.sqlite3", check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        version = self.connection.execute("pragma user_version").fetchone()[0]
        if existing_database and version < 5:
            backup = sqlite3.connect(data_directory / f"printer-before-v5-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}.sqlite3")
            self.connection.backup(backup)
            backup.close()
        self._initialize()

    def _initialize(self) -> None:
        with self.lock, self.connection:
            self.connection.executescript(
                """
                pragma journal_mode = WAL;
                create table if not exists queue_control (
                  id integer primary key check (id=1), paused integer not null default 0
                );
                insert or ignore into queue_control (id, paused) values (1, 0);
                create table if not exists receipts (
                  id text primary key, document_json text not null, source_json text,
                  revision integer not null, checksum text not null,
                  created_at text not null, updated_at text not null
                );
                create table if not exists templates (
                  id text primary key, name text not null unique, document_json text not null,
                  created_at text not null
                );
                create table if not exists archived_receipts (id text primary key);
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
                create table if not exists active_receipt (
                  id integer primary key check (id = 1),
                  document_json text not null,
                  source_json text,
                  revision integer not null,
                  checksum text not null,
                  created_at text not null,
                  updated_at text not null
                );
                create table if not exists app_settings (
                  id integer primary key check (id = 1),
                  revision integer not null,
                  initialized integer not null,
                  configured integer not null,
                  print_policy text not null,
                  trusted_template_ids_json text not null,
                  default_location text not null default '',
                  default_unit text not null default 'celsius',
                  printer_profile_json text not null default '{}',
                  updated_at text not null
                );
                create table if not exists mutations (
                  id text primary key,
                  payload_checksum text not null,
                  result_json text not null,
                  created_at text not null
                );
                create table if not exists events (
                  id integer primary key autoincrement,
                  type text not null,
                  payload_json text not null,
                  created_at text not null
                );
                create table if not exists api_tokens (
                  id text primary key,
                  name text not null,
                  token_hash text not null unique,
                  scopes_json text not null,
                  created_at text not null,
                  revoked_at text
                );
                """
            )
            columns = {row["name"] for row in self.connection.execute("pragma table_info(print_jobs)")}
            additions = {
                "receipt_revision": "integer",
                "reason": "text",
                "requester_json": "text",
                "decision_id": "text",
                "decided_at": "text",
                "receipt_id": "text",
            }
            for name, kind in additions.items():
                if name not in columns:
                    self.connection.execute(f"alter table print_jobs add column {name} {kind}")
            settings_columns = {row["name"] for row in self.connection.execute("pragma table_info(app_settings)")}
            settings_additions = {
                "default_location": "text not null default ''",
                "default_unit": "text not null default 'celsius'",
                "printer_profile_json": "text not null default '{}'",
            }
            for name, kind in settings_additions.items():
                if name not in settings_columns:
                    self.connection.execute(f"alter table app_settings add column {name} {kind}")
            self.connection.execute(
                "insert or ignore into configuration (id, adapter, profile_id, updated_at) values (1, ?, ?, ?)",
                ("epson-tm-l90-usb", "80mm-576", now_iso()),
            )
            self.connection.execute(
                """insert or ignore into app_settings
                (id, revision, initialized, configured, print_policy, trusted_template_ids_json,
                 default_location, default_unit, printer_profile_json, updated_at)
                values (1, 0, 0, 0, 'confirm', '[]', '', 'celsius', '{}', ?)""",
                (now_iso(),),
            )
            current = self.connection.execute("select * from active_receipt where id=1").fetchone()
            if current:
                document = json.loads(current["document_json"])
                if document.get("id"):
                    self.connection.execute("insert or ignore into receipts values (?, ?, ?, ?, ?, ?, ?)",
                        (document["id"], current["document_json"], current["source_json"], current["revision"],
                         current["checksum"], current["created_at"], current["updated_at"]))
            self.connection.execute("pragma user_version = 5")

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

    def create_job(
        self,
        metadata: PrintMetadata,
        artifact: bytes,
        document_json: str,
        *,
        initial_status: str = "queued",
        receipt_revision: int | None = None,
        reason: str | None = None,
        requester_json: str | None = None,
    ) -> tuple[dict[str, Any], bool]:
        job_id = str(metadata.id)
        artifact_path = self.artifact_directory / f"{job_id}.png"
        with self.lock, self.connection:
            existing = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
            if existing:
                if existing["checksum"] != metadata.checksum:
                    raise JobConflictError("This job ID already belongs to a different artifact.")
                if existing["document_json"] != document_json or existing["feed_lines"] != metadata.feedLines or existing["cut_mode"] != metadata.cutMode:
                    raise JobConflictError("This job ID already belongs to a different print request.")
                return dict(existing), True
            artifact_path.write_bytes(artifact)
            timestamp = now_iso()
            self.connection.execute(
                """insert into print_jobs
                (id, checksum, renderer_version, document_json, artifact_path, width, height, feed_lines, cut_mode, status,
                 receipt_revision, reason, requester_json, created_at, updated_at, receipt_id)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (job_id, metadata.checksum, metadata.rendererVersion, document_json, str(artifact_path), metadata.width,
                 metadata.height, metadata.feedLines, metadata.cutMode, initial_status, receipt_revision, reason,
                 requester_json, timestamp, timestamp, metadata.document.get("id")),
            )
            row = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
        return dict(row), False

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
        return dict(row) if row else None

    def queued_jobs(self) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.connection.execute("select * from print_jobs where status in ('queued', 'waiting_for_printer') order by created_at, id").fetchall()
        return [dict(row) for row in rows]

    def list_jobs(self, status: str | None = None) -> list[dict[str, Any]]:
        with self.lock:
            if status:
                rows = self.connection.execute(
                    "select * from print_jobs where status = ? order by created_at desc", (status,)
                ).fetchall()
            else:
                rows = self.connection.execute("select * from print_jobs order by created_at desc").fetchall()
        return [dict(row) for row in rows]

    def set_status(self, job_id: str, status: str, error: str | None = None, pending_only: bool = False) -> dict[str, Any]:
        with self.lock, self.connection:
            condition = " and status in ('queued','waiting_for_printer')" if pending_only else ""
            self.connection.execute("update print_jobs set status = ?, error = ?, updated_at = ? where id = ?" + condition, (status, error, now_iso(), job_id))
        job = self.get_job(job_id)
        if not job:
            raise KeyError(job_id)
        return job

    def receipt(self, receipt_id: str | None = None) -> dict[str, Any] | None:
        with self.lock:
            row = self.connection.execute("select * from receipts where id=?", (receipt_id,)).fetchone() if receipt_id else self.connection.execute("select * from active_receipt where id = 1").fetchone()
        return dict(row) if row else None

    def queue_paused(self) -> bool:
        with self.lock:
            return bool(self.connection.execute("select paused from queue_control where id=1").fetchone()[0])

    def pause_queue(self, paused: bool) -> None:
        with self.lock, self.connection:
            self.connection.execute("update queue_control set paused=? where id=1", (int(paused),))
            self._append_event("queue.updated", {"paused": paused}, now_iso())

    def claim_job(self, job_id: str) -> bool:
        with self.lock, self.connection:
            changed = self.connection.execute("update print_jobs set status='sending', error=null, updated_at=? where id=? and status in ('queued','waiting_for_printer') and (select paused from queue_control where id=1)=0", (now_iso(), job_id))
            return changed.rowcount == 1

    def cancel_job(self, job_id: str) -> dict[str, Any]:
        with self.lock, self.connection:
            self.connection.execute("update print_jobs set status='cancelled', error=null, updated_at=? where id=? and status in ('queued','waiting_for_printer','awaiting_approval')", (now_iso(), job_id))
            job = self.get_job(job_id)
            if not job:
                raise KeyError(job_id)
            if job["status"] != "cancelled":
                raise PrintDecisionConflictError(job)
            self._append_event("print_request.updated", {"id": job_id, "status": "cancelled"}, now_iso())
            return job

    def recover_jobs(self) -> None:
        with self.lock, self.connection:
            self.connection.execute("update print_jobs set status='unknown', error=?, updated_at=? where status='sending'", ("The bridge restarted during transmission; check the paper before reprinting.", now_iso()))

    def list_receipts(self) -> list[dict[str, Any]]:
        with self.lock:
            return [dict(row) for row in self.connection.execute("select * from receipts where id not in (select id from archived_receipts) order by updated_at desc")]

    def archive_receipt(self, receipt_id: str) -> None:
        with self.lock, self.connection:
            self.connection.execute("insert or ignore into archived_receipts values (?)", (receipt_id,))
            self._append_event("shelf.updated", {"receiptId": receipt_id}, now_iso())

    def delete_template(self, template_id: str) -> None:
        with self.lock, self.connection:
            self.connection.execute("delete from templates where id=?", (template_id,))

    def list_templates(self) -> list[dict[str, Any]]:
        with self.lock:
            return [{"id": row["id"], "name": row["name"], "kind": "user", "document": json.loads(row["document_json"]), "createdAt": row["created_at"]} for row in self.connection.execute("select * from templates order by name")]

    def save_template(self, name: str, document: dict, template_id: str | None = None) -> dict:
        with self.lock, self.connection:
            existing = self.connection.execute("select id from templates where name=?", (name,)).fetchone()
            template_id = existing["id"] if existing else template_id or f"user:{secrets.token_hex(16)}"
            self.connection.execute("insert into templates values (?, ?, ?, ?) on conflict(id) do update set name=excluded.name, document_json=excluded.document_json", (template_id, name, json.dumps(document, sort_keys=True), now_iso()))
        return {"id": template_id, "name": name, "kind": "user", "updated": bool(existing)}

    def settings(self) -> dict[str, Any]:
        with self.lock:
            row = self.connection.execute("select * from app_settings where id = 1").fetchone()
        return dict(row)

    def mutation(self, mutation_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.connection.execute("select * from mutations where id = ?", (mutation_id,)).fetchone()
        return dict(row) if row else None

    def record_mutation(self, mutation_id: str, payload_checksum: str, result: dict[str, Any]) -> None:
        with self.lock, self.connection:
            existing = self.connection.execute("select * from mutations where id = ?", (mutation_id,)).fetchone()
            if existing:
                if existing["payload_checksum"] != payload_checksum:
                    raise JobConflictError("This mutation ID was already used for a different request.")
                return
            self.connection.execute(
                "insert into mutations (id, payload_checksum, result_json, created_at) values (?, ?, ?, ?)",
                (mutation_id, payload_checksum, json.dumps(result, separators=(",", ":")), now_iso()),
            )

    def commit_receipt(
        self,
        *,
        mutation_id: str,
        payload_checksum: str,
        expected_revision: int | None,
        proposed_revision: int,
        document_json: str,
        source_json: str | None,
        checksum: str,
        event_payload: dict[str, Any],
        receipt_id: str | None = None,
        expected_receipt_id: str | None = None,
    ) -> tuple[dict[str, Any], bool]:
        with self.lock, self.connection:
            replay = self.connection.execute("select * from mutations where id = ?", (mutation_id,)).fetchone()
            if replay:
                if replay["payload_checksum"] != payload_checksum:
                    raise JobConflictError("This mutation ID was already used for a different request.")
                return json.loads(replay["result_json"]), True
            current = self.receipt(receipt_id)
            if expected_receipt_id and current and json.loads(current["document_json"])["id"] != expected_receipt_id:
                raise RevisionConflictError(dict(current))
            actual_revision = current["revision"] if current else None
            if actual_revision != expected_revision:
                raise RevisionConflictError(dict(current) if current else None)
            timestamp = now_iso()
            created_at = current["created_at"] if current else timestamp
            document_id = json.loads(document_json)["id"]
            active = self.receipt()
            if receipt_id is None and active and document_id != json.loads(active["document_json"])["id"] and self.receipt(document_id):
                raise RevisionConflictError(dict(active))
            update_active = receipt_id is None or (active and json.loads(active["document_json"])["id"] == receipt_id)
            if update_active:
                self.connection.execute(
                """insert into active_receipt (id, document_json, source_json, revision, checksum, created_at, updated_at)
                values (1, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set document_json=excluded.document_json, source_json=excluded.source_json,
                revision=excluded.revision, checksum=excluded.checksum, updated_at=excluded.updated_at""",
                (document_json, source_json, proposed_revision, checksum, created_at, timestamp),
            )
            self.connection.execute("insert into receipts values (?, ?, ?, ?, ?, ?, ?) on conflict(id) do update set document_json=excluded.document_json, source_json=excluded.source_json, revision=excluded.revision, checksum=excluded.checksum, updated_at=excluded.updated_at", (document_id, document_json, source_json, proposed_revision, checksum, created_at, timestamp))
            self.connection.execute("delete from archived_receipts where id=?", (document_id,))
            stale_id = json.loads(current["document_json"])["id"] if current and not receipt_id else document_id
            stale_rows = self.connection.execute(
                "select id from print_jobs where status = 'awaiting_approval' and receipt_revision < ? and (receipt_id=? or receipt_id is null)",
                (proposed_revision, stale_id),
            ).fetchall()
            self.connection.execute(
                "update print_jobs set status='stale', error=?, updated_at=? where status='awaiting_approval' and receipt_revision < ? and (receipt_id=? or receipt_id is null)",
                ("The receipt changed before this request was approved.", timestamp, proposed_revision, stale_id),
            )
            result = {
                "document": json.loads(document_json),
                "source": json.loads(source_json) if source_json else None,
                "revision": proposed_revision,
                "checksum": checksum,
                "createdAt": created_at,
                "updatedAt": timestamp,
            }
            self.connection.execute(
                "insert into mutations (id, payload_checksum, result_json, created_at) values (?, ?, ?, ?)",
                (mutation_id, payload_checksum, json.dumps(result, separators=(",", ":")), timestamp),
            )
            self._append_event("receipt.updated" if update_active else "shelf.updated", event_payload | {"revision": proposed_revision, "receiptId": document_id, "checksum": checksum}, timestamp)
            for row in stale_rows:
                self._append_event("print_request.updated", {"id": row["id"], "status": "stale"}, timestamp)
        return result, False

    def update_settings(
        self,
        *,
        mutation_id: str,
        payload_checksum: str,
        expected_revision: int,
        configured: bool,
        print_policy: str,
        trusted_template_ids: list[str],
        default_location: str,
        default_unit: str,
        printer_profile: dict[str, Any],
        actor: dict[str, Any],
    ) -> tuple[dict[str, Any], bool]:
        with self.lock, self.connection:
            replay = self.connection.execute("select * from mutations where id = ?", (mutation_id,)).fetchone()
            if replay:
                if replay["payload_checksum"] != payload_checksum:
                    raise JobConflictError("This mutation ID was already used for a different request.")
                return json.loads(replay["result_json"]), True
            current = self.connection.execute("select * from app_settings where id = 1").fetchone()
            if current["revision"] != expected_revision:
                raise SettingsConflictError(dict(current))
            revision = expected_revision + 1
            timestamp = now_iso()
            trusted_json = json.dumps(sorted(set(trusted_template_ids)), separators=(",", ":"))
            profile_json = json.dumps(printer_profile, separators=(",", ":"))
            self.connection.execute(
                """update app_settings set revision=?, initialized=1, configured=?, print_policy=?,
                trusted_template_ids_json=?, default_location=?, default_unit=?, printer_profile_json=?, updated_at=? where id=1""",
                (revision, int(configured), print_policy, trusted_json, default_location, default_unit, profile_json, timestamp),
            )
            result = {
                "revision": revision,
                "initialized": True,
                "configured": configured,
                "printPolicy": print_policy,
                "trustedTemplateIds": json.loads(trusted_json),
                "defaultLocation": default_location,
                "defaultUnit": default_unit,
                "printerProfile": json.loads(profile_json),
                "updatedAt": timestamp,
            }
            self.connection.execute(
                "insert into mutations (id, payload_checksum, result_json, created_at) values (?, ?, ?, ?)",
                (mutation_id, payload_checksum, json.dumps(result, separators=(",", ":")), timestamp),
            )
            self._append_event("settings.updated", {"revision": revision, "actor": actor}, timestamp)
        return result, False

    def decide_job(self, job_id: str, mutation_id: str, decision: str, actor: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        payload_checksum = hashlib.sha256(f"{job_id}:{decision}".encode()).hexdigest()
        with self.lock, self.connection:
            replay = self.connection.execute("select * from mutations where id = ?", (mutation_id,)).fetchone()
            if replay:
                if replay["payload_checksum"] != payload_checksum:
                    raise JobConflictError("This mutation ID was already used for a different request.")
                return json.loads(replay["result_json"]), True
            job = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
            if not job:
                raise KeyError(job_id)
            if job["status"] != "awaiting_approval":
                raise PrintDecisionConflictError(dict(job))
            status = "queued" if decision == "approve" else "rejected"
            timestamp = now_iso()
            self.connection.execute(
                "update print_jobs set status=?, decision_id=?, decided_at=?, updated_at=? where id=?",
                (status, mutation_id, timestamp, timestamp, job_id),
            )
            self._append_event("print_request.updated", {"id": job_id, "status": status, "actor": actor}, timestamp)
            updated = self.connection.execute("select * from print_jobs where id = ?", (job_id,)).fetchone()
            result = dict(updated)
            self.connection.execute(
                "insert into mutations (id, payload_checksum, result_json, created_at) values (?, ?, ?, ?)",
                (mutation_id, payload_checksum, json.dumps(result), timestamp),
            )
        return dict(updated), False

    def add_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        timestamp = now_iso()
        with self.lock, self.connection:
            event_id = self._append_event(event_type, payload, timestamp)
        return {"id": event_id, "type": event_type, "payload": payload, "createdAt": timestamp}

    def _append_event(self, event_type: str, payload: dict[str, Any], timestamp: str) -> int:
        cursor = self.connection.execute(
            "insert into events (type, payload_json, created_at) values (?, ?, ?)",
            (event_type, json.dumps(payload, separators=(",", ":")), timestamp),
        )
        return int(cursor.lastrowid)

    def events_after(self, event_id: int, limit: int = 100) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.connection.execute(
                "select * from events where id > ? order by id limit ?", (event_id, limit)
            ).fetchall()
        return [
            {"id": row["id"], "type": row["type"], "payload": json.loads(row["payload_json"]), "createdAt": row["created_at"]}
            for row in rows
        ]

    def create_token(self, name: str, scopes: list[str]) -> tuple[dict[str, Any], str]:
        token_id = secrets.token_hex(8)
        secret = secrets.token_urlsafe(32)
        token = f"pp_{token_id}_{secret}"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        created_at = now_iso()
        with self.lock, self.connection:
            self.connection.execute(
                "insert into api_tokens (id, name, token_hash, scopes_json, created_at) values (?, ?, ?, ?, ?)",
                (token_id, name, token_hash, json.dumps(sorted(set(scopes))), created_at),
            )
        return {"id": token_id, "name": name, "scopes": sorted(set(scopes)), "createdAt": created_at}, token

    def token_for_bearer(self, token: str) -> dict[str, Any] | None:
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self.lock:
            row = self.connection.execute(
                "select * from api_tokens where token_hash = ? and revoked_at is null", (digest,)
            ).fetchone()
        return dict(row) if row else None

    def list_tokens(self) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.connection.execute(
                "select id, name, scopes_json, created_at, revoked_at from api_tokens order by created_at"
            ).fetchall()
        return [dict(row) for row in rows]

    def revoke_token(self, token_id: str) -> bool:
        with self.lock, self.connection:
            cursor = self.connection.execute(
                "update api_tokens set revoked_at = ? where id = ? and revoked_at is null", (now_iso(), token_id)
            )
            if cursor.rowcount:
                pending = self.connection.execute("select id from print_jobs where status in ('queued','waiting_for_printer','awaiting_approval') and json_extract(requester_json, '$.clientId')=?", (token_id,)).fetchall()
                for job in pending:
                    self.connection.execute("update print_jobs set status='cancelled', error='Requesting credential was revoked.', updated_at=? where id=?", (now_iso(), job['id']))
                    self._append_event("print_request.updated", {"id": job['id'], "status": "cancelled"}, now_iso())
        return cursor.rowcount > 0

    def close(self) -> None:
        with self.lock:
            self.connection.close()


class RevisionConflictError(Exception):
    def __init__(self, current: dict[str, Any] | None):
        self.current = current


class SettingsConflictError(Exception):
    def __init__(self, current: dict[str, Any]):
        self.current = current


class PrintDecisionConflictError(Exception):
    def __init__(self, current: dict[str, Any]):
        self.current = current
