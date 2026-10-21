// Publishes the local `public/screens/` on the `screenshots` branch as a normal commit on top of it (no force-push).
// For a PR that adds a screen: its CI pulls the branch and checks every screen has its images. The daily
// "Screenshot landing" run then replaces the branch with a single fresh commit, so this one does not stay in history.
// SCREENS_REMOTE and SCREENS_BRANCH as in pull-screens.mjs.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "screens");
const remote = process.env.SCREENS_REMOTE ?? "https://github.com/YonderUrik/buddy-budget.git";
const branch = process.env.SCREENS_BRANCH ?? "screenshots";
if (!existsSync(join(source, "manifest.json"))) throw new Error("public/screens/ has no manifest.json: capture or pull first");

const scratch = mkdtempSync(join(tmpdir(), "bb-screens-"));
try {
  const git = (...args) => execFileSync("git", ["-C", scratch, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
  git("init", "--quiet");
  git("fetch", "--quiet", "--depth=1", remote, branch);
  git("checkout", "--quiet", "-B", branch, "FETCH_HEAD");
  for (const entry of readdirSync(scratch)) if (entry !== ".git") rmSync(join(scratch, entry), { recursive: true, force: true });
  cpSync(source, scratch, { recursive: true });
  git("add", "--all");
  if (git("status", "--porcelain") === "") {
    console.log(`Nothing to publish: ${branch} already has these screenshots`);
  } else {
    git("commit", "--quiet", "-m", "chore: landing screenshots from a local capture");
    execFileSync("git", ["-C", scratch, "push", "--quiet", remote, `HEAD:refs/heads/${branch}`], { stdio: "inherit" });
    console.log(`Screenshots published on ${branch}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
