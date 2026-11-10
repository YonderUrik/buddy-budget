// String catalog model shared by export-strings and the platform generators.
// Format and rules: domain/formatting-localization.md §4–5.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SPEC_ROOT, readJSON, sha1 } from "./common.mjs";

export const LANGS = ["it", "en", "de"];
export const CATALOG_PATH = join(SPEC_ROOT, "strings", "catalog.json");
export const MOBILE_PATH = join(SPEC_ROOT, "strings", "mobile.json");

const PLACEHOLDER = /\{(\w+)\}/g; // same regex as the web's translate()

/** Placeholder names in order of first appearance. */
export function placeholders(text) {
  const out = [];
  for (const m of text.matchAll(PLACEHOLDER)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** snake_case ASCII slug, at most 40 chars. */
export function slug(text) {
  let s = text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (s.length > 40) s = s.slice(0, 40).replace(/_+$/, "");
  return s;
}

/** id = slug(English) + "_" + first 6 hex of sha1(Italian); valid Android resource name and Swift identifier. */
export function makeId(it, en) {
  const base = slug(en) || slug(it) || "s";
  const id = `${base}_${sha1(it).slice(0, 6)}`;
  return /^[a-z]/.test(id) ? id : `s_${id}`;
}

/** Placeholder sets per language; returns a description when they differ, else null. */
export function placeholderMismatch(entry) {
  const sets = LANGS.map((l) => placeholders(entry[l]).slice().sort().join(","));
  if (sets.every((s) => s === sets[0])) return null;
  return LANGS.map((l, i) => `${l}:{${sets[i]}}`).join(" ");
}

/** Build a canonical entry {id, it, en, de, placeholders}. */
export function canonical(it, en, de) {
  return { id: makeId(it, en), it, en, de, placeholders: placeholders(it) };
}

/** Throws on two different Italian sources sharing an id, or on duplicate Italian sources. */
export function checkCollisions(entries, label) {
  const byId = new Map();
  const bySource = new Map();
  for (const e of entries) {
    const prev = byId.get(e.id);
    if (prev && prev.it !== e.it) {
      throw new Error(`${label}: id collision ${e.id}: ${JSON.stringify(prev.it)} vs ${JSON.stringify(e.it)}`);
    }
    if (bySource.has(e.it)) throw new Error(`${label}: duplicate Italian source ${JSON.stringify(e.it)}`);
    byId.set(e.id, e);
    bySource.set(e.it, e);
  }
}

/** Catalog + mobile-only strings, merged and sorted by id. Used by both platform generators. */
export function loadMergedStrings() {
  if (!existsSync(CATALOG_PATH)) throw new Error(`${CATALOG_PATH} missing: run scripts/export-strings.mjs first`);
  const catalog = readJSON(CATALOG_PATH);
  const mobile = existsSync(MOBILE_PATH) ? readJSON(MOBILE_PATH) : { entries: [], aliases: [] };
  const mobileEntries = (mobile.entries ?? []).map((e) => {
    const c = canonical(e.it, e.en, e.de);
    if (e.id && e.id !== c.id) throw new Error(`mobile.json: stale id ${e.id} (expected ${c.id}); run export-strings`);
    return { ...c, mobileOnly: true };
  });
  const entries = [...catalog.entries, ...mobileEntries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  checkCollisions(entries, "catalog+mobile");
  const bySource = new Map(entries.map((e) => [e.it, e]));
  const aliases = (mobile.aliases ?? []).map((a) => {
    const e = bySource.get(a.it);
    if (!e) throw new Error(`mobile.json alias ${a.name}: no entry with Italian source ${JSON.stringify(a.it)}`);
    return { name: a.name, entry: e };
  });
  return { catalog, entries, aliases };
}

/**
 * Split a template into literal and placeholder parts.
 * Only names listed in `known` become placeholders; anything else stays literal (web behaviour:
 * unknown placeholders are left as-is).
 */
export function tokenize(text, known) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    const idx = known.indexOf(m[1]);
    if (idx < 0) continue;
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ arg: idx + 1 });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
