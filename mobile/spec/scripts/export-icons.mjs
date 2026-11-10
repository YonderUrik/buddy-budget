#!/usr/bin/env node
// Export the Lucide icons the web app uses into design/icons/ (spec: design/iconography-assets.md §1.2–1.4).
//
// Usage: node scripts/export-icons.mjs [web-repo-path]
//   web-repo-path defaults to ../buddy-budget next to this repo (only read, never modified).
//   Without a web checkout (CI of the apps) the step is skipped: design/icons/ is committed.
// Reads:
//   web app/, components/, lib/ — every `import { … } from "lucide-react"` (aliases resolved through
//     node_modules/lucide-react/dist/esm/lucide-react.mjs)
//   web lib/validation/{accounts,categories}.ts — ACCOUNT_ICONS / CATEGORY_ICONS (keys stored in the DB)
//   web node_modules/lucide-react/dist/esm/icons/<name>.mjs — the icon nodes (same geometry as lucide-static)
// Writes:
//   design/icons/lucide/<name>.svg  one plain SVG per icon (24×24, stroke 2, round caps/joins, currentColor)
//   design/icons/icons.json         canonical list + stored-key tables + lucide version
//   design/icons/LICENSE-lucide.txt the ISC license (acknowledgements screen)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { SPEC_ROOT, writeOut } from "./lib/common.mjs";

const webArg = process.argv[2];
const web = resolve(webArg ?? join(SPEC_ROOT, "..", "buddy-budget"));
const lucideDir = join(web, "node_modules", "lucide-react");
if (!existsSync(lucideDir)) {
  console.log(`export-icons: no web checkout with node_modules at ${web}; keeping committed design/icons/`);
  process.exit(0);
}

const lucideVersion = JSON.parse(readFileSync(join(lucideDir, "package.json"), "utf8")).version;

// export name → icon file name, e.g. AlertTriangle → triangle-alert
const exportMap = new Map();
const indexSrc = readFileSync(join(lucideDir, "dist", "esm", "lucide-react.mjs"), "utf8");
for (const m of indexSrc.matchAll(/export \{([^}]*)\} from '\.\/icons\/([a-z0-9-]+)\.mjs';/g)) {
  for (const part of m[1].split(",")) {
    const alias = /default as (\w+)/.exec(part.trim());
    if (alias) exportMap.set(alias[1], m[2]);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const used = new Set();
const unresolved = new Set();
for (const root of ["app", "components", "lib"]) {
  const dir = join(web, root);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']lucide-react["']/g)) {
      for (const raw of m[1].split(",")) {
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (!name || /^Lucide(Icon|Props)$/.test(name) || name === "IconNode") continue;
        const icon = exportMap.get(name);
        if (icon) used.add(icon);
        else unresolved.add(name);
      }
    }
  }
}
if (unresolved.size) console.warn(`  warning: unresolved lucide imports: ${[...unresolved].join(", ")}`);

// Keys persisted in the database (legacy lucide names) → asset names (iconography-assets.md §1.3).
function constArray(file, name) {
  const src = readFileSync(join(web, file), "utf8");
  const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(src);
  if (!m) throw new Error(`${name} not found in ${file}`);
  return [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
}
const legacyKeyMap = { home: "house", "help-circle": "circle-question-mark", "alert-triangle": "triangle-alert" };
const assetFor = (key) => legacyKeyMap[key] ?? key;
const accountIcons = constArray("lib/validation/accounts.ts", "ACCOUNT_ICONS");
const categoryIcons = constArray("lib/validation/categories.ts", "CATEGORY_ICONS");
for (const key of [...accountIcons, ...categoryIcons]) used.add(assetFor(key));

const icons = [...used].sort();
for (const name of icons) {
  if (!existsSync(join(lucideDir, "dist", "esm", "icons", `${name}.mjs`))) throw new Error(`lucide icon ${name} missing`);
}

/** Icon node module → SVG text with lucide's default attributes. */
function svgFor(name) {
  const src = readFileSync(join(lucideDir, "dist", "esm", "icons", `${name}.mjs`), "utf8");
  const node = /const __iconNode = (\[[\s\S]*?\]);\n/.exec(src);
  if (!node) throw new Error(`cannot parse icon node of ${name}`);
  // The node is a JS literal with unquoted keys: make it JSON.
  const json = node[1].replace(/(\w+):/g, '"$1":').replace(/,(\s*[}\]])/g, "$1");
  const elements = JSON.parse(json).map(([tag, attrs]) => {
    const a = Object.entries(attrs)
      .filter(([k]) => k !== "key")
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    return `  <${tag} ${a}/>`;
  });
  return [
    `<!-- lucide ${name} (lucide-react ${lucideVersion}, ISC) -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    ...elements,
    `</svg>`,
    "",
  ].join("\n");
}

const outDir = join(SPEC_ROOT, "design", "icons");
for (const name of icons) writeOut(join(outDir, "lucide", `${name}.svg`), svgFor(name));
writeOut(
  join(outDir, "icons.json"),
  JSON.stringify(
    {
      generatedBy: "scripts/export-icons.mjs",
      source: `buddy-budget lucide-react imports + lib/validation/{accounts,categories}.ts`,
      lucideVersion,
      license: "ISC (lucide)",
      icons,
      legacyKeyMap,
      accountIcons,
      categoryIcons,
      fallback: { account: "wallet", category: "package" },
    },
    null,
    2,
  ) + "\n",
);
writeOut(join(outDir, "LICENSE-lucide.txt"), readFileSync(join(lucideDir, "LICENSE")));
console.log(`export-icons: ${icons.length} icons (lucide ${lucideVersion})`);
