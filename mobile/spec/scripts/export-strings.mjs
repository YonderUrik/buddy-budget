#!/usr/bin/env node
// Export the web string catalogs into strings/catalog.json (canonical, see domain/formatting-localization.md §5)
// and normalize strings/mobile.json (fills in `id` and `placeholders`).
//
// Usage: node scripts/export-strings.mjs [web-repo-path]   (default: ../buddy-budget next to this repo)
// The web repo is only read.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SPEC_ROOT, readJSON, requireDir, sha1, writeOut } from "./lib/common.mjs";
import { CATALOG_PATH, LANGS, MOBILE_PATH, canonical, checkCollisions, placeholderMismatch } from "./lib/strings.mjs";

const web = requireDir(process.argv[2] ?? resolve(SPEC_ROOT, "..", "buddy-budget"), "web repo");
const locDir = join(web, "lib", "localization");
const en = readJSON(join(locDir, "catalogs", "en.json"));
const de = readJSON(join(locDir, "catalogs", "de.json"));

/** Entries declared inline in messages.ts: `"<it>": ["<en>", "<de>"],` (double-quoted, JSON-compatible literals). */
function inlineMessages() {
  const src = readFileSync(join(locDir, "messages.ts"), "utf8");
  const start = src.indexOf("export const messages");
  const end = src.indexOf("\n};", start);
  if (start < 0 || end < 0) throw new Error("messages.ts: cannot find the `messages` object");
  const body = src.slice(start, end);
  const str = String.raw`"(?:[^"\\]|\\.)*"`;
  const re = new RegExp(String.raw`^\s*(${str})\s*:\s*\[\s*(${str})\s*,\s*(${str})\s*\]\s*,?\s*$`, "gm");
  const out = [];
  for (const m of body.matchAll(re)) out.push([JSON.parse(m[1]), JSON.parse(m[2]), JSON.parse(m[3])]);
  return out;
}

const warnings = [];
const sources = new Map(); // it -> {en, de}
for (const [it, english] of Object.entries(en)) {
  sources.set(it, { en: english, de: de[it] ?? english });
  if (!(it in de)) warnings.push(`missing de for ${JSON.stringify(it)} (falls back to en, as the web does)`);
}
for (const it of Object.keys(de)) if (!(it in en)) warnings.push(`de-only key ignored: ${JSON.stringify(it)}`);
const inline = inlineMessages();
for (const [it, english, german] of inline) sources.set(it, { en: english, de: german }); // inline wins, like the object spread

const entries = [];
for (const [it, t] of sources) {
  if (it.trim() === "") {
    warnings.push(`skipped empty source key ${JSON.stringify(it)}`);
    continue;
  }
  for (const l of ["en", "de"]) if (!t[l]) warnings.push(`empty ${l} for ${JSON.stringify(it)}`);
  entries.push(canonical(it, t.en || it, t.de || t.en || it));
}
entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
checkCollisions(entries, "web catalog");

const mismatches = [];
for (const e of entries) {
  const mm = placeholderMismatch(e);
  if (mm) mismatches.push(`${e.id}: ${mm}`);
}

let webSha = "unknown";
try {
  webSha = execFileSync("git", ["-C", web, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["-C", web, "status", "--porcelain", "--", "lib/localization"], { encoding: "utf8" }).trim();
  if (dirty) {
    webSha += "-dirty";
    warnings.push("web lib/localization has uncommitted changes; catalog reflects the working tree");
  }
} catch {}

const contentHash = sha1(JSON.stringify(entries)).slice(0, 12);
const catalog = {
  version: `web@${webSha}+${contentHash}`,
  generatedBy: "scripts/export-strings.mjs",
  source: "buddy-budget lib/localization/catalogs/{en,de}.json + messages.ts inline entries",
  sourceLanguage: "it",
  languages: LANGS,
  count: entries.length,
  placeholderMismatches: mismatches,
  entries,
};

/** One entry per line keeps diffs readable for 4 000+ entries. */
function serialize(obj, listKey) {
  const { [listKey]: list, ...head } = obj;
  const headJson = JSON.stringify(head, null, 2).replace(/\n}$/, "");
  const items = list.map((e) => `    ${JSON.stringify(e)}`).join(",\n");
  return `${headJson},\n  "${listKey}": [\n${items}\n  ]\n}\n`;
}

console.log("export-strings");
writeOut(CATALOG_PATH, serialize(catalog, "entries"));

// Normalize mobile.json (mobile-only strings, same entry format; merged by the generators).
const mobile = readJSON(MOBILE_PATH);
const webSources = new Set(entries.map((e) => e.it));
const mobileEntries = mobile.entries.map((e) => {
  if (webSources.has(e.it)) throw new Error(`mobile.json: ${JSON.stringify(e.it)} already exists in the web catalog; remove it`);
  const c = canonical(e.it, e.en, e.de);
  const mm = placeholderMismatch(c);
  if (mm) mismatches.push(`${c.id} (mobile): ${mm}`);
  return { id: c.id, it: c.it, en: c.en, de: c.de, placeholders: c.placeholders, ...(e.note ? { note: e.note } : {}) };
});
checkCollisions([...entries, ...mobileEntries], "catalog+mobile");
writeOut(MOBILE_PATH, JSON.stringify({ ...mobile, entries: mobileEntries }, null, 2) + "\n");

console.log(`  ${entries.length} web entries (${inline.length} inline from messages.ts), ${mobileEntries.length} mobile-only`);
console.log(`  ${entries.filter((e) => e.placeholders.length).length} entries with placeholders`);
for (const w of warnings) console.log(`  warning: ${w}`);
if (mismatches.length) {
  console.log(`  PLACEHOLDER MISMATCHES (${mismatches.length}):`);
  for (const m of mismatches) console.log(`    ${m}`);
} else console.log("  placeholder check: all languages match");
