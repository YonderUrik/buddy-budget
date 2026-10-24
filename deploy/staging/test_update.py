"""Critical staging rollout guarantees, without contacting Docker or GitHub."""
import gzip
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("staging_update", Path(__file__).with_name("update.py"))
update = importlib.util.module_from_spec(spec)
spec.loader.exec_module(update)


class RolloutTests(unittest.TestCase):
    def test_only_successful_main_candidates_are_eligible(self):
        deployments = [
            {"id": 3, "ref": "feature", "statuses_url": "ignored"},
            {"id": 2, "ref": "main", "statuses_url": "pending"},
            {"id": 1, "ref": "main", "statuses_url": "passed"},
        ]
        with patch.object(update, "fetch", side_effect=[json.dumps(deployments), '[{"state":"pending"}]', '[{"state":"success"}]']) as fetch:
            self.assertEqual(update.candidate()["id"], 1)
            self.assertEqual(fetch.call_count, 3)

    def test_backup_is_valid_gzip_and_retains_seven(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            backups = root / "backups"
            backups.mkdir()
            for i in range(8):
                (backups / f"2000010{i}.sql.gz").write_bytes(b"old")

            def docker(command, **kwargs):
                if "pg_dump" in command:
                    kwargs["stdout"].write(b"CREATE TABLE staging_test(id integer);\n")
                return subprocess.CompletedProcess(command, 0, stdout="container-id\n")

            with patch.object(update.subprocess, "run", side_effect=docker):
                update.backup_database(root, ["docker", "compose"], {})
            files = sorted(backups.glob("*.sql.gz"))
            self.assertEqual(len(files), 7)
            self.assertIn(b"CREATE TABLE", gzip.decompress(files[-1].read_bytes()))
            self.assertEqual(list(backups.glob("*.sql")), [])

    def test_failed_dump_prevents_rollout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls = []

            def docker(command, **kwargs):
                calls.append(command)
                if "pg_dump" in command:
                    raise subprocess.CalledProcessError(1, command)
                return subprocess.CompletedProcess(command, 0, stdout="container-id\n")

            with patch.object(update.subprocess, "run", side_effect=docker):
                with self.assertRaises(subprocess.CalledProcessError):
                    update.deploy(root, root, "0.82.0", 10)
            self.assertFalse(any("up" in command for command in calls))
            self.assertFalse((root / "current.json").exists())

    def test_failed_readiness_preserves_last_successful_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = '{"deployment_id": 7, "version": "0.81.0"}'
            (root / "current.json").write_text(old)

            def docker(command, **kwargs):
                if "up" in command:
                    raise subprocess.CalledProcessError(1, command)
                return subprocess.CompletedProcess(command, 0, stdout="")

            with patch.object(update.subprocess, "run", side_effect=docker):
                with self.assertRaises(subprocess.CalledProcessError):
                    update.deploy(root, root, "0.82.0", 10)
            self.assertEqual((root / "current.json").read_text(), old)

    def test_success_is_recorded_after_readiness(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def docker(command, **kwargs):
                self.assertFalse((root / "current.json").exists())
                return subprocess.CompletedProcess(command, 0, stdout="")

            with patch.object(update.subprocess, "run", side_effect=docker):
                update.deploy(root, root, "0.82.0", 10)
            self.assertEqual(json.loads((root / "current.json").read_text())["deployment_id"], 10)


if __name__ == "__main__":
    unittest.main()
