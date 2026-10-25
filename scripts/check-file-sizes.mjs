#!/usr/bin/env node
/**
 * Keeps the repository light: fails when a change adds heavy files that belong elsewhere.
 * Rules (decision 2026-10-25, docs/decisioni/2026-10-25-readme-e-documentazione-per-il-lancio.md):
 * - an image, video, audio or archive over MEDIA_LIMIT_BYTES;
 * - more than PR_MEDIA_LIMIT_BYTES of such files in one change (a folder of screenshots);
 * - images or videos under docs/: screenshots for a PR go in its description, landing screenshots on the `screenshots` branch;
 * - any file over FILE_LIMIT_BYTES.
 * Paths listed in .github/large-files-allow.txt (one glob per line, `#` comments) are exempt.
 * Usage: node scripts/check-file-sizes.mjs <base-ref> (compares the files changed since the merge base with HEAD).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const MEDIA_LIMIT_BYTES = 300 * 1024;
const PR_MEDIA_LIMIT_BYTES = 1024 * 1024;
const FILE_LIMIT_BYTES = 5 * 1024 * 1024;
const MEDIA_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?|psd|mp4|mov|webm|mkv|mp3|wav|ogg|zip|tar|gz|7z|pdf)$/i;
const VISUAL_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?|mp4|mov|webm|mkv)$/i;
const ALLOW_FILE = ".github/large-files-allow.txt";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

/** Turns a glob with `*` and `**` into a regular expression on the whole path. */
function globToRegExp(glob) {
  const source = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${source}$`);
}

const base = process.argv[2];
if (!base) {
  process.stderr.write("Usage: node scripts/check-file-sizes.mjs <base-ref>\n");
  process.exit(2);
}

const allowed = existsSync(ALLOW_FILE)
  ? readFileSync(ALLOW_FILE, "utf8").split("\n").map((line) => line.replace(/#.*/, "").trim()).filter(Boolean).map(globToRegExp)
  : [];
const changed = git("diff", "--name-only", "--diff-filter=AM", `${git("merge-base", base, "HEAD")}`, "HEAD").split("\n").filter(Boolean);

const problems = [];
let mediaTotal = 0;
for (const path of changed) {
  if (allowed.some((pattern) => pattern.test(path))) continue;
  const size = Number(git("cat-file", "-s", `HEAD:${path}`));
  const media = MEDIA_EXTENSIONS.test(path);
  if (media) mediaTotal += size;
  if (size > FILE_LIMIT_BYTES) problems.push(`${path}: ${kb(size)}, over the ${kb(FILE_LIMIT_BYTES)} limit for any file`);
  else if (media && size > MEDIA_LIMIT_BYTES) problems.push(`${path}: ${kb(size)}, over the ${kb(MEDIA_LIMIT_BYTES)} limit for images, videos and archives`);
  if (VISUAL_EXTENSIONS.test(path) && path.startsWith("docs/")) problems.push(`${path}: images and videos do not go in docs/ (attach them to the PR description)`);
}
if (mediaTotal > PR_MEDIA_LIMIT_BYTES) problems.push(`${kb(mediaTotal)} of images, videos and archives in this change, over the ${kb(PR_MEDIA_LIMIT_BYTES)} limit`);

if (problems.length) {
  process.stdout.write(`The repository would get heavier than it should:\n${problems.map((p) => `- ${p}`).join("\n")}\n\n`);
  process.stdout.write(`Screenshots for a PR go in its description; landing screenshots go on the screenshots branch (pnpm screens:push).\nIf a file really has to be in the repository, add its path to ${ALLOW_FILE} in the same PR and say why.\n`);
  process.exit(1);
}
process.stdout.write(`${changed.length} changed files checked, ${kb(mediaTotal)} of media: within the limits.\n`);
