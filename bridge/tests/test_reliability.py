from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import time
import pytest

from fastapi.testclient import TestClient

from petes_printer_bridge.app import create_app
from petes_printer_bridge.service import PrinterManager, classify_usb_error
from petes_printer_bridge.storage import BridgeStore
from test_service import FakeTransport, png, metadata
from test_app import browser_session, commit_receipt, receipt_document
import hashlib
import json
from petes_printer_bridge.maintenance import backup, restore


def test_concurrent_processing_sends_once_and_probe_does_not_interrupt(tmp_path):
    active = 0
    maximum = 0
    sent = []

    class Transport(FakeTransport):
        def prepare(self):
            nonlocal active, maximum
            active += 1
            maximum = max(maximum, active)

        def print_image(self, *args):
            time.sleep(0.01)
            sent.append(1)

        def close(self):
            nonlocal active
            active -= 1

    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, Transport)
    artifact = png()
    job, _ = manager.create_job(metadata(artifact), artifact)
    with ThreadPoolExecutor(8) as pool:
        futures = [pool.submit(manager.process_job, job['id']) for _ in range(7)]
        futures.append(pool.submit(manager.capabilities))
        for future in futures:
            future.result()
    assert sent == [1]
    assert maximum == 1


def test_waiting_job_survives_restart_and_pause_cancel_are_durable(tmp_path):
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, lambda: FakeTransport(fail_prepare=True))
    artifact = png()
    job, _ = manager.create_job(metadata(artifact), artifact)
    assert manager.process_job(job['id'])['status'] == 'waiting_for_printer'
    store.pause_queue(True)
    store.close()
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, FakeTransport)
    assert manager.process_job(job['id'])['status'] == 'waiting_for_printer'
    store.pause_queue(False)
    assert manager.process_job(job['id'])['status'] == 'succeeded'
    second, _ = manager.create_job(metadata(artifact), artifact)
    store.cancel_job(second['id'])
    assert manager.process_job(second['id'])['status'] == 'cancelled'


def test_named_receipts_have_independent_revisions_and_do_not_replace_editor(tmp_path):
    store = BridgeStore(tmp_path)
    with TestClient(create_app(tmp_path, manager=PrinterManager(store, FakeTransport))) as client:
        headers = browser_session(client)
        active = receipt_document('On screen')
        commit_receipt(client, headers, active)
        saved = receipt_document('Shopping')
        payload = {'mutationId': str(uuid4()), 'expectedRevision': None, 'proposedRevision': 0,
                   'document': saved, 'actor': {'kind': 'mcp'}}
        assert client.put(f"/api/v1/receipts/{saved['id']}", headers=headers, json=payload).status_code == 200
        payload |= {'mutationId': str(uuid4()), 'expectedRevision': 0, 'proposedRevision': 1}
        assert client.put(f"/api/v1/receipts/{saved['id']}", headers=headers, json=payload).status_code == 200
        payload['mutationId'] = str(uuid4())
        assert client.put(f"/api/v1/receipts/{saved['id']}", headers=headers, json=payload).status_code == 409
        assert client.get('/api/v1/receipt').json()['document'] == active
        assert len(client.get('/api/v1/receipts').json()['items']) == 2


def test_token_commands_do_not_recover_a_live_transmission(tmp_path):
    store = BridgeStore(tmp_path)
    artifact = png()
    job, _ = PrinterManager(store, FakeTransport).create_job(metadata(artifact), artifact)
    store.set_status(job['id'], 'sending')
    other = BridgeStore(tmp_path)
    other.create_token('reader', ['receipt:read'])
    assert store.get_job(job['id'])['status'] == 'sending'
    other.close()
    store.close()


def test_usb_diagnostics():
    assert classify_usb_error(PermissionError('access denied')) == 'usb_permission_denied'
    assert classify_usb_error(OSError(16, 'busy')) == 'usb_interface_busy'
    assert classify_usb_error(OSError('Device not found')) == 'usb_device_missing'


def test_cancel_during_failed_prepare_is_not_resurrected(tmp_path):
    from threading import Event, Thread
    entered, release = Event(), Event()
    class Transport(FakeTransport):
        def prepare(self):
            entered.set()
            release.wait(2)
            raise OSError('printer absent')
    store = BridgeStore(tmp_path)
    manager = PrinterManager(store, Transport)
    artifact = png()
    job, _ = manager.create_job(metadata(artifact), artifact)
    thread = Thread(target=manager.process_job, args=(job['id'],))
    thread.start()
    assert entered.wait(1)
    store.cancel_job(job['id'])
    release.set(); thread.join()
    assert store.get_job(job['id'])['status'] == 'cancelled'


def test_automatic_scope_is_enforced_and_revocation_takes_effect(tmp_path):
    store = BridgeStore(tmp_path)
    scopes = ['receipt:read', 'receipt:write', 'print:request', 'print:status']
    _, reviewer = store.create_token('reviewer', scopes)
    record, automatic = store.create_token('trusted', scopes + ['print:automatic'])
    with TestClient(create_app(tmp_path, manager=PrinterManager(store, FakeTransport))) as client:
        owner = browser_session(client)
        commit_receipt(client, owner)
        client.put('/api/v1/settings', headers=owner, json={'mutationId': str(uuid4()), 'expectedRevision': 0, 'configured': True, 'printPolicy': 'autonomous', 'actor': {'kind': 'human'}})
        artifact = png()
        def request(token):
            value = {'id': str(uuid4()), 'mutationId': str(uuid4()), 'checksum': hashlib.sha256(artifact).hexdigest(), 'rendererVersion': 'test', 'expectedRevision': 0, 'requester': {'kind': 'human'}, 'width': 576, 'height': 80}
            return client.post('/api/v1/print-requests', headers={'Authorization': f'Bearer {token}'}, data={'metadata': json.dumps(value)}, files={'artifact': ('test.png', artifact, 'image/png')})
        assert request(reviewer).json()['status'] == 'awaiting_approval'
        assert request(automatic).json()['status'] == 'queued'
        assert client.get('/api/v1/status', headers={'Authorization': f'Bearer {reviewer}'}).json()['printPolicy'] == 'confirm'
        store.revoke_token(record['id'])
        assert request(automatic).status_code == 401


def test_switching_receipts_at_same_revision_rejects_a_former_editor_commit(tmp_path):
    store = BridgeStore(tmp_path)
    with TestClient(create_app(tmp_path, manager=PrinterManager(store, FakeTransport))) as client:
        owner = browser_session(client)
        first = receipt_document('First')
        commit_receipt(client, owner, first)
        second = receipt_document('Second')
        payload = {'mutationId': str(uuid4()), 'expectedRevision': None, 'proposedRevision': 0, 'document': second, 'actor': {'kind': 'human'}}
        client.put(f"/api/v1/receipts/{second['id']}", headers=owner, json=payload)
        client.post(f"/api/v1/receipts/{second['id']}/open", headers=owner)
        payload |= {'mutationId': str(uuid4()), 'expectedRevision': 0, 'expectedReceiptId': first['id'], 'proposedRevision': 1, 'document': first}
        assert client.put('/api/v1/receipt', headers=owner, json=payload).status_code == 409
        assert client.get('/api/v1/receipt').json()['document'] == second


def test_backup_restores_artifacts_to_new_host_and_preserves_pending_jobs(tmp_path):
    store = BridgeStore(tmp_path / 'original')
    artifact = png()
    job, _ = PrinterManager(store, FakeTransport).create_job(metadata(artifact), artifact)
    destination = tmp_path / 'backup.tar.gz'
    backup(store.data_directory, destination)
    restore(tmp_path / 'restored', destination)
    restored = BridgeStore(tmp_path / 'restored')
    assert PrinterManager(restored, FakeTransport).process_job(job['id'])['status'] == 'succeeded'
    assert 'restored' in restored.get_job(job['id'])['artifact_path']


def test_usb_transport_uses_a_fresh_discovery_context_per_attempt(monkeypatch):
    import petes_printer_bridge.transports as transports
    from types import SimpleNamespace
    cached = SimpleNamespace(lib=object())
    contexts = []
    monkeypatch.setattr(transports.usb.backend.libusb1, 'get_backend', lambda: cached)
    def fresh(lib):
        assert lib is cached.lib
        context = object()
        contexts.append(context)
        return context
    monkeypatch.setattr(transports.usb.backend.libusb1, '_LibUSB', fresh)
    monkeypatch.setattr(transports, 'Usb', lambda *args, **kwargs: kwargs['usb_args']['backend'])
    assert transports.create_usb_transport().printer is not transports.create_usb_transport().printer
    assert len(contexts) == 2


def test_revocation_cancels_unsent_jobs_without_interrupting_transmission(tmp_path):
    store = BridgeStore(tmp_path)
    record, _ = store.create_token('agent', ['print:request', 'print:automatic'])
    artifact = png()
    manager = PrinterManager(store, FakeTransport)
    jobs = []
    for status in ('queued', 'waiting_for_printer', 'awaiting_approval', 'sending'):
        value = metadata(artifact)
        job, _ = manager.create_job(value, artifact)
        store.connection.execute('update print_jobs set requester_json=? where id=?', (json.dumps({'clientId': record['id']}), job['id']))
        store.connection.commit()
        store.set_status(job['id'], status)
        jobs.append(job)
    assert store.revoke_token(record['id'])
    assert [store.get_job(job['id'])['status'] for job in jobs] == ['cancelled', 'cancelled', 'cancelled', 'sending']
    store.close()


def test_existing_unversioned_database_is_backed_up_before_migration(tmp_path):
    import sqlite3
    connection = sqlite3.connect(tmp_path / 'printer.sqlite3')
    connection.execute('create table legacy_marker (value text)')
    connection.execute("insert into legacy_marker values ('preserved')")
    connection.commit()
    connection.close()
    store = BridgeStore(tmp_path)
    copies = list(tmp_path.glob('printer-before-v5-*.sqlite3'))
    assert len(copies) == 1
    previous = sqlite3.connect(copies[0])
    assert previous.execute('select value from legacy_marker').fetchone()[0] == 'preserved'
    assert previous.execute('pragma user_version').fetchone()[0] == 0
    previous.close()
    store.close()


def test_active_replacement_cannot_overwrite_another_saved_receipt(tmp_path):
    store = BridgeStore(tmp_path)
    with TestClient(create_app(tmp_path, manager=PrinterManager(store, FakeTransport))) as client:
        owner = browser_session(client)
        active = receipt_document('In the editor')
        commit_receipt(client, owner, active)
        saved = receipt_document('Independent shopping list')
        request = {'mutationId': str(uuid4()), 'expectedRevision': None, 'proposedRevision': 5, 'document': saved, 'actor': {'kind': 'mcp'}}
        assert client.put(f"/api/v1/receipts/{saved['id']}", headers=owner, json=request).status_code == 200
        request |= {'mutationId': str(uuid4()), 'expectedRevision': 0, 'proposedRevision': 1}
        assert client.put('/api/v1/receipt', headers=owner, json=request).status_code == 409
        assert client.get(f"/api/v1/receipts/{saved['id']}").json()['revision'] == 5
        assert client.get('/api/v1/receipt').json()['document']['id'] == active['id']


def test_cancelled_job_close_error_does_not_stop_the_queue_worker(tmp_path):
    from threading import Event
    store = BridgeStore(tmp_path)
    artifact = png()
    completed = Event()
    first_id = None
    cancelled = False

    class Transport(FakeTransport):
        def prepare(self):
            nonlocal cancelled
            self.close_error = not cancelled
            if self.close_error:
                store.cancel_job(first_id)
                cancelled = True

        def print_image(self, *args):
            completed.set()

        def close(self):
            if self.close_error:
                raise OSError('USB disappeared while releasing the cancelled job')

    manager = PrinterManager(store, Transport)
    first, _ = manager.create_job(metadata(artifact), artifact)
    first_id = first['id']
    manager.create_job(metadata(artifact), artifact)
    manager.start()
    try:
        assert completed.wait(2), 'The next job must still be sent after USB cleanup fails.'
        assert manager.worker.is_alive()
        assert store.get_job(first_id)['status'] == 'cancelled'
    finally:
        manager.stop()
        store.close()


@pytest.mark.parametrize('endpoint', ['print-requests', 'print-jobs'])
def test_credential_revoked_during_upload_cannot_submit_a_job(tmp_path, monkeypatch, endpoint):
    from starlette.datastructures import UploadFile
    store = BridgeStore(tmp_path)
    record, token = store.create_token('agent', ['print:request', 'print:automatic', 'print:direct'])
    manager = PrinterManager(store, FakeTransport)
    original_read = UploadFile.read

    async def read_after_revocation(upload, *args, **kwargs):
        if upload.filename == 'revocation.png':
            store.revoke_token(record['id'])
        return await original_read(upload, *args, **kwargs)

    monkeypatch.setattr(UploadFile, 'read', read_after_revocation)
    with TestClient(create_app(tmp_path, manager=manager)) as client:
        owner = browser_session(client)
        commit_receipt(client, owner)
        store.pause_queue(True)
        artifact = png()
        value = metadata(artifact).model_dump(mode='json') if endpoint == 'print-jobs' else {'id': str(uuid4()), 'mutationId': str(uuid4()), 'checksum': hashlib.sha256(artifact).hexdigest(), 'rendererVersion': 'test', 'expectedRevision': 0, 'requester': {'kind': 'mcp'}, 'width': 576, 'height': 80}
        response = client.post('/api/v1/' + endpoint, headers={'Authorization': f'Bearer {token}'}, data={'metadata': json.dumps(value)}, files={'artifact': ('revocation.png', artifact, 'image/png')})
        assert response.status_code == 401
        assert store.list_jobs() == []
