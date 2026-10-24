// Writes `page-dates.json`: for every page of the landing, the date of the last commit that changed its own content.
// The sitemap (`lastmod`) and the pages' structured data (`dateModified`) read it. A page's content is its `page.tsx`
// plus the files it imports, minus the site-wide ones (nav, footer, layout helpers, shared constants): those change for
// every page at once, and a date that moves on all pages together tells search engines nothing (the reason the build
// date was dropped in #494).
// It needs the full git history: in a shallow clone, or without git (the Docker build), it keeps an existing file and
// otherwise writes nothing, so the sitemap goes without `lastmod` instead of carrying wrong dates.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUT = join(ROOT, "page-dates.json");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Route of a `page.tsx` relative to `app/`: route groups such as `(it)` are not part of the address. */
export function routeOf(pageFile) {
  const segments = pageFile.split("/").slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
  return `/${segments.join("/")}`;
}

/** Local imports of a source file (`@/…` and relative), as written. */
export function importsOf(source) {
  const specs = [];
  for (const m of source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) if (m[1].startsWith("@/") || m[1].startsWith(".")) specs.push(m[1]);
  return specs;
}

function resolveImport(fromFile, spec) {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : resolve(dirname(fromFile), spec);
  if (/\.(tsx?|mjs|js)$/.test(base) && existsSync(base)) return base;
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext;
  return null;
}

function closure(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(readFileSync(file, "utf8"))) {
      const target = resolveImport(file, spec);
      if (target && !target.includes("node_modules")) stack.push(target);
    }
  }
  return seen;
}

function pageFiles(dir = join(ROOT, "app")) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return pageFiles(path);
    return e.name === "page.tsx" ? [path] : [];
  });
}

/**
 * Files that make up each page's content. A file counts for a page when at most half of the pages use it: through any
 * import, or directly from their `page.tsx` (so the legal texts still date the legal pages, although the footer
 * imports their paths from the same file on every page).
 */
export function contentFiles(pages) {
  const half = pages.length / 2;
  const deep = new Map();
  const direct = new Map();
  const count = (map, file) => map.set(file, (map.get(file) ?? 0) + 1);
  for (const p of pages) {
    for (const f of p.closure) count(deep, f);
    for (const f of p.direct) count(direct, f);
  }
  return pages.map((p) => ({
    route: p.route,
    files: [...p.closure].filter((f) => f === p.file || (deep.get(f) ?? 0) <= half || (p.direct.has(f) && (direct.get(f) ?? 0) <= half)),
  }));
}

function git(args) {
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function hasFullHistory() {
  try {
    return git(["rev-parse", "--is-shallow-repository"]) === "false";
  } catch {
    return false;
  }
}

function main() {
  if (!hasFullHistory()) {
    console.log(existsSync(OUTPUT) ? "page-dates: no full git history, keeping page-dates.json" : "page-dates: no full git history, sitemap without lastmod");
    return;
  }
  const pages = pageFiles().map((file) => {
    const direct = new Set(importsOf(readFileSync(file, "utf8")).map((s) => resolveImport(file, s)).filter(Boolean));
    return { file, route: routeOf(relative(join(ROOT, "app"), file)), closure: closure(file), direct };
  });
  const dateOf = new Map();
  const lastCommit = (file) => {
    if (!dateOf.has(file)) dateOf.set(file, git(["log", "-1", "--format=%cs", "--", relative(ROOT, file)]));
    return dateOf.get(file);
  };
  const dates = {};
  for (const { route, files } of contentFiles(pages)) {
    const latest = files.map(lastCommit).filter(Boolean).sort().at(-1);
    if (latest) dates[route] = latest;
    // `--explain` prints which files date each page, to check what counts as a page's content.
    if (process.argv.includes("--explain")) console.log(route, latest, files.map((f) => `${relative(ROOT, f)} ${lastCommit(f)}`));
  }
  writeFileSync(OUTPUT, `${JSON.stringify(Object.fromEntries(Object.entries(dates).sort()), null, 2)}\n`);
  console.log(`page-dates: ${Object.keys(dates).length} pages`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
