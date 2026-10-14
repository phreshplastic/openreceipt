import hashlib
import importlib.util
import io
import json
import subprocess
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('setup_host', Path(__file__).parents[1] / 'setup-host.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class HostSetupTests(unittest.TestCase):
    def test_child_commands_cannot_consume_the_callers_input(self):
        with patch.object(setup.subprocess, 'run', return_value=subprocess.CompletedProcess(['docker'], 0, 'ok')) as child:
            self.assertEqual(setup.run(['docker', 'compose', 'exec', '-T', 'bridge', 'petes-printer']), 'ok')
            self.assertEqual(child.call_args.kwargs['stdin'], subprocess.DEVNULL)

    def test_private_files_are_atomic_and_owner_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'folder/runtime.env'
            setup.private_write(path, 'private fixture')
            setup.private_write(path, 'replacement fixture')
            self.assertEqual(path.read_text(), 'replacement fixture')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(list(path.parent.iterdir()), [path])

    def test_checksum_rejects_tampering_and_missing_entries(self):
        content = b'fixture binary'
        sums = f'{hashlib.sha256(content).hexdigest()}  official.zip\n'.encode()
        setup.verify_download(content, 'official.zip', sums)
        for altered, filename in [(b'changed', 'official.zip'), (content, 'missing.zip')]:
            with self.assertRaises(setup.SetupError):
                setup.verify_download(altered, filename, sums)

    def test_download_extracts_only_the_binary_and_reuses_verified_installation(self):
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as zipped:
            zipped.writestr('release/tunnel-client', b'fixture executable')
            zipped.writestr('../../outside', b'ignored')
        contents = archive.getvalue()
        filename = 'tunnel-client-v0.0.16-linux-arm64.zip'
        release = {'tag_name': 'v0.0.16', 'assets': [{'name': filename, 'browser_download_url': 'archive'}, {'name': 'SHA256SUMS.txt', 'browser_download_url': 'checksums'}]}
        responses = {'archive': contents, 'checksums': f'{hashlib.sha256(contents).hexdigest()}  {filename}\n'.encode()}
        def download(url):
            return responses[url] if url in responses else json.dumps(release).encode()
        with tempfile.TemporaryDirectory() as temporary, patch.object(setup.platform, 'system', return_value='Linux'), patch.object(setup.platform, 'machine', return_value='aarch64'), patch.object(setup, 'download', side_effect=download) as request:
            folder = Path(temporary) / 'custom home/tunnel'
            self.assertEqual(setup.install_client(folder, 'latest'), 'v0.0.16')
            self.assertFalse((Path(temporary) / 'outside').exists())
            self.assertEqual((folder / 'bin/tunnel-client').read_bytes(), b'fixture executable')
            self.assertEqual((folder / 'bin/tunnel-client').stat().st_mode & 0o777, 0o700)
            request.reset_mock()
            setup.install_client(folder, 'latest')
            self.assertEqual(request.call_count, 1)

    def test_service_uses_the_actual_user_and_custom_directory(self):
        text = setup.service_text('alex', Path('/srv/receipt setup/100%/tunnel'))
        self.assertIn('User=alex', text)
        self.assertIn('WorkingDirectory=/srv/receipt setup/100%%/tunnel\n', text)
        self.assertIn('"/srv/receipt setup/100%%/tunnel/bin/tunnel-client"', text)
        self.assertIn('Restart=always', text)
        self.assertNotIn('/home/', text)
        with self.assertRaises(setup.SetupError):
            setup.service_text('root', Path('/srv/tunnel'))

    def test_credential_retry_is_idempotent_and_never_silently_grants_automatic_printing(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'codex.token'
            record = {'id': '0123456789abcdef', 'scopes': setup.SCOPES}
            active = {'id': record['id'], 'scopes_json': json.dumps(record['scopes']), 'revoked_at': None}
            calls = []
            def docker(checkout, *arguments):
                calls.append(arguments)
                if '--create-token' in arguments:
                    return json.dumps(record)
                if '--list-tokens' in arguments:
                    return json.dumps([active])
                if arguments[0] == 'cp':
                    Path(arguments[2]).write_text('pp_0123456789abcdef_test_fixture')
                    return ''
                raise AssertionError(arguments)
            with patch.object(setup, 'docker', side_effect=docker):
                setup.credential(Path(temporary), destination, 'codex', False)
                setup.credential(Path(temporary), destination, 'codex', False)
                self.assertEqual(sum('--create-token' in call for call in calls), 1)
                with self.assertRaises(setup.SetupError):
                    setup.credential(Path(temporary), destination, 'codex', True)
                active['revoked_at'] = 'revoked'
                with self.assertRaises(setup.SetupError):
                    setup.credential(Path(temporary), destination, 'codex', False)
            self.assertEqual(destination.stat().st_mode & 0o777, 0o600)

    def test_activation_keeps_the_runtime_key_out_of_command_arguments(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'tunnel'
            checkout = Path(temporary) / 'checkout with spaces'
            key = 'sk-fake_fixture_never_a_real_key'
            with patch.object(setup.sys, 'stdin', io.StringIO(f'tunnel_fixture\n{key}\n')):
                setup.save_account(checkout, directory)
            calls = []
            def run(arguments, **options):
                calls.append((arguments, options))
                return ''
            with patch.object(setup, 'run', side_effect=run):
                setup.activate(checkout, directory, 'alex', 9876)
            self.assertFalse(any(key in str(arguments) for arguments, _ in calls))
            self.assertEqual(calls[0][1]['environment']['CONTROL_PLANE_API_KEY'], key)
            self.assertEqual((directory / 'runtime.env').stat().st_mode & 0o777, 0o600)
            self.assertIn('127.0.0.1:9876', str(calls[0][0]))


if __name__ == '__main__':
    unittest.main()
