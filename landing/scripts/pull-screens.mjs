// Downloads the app screenshots for the landing from the `screenshots` branch into `public/screens/`.
// The images are not on `main`: the branch holds a single commit that the "Screenshot landing" workflow replaces at
// every capture, so the repository keeps one copy of them instead of every version (see docs/landing-screens.md).
// `--if-missing` does nothing when the screenshots are already there (used by dev, typecheck, test and build).
// SCREENS_REMOTE and SCREENS_BRANCH change where they come from (default: this repository on GitHub).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "screens");
const remote = process.env.SCREENS_REMOTE ?? "https://github.com/YonderUrik/buddy-budget.git";
const branch = process.env.SCREENS_BRANCH ?? "screenshots";

if (process.argv.includes("--if-missing") && existsSync(join(target, "manifest.json"))) process.exit(0);

// A throwaway repository: nothing is added to the clone the command runs in.
const scratch = mkdtempSync(join(tmpdir(), "bb-screens-"));
try {
  const git = (...args) => execFileSync("git", ["-C", scratch, ...args], { stdio: ["ignore", "ignore", "inherit"] });
  git("init", "--quiet");
  git("fetch", "--quiet", "--depth=1", remote, branch);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  git(`--work-tree=${target}`, "checkout", "FETCH_HEAD", "--", ".");
  console.log(`Screenshots from ${branch} in public/screens/`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
