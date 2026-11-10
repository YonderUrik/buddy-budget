#!/usr/bin/env node
// Run every generator: web catalogs → strings/catalog.json → iOS + Android strings, tokens, fonts and icons.
//
// Usage: node scripts/sync-all.mjs <ios-path> <android-path> [web-path] [--check]
//   web-path defaults to ../buddy-budget next to this repo (only read, never modified).
//   --check  writes nothing and exits 1 if any generated file is out of date (for CI).
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { SPEC_ROOT } from "./lib/common.mjs";

const args = process.argv.slice(2);
const check = args.includes("--check");
const [ios, android, web] = args.filter((a) => a !== "--check");
if (!ios || !android) {
  console.error("usage: node scripts/sync-all.mjs <ios-path> <android-path> [web-path] [--check]");
  process.exit(1);
}

const steps = [
  ["export-strings.mjs", web ? [web] : []],
  ["gen-strings-ios.mjs", [ios]],
  ["gen-strings-android.mjs", [android]],
  ["gen-tokens.mjs", [ios, android]],
  ["export-icons.mjs", web ? [web] : []],
  ["gen-icons.mjs", [ios, android]],
];

let failed = false;
for (const [script, scriptArgs] of steps) {
  const r = spawnSync(process.execPath, [join(SPEC_ROOT, "scripts", script), ...scriptArgs], {
    stdio: "inherit",
    env: { ...process.env, BB_SYNC_CHECK: check ? "1" : "0" },
  });
  if (r.status !== 0) {
    failed = true;
    console.error(`${script} failed (exit ${r.status})`);
    if (!check) process.exit(r.status ?? 1);
  }
}
if (failed) process.exit(1);
console.log(check ? "sync-all: everything is up to date" : "sync-all: done");
