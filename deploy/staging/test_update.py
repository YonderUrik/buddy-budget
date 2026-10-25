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
    def test_late_successful_ci_run_cannot_roll_back_a_newer_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "current.json").write_text(json.dumps({"deployment_id": 1, "version": "sha-" + "a" * 40}))
            target = {"id": 2, "sha": "b" * 40}
            with patch.object(update.sys, "argv", ["update.py", "--root", directory]):
                with patch.object(update, "candidate", return_value=target):
                    with patch.object(update, "fetch", return_value='{"status":"behind"}'):
                        with patch.object(update, "deploy") as deploy:
                            update.main()
                            deploy.assert_not_called()
            self.assertEqual(json.loads((root / "current.json").read_text())["deployment_id"], 1)

    def test_low_disk_prevents_pulling_images_on_shared_host(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(update.shutil, "disk_usage", return_value=type("Disk", (), {"free": 1024})()):
                with patch.object(update.subprocess, "run") as docker:
                    with self.assertRaisesRegex(RuntimeError, "Less than 5 GiB"):
                        update.deploy(Path(directory), Path(directory), "0.82.0", 1)
                    docker.assert_not_called()

    def test_scheduled_backup_fails_when_database_is_down(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(update.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout="")):
                with self.assertRaisesRegex(RuntimeError, "not running"):
                    update.backup_database(Path(directory), ["docker", "compose"], {}, required=True)

    def test_only_successful_main_candidates_are_eligible(self):
        deployments = [
            {"id": 3, "ref": "feature", "statuses_url": "ignored"},
            {"id": 2, "ref": "main", "statuses_url": "pending"},
            {"id": 1, "ref": "main", "statuses_url": "passed"},
        ]
        with patch.object(update, "fetch", side_effect=[json.dumps(deployments), '[{"state":"pending"}]', '[{"state":"success"}]']) as fetch:
            self.assertEqual(update.candidate()["id"], 1)
            self.assertEqual(fetch.call_count, 3)

    def test_manual_request_accepts_branch_and_requires_success(self):
        deployments = [
            {"id": 2, "ref": "feature", "statuses_url": "pending"},
            {"id": 1, "ref": "feature", "statuses_url": "passed"},
        ]
        with patch.object(update, "fetch", side_effect=[json.dumps(deployments), '[{"state":"pending"}]', '[{"state":"success"}]']) as fetch:
            self.assertEqual(update.candidate(manual=True)["id"], 1)
            self.assertIn("environment=staging-request", fetch.call_args_list[0].args[0])

    def test_completed_requests_do_not_fetch_statuses_again(self):
        with patch.object(update, "fetch", return_value='[{"id": 2}]') as fetch:
            self.assertIsNone(update.candidate(manual=True, after_id=2))
            self.assertEqual(fetch.call_count, 1)

    def test_manual_branch_reuses_reviewed_config_without_ancestry_check(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release = root / "reviewed-config"
            state = {"deployment_id": 1, "version": "sha-" + "a" * 40, "release": str(release)}
            (root / "current.json").write_text(json.dumps(state))
            target = {"id": 2, "sha": "b" * 40}
            with patch.object(update.sys, "argv", ["update.py", "--root", directory, "--manual-only"]):
                with patch.object(update, "candidate", return_value=target) as candidate:
                    with patch.object(update, "fetch") as fetch:
                        with patch.object(update, "deploy") as deploy:
                            update.main()
                            candidate.assert_called_once_with(manual=True, after_id=1)
                            fetch.assert_not_called()
                            deploy.assert_called_once_with(root.resolve(), release, "staging-" + "b" * 40, 2)

    def test_manual_request_is_not_redeployed_after_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "current.json").write_text('{"deployment_id": 2}')
            with patch.object(update.sys, "argv", ["update.py", "--root", directory, "--manual-only"]):
                with patch.object(update, "candidate", return_value={"id": 2}):
                    with patch.object(update, "deploy") as deploy:
                        update.main()
                        deploy.assert_not_called()

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
