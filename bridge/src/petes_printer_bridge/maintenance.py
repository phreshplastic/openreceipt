from pathlib import Path
import sqlite3
import tarfile
import tempfile


def backup(data: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        snapshot = Path(temporary) / "printer.sqlite3"
        source = sqlite3.connect(f"file:{data / 'printer.sqlite3'}?mode=ro", uri=True)
        target = sqlite3.connect(snapshot)
        source.backup(target)
        source.close()
        target.close()
        with tarfile.open(destination, "w:gz") as archive:
            archive.add(snapshot, arcname="printer.sqlite3")
            for name in ("artifacts", "tokens", "session-secret"):
                path = data / name
                if path.exists():
                    archive.add(path, arcname=name)
    destination.chmod(0o600)


def restore(data: Path, source: Path) -> None:
    # Refuse an accidental overwrite. Restore into a new volume for rollback.
    if (data / "printer.sqlite3").exists():
        raise ValueError("Restore requires an empty data directory. Keep the old volume for rollback.")
    data.mkdir(parents=True, exist_ok=True)
    with tarfile.open(source, "r:gz") as archive:
        archive.extractall(data, filter="data")
    connection = sqlite3.connect(data / "printer.sqlite3")
    with connection:
        for job_id, path in connection.execute("select id, artifact_path from print_jobs"):
            connection.execute("update print_jobs set artifact_path=? where id=?", (str(data / "artifacts" / Path(path).name), job_id))
    connection.close()
