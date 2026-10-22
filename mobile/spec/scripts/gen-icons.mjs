#!/usr/bin/env node
// Generate the Lucide icon assets for both apps from design/icons/ (spec: design/iconography-assets.md §1.4).
//
// Usage: node scripts/gen-icons.mjs <ios-repo-path|-> <android-repo-path|->
// Writes:
//   iOS      BuddyBudget/Resources/Icons.xcassets/lucide-<name>.imageset/{lucide-<name>.svg,Contents.json}
//            BuddyBudget/DesignSystem/Generated/Icons.swift   (enum BBIcon)
//            BuddyBudget/Resources/Licenses/Lucide-ISC.txt
//   Android  app/src/main/res/drawable/lucide_<name>.xml       (VectorDrawable)
//            app/src/main/kotlin/io/buddybudget/app/designsystem/generated/Icons.kt (enum class BBIcon)
//            app/src/main/assets/licenses/Lucide-ISC.txt
//
// Both platforms receive the *same* normalized geometry: every <circle>/<ellipse>/<rect>/<line>/<polyline>/<polygon>
// is converted to path data, and every path is re-serialized (explicit commands, separated numbers, arc flags split)
// so the iOS SVG parser and Android's PathParser read identical numbers. Strokes keep lucide's defaults
// (width 2 in a 24×24 viewport, round caps and joins), so they scale with the icon size exactly like lucide-react.
// No SF Symbols: icons are template images (iOS) / tinted vectors (Android).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SPEC_ROOT, copyOut, header, readJSON, requireDir, writeOut } from "./lib/common.mjs";

const SCRIPT = "gen-icons.mjs";
const SOURCES = ["design/icons/icons.json", "design/icons/lucide/*.svg"];
const [iosArg, androidArg] = process.argv.slice(2);
if (!iosArg || !androidArg) {
  console.error("usage: node scripts/gen-icons.mjs <ios-repo-path|-> <android-repo-path|->");
  process.exit(1);
}
const ios = iosArg === "-" ? null : requireDir(iosArg, "iOS repo");
const android = androidArg === "-" ? null : requireDir(androidArg, "Android repo");

const iconsDir = join(SPEC_ROOT, "design", "icons");
const meta = readJSON(join(iconsDir, "icons.json"));
const names = meta.icons;

// ---------- SVG → normalized path data ----------
const num = (v) => {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? "0" : String(r);
};
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** Tokenize SVG path data; arc flags may be written without separators ("a1 1 0 011 1"). */
function parsePath(d) {
  const out = [];
  let i = 0;
  let cmd = null;
  const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const number = () => {
    skip();
    const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(d.slice(i));
    if (!m) throw new Error(`bad path data near "${d.slice(i, i + 12)}" in ${d}`);
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const flag = () => {
    skip();
    const c = d[i++];
    if (c !== "0" && c !== "1") throw new Error(`bad arc flag in ${d}`);
    return Number(c);
  };
  while (true) {
    skip();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) {
      cmd = d[i++];
      if (cmd.toUpperCase() === "Z") {
        out.push([cmd]);
        continue;
      }
    } else if (!cmd) throw new Error(`path must start with a command: ${d}`);
    const n = ARGS[cmd.toUpperCase()];
    const args = [];
    for (let k = 0; k < n; k++) args.push(cmd.toUpperCase() === "A" && (k === 3 || k === 4) ? flag() : number());
    out.push([cmd, ...args]);
    // Implicit repeats after M/m are L/l.
    if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
  }
  return out;
}
const serialize = (cmds) => cmds.map(([c, ...a]) => c + a.map(num).join(" ")).join("");

function elementToPath(tag, a) {
  const f = (k, dflt = 0) => (a[k] === undefined ? dflt : parseFloat(a[k]));
  switch (tag) {
    case "path":
      return serialize(parsePath(a.d));
    case "circle":
    case "ellipse": {
      const cx = f("cx"), cy = f("cy");
      const rx = tag === "circle" ? f("r") : f("rx");
      const ry = tag === "circle" ? f("r") : f("ry");
      return serialize([
        ["M", cx - rx, cy],
        ["a", rx, ry, 0, 1, 0, 2 * rx, 0],
        ["a", rx, ry, 0, 1, 0, -2 * rx, 0],
        ["Z"],
      ]);
    }
    case "line":
      return serialize([["M", f("x1"), f("y1")], ["L", f("x2"), f("y2")]]);
    case "polyline":
    case "polygon": {
      const p = a.points.trim().split(/[\s,]+/).map(Number);
      const cmds = [];
      for (let k = 0; k < p.length; k += 2) cmds.push([k === 0 ? "M" : "L", p[k], p[k + 1]]);
      if (tag === "polygon") cmds.push(["Z"]);
      return serialize(cmds);
    }
    case "rect": {
      const x = f("x"), y = f("y"), w = f("width"), h = f("height");
      let rx = a.rx !== undefined ? f("rx") : a.ry !== undefined ? f("ry") : 0;
      let ry = a.ry !== undefined ? f("ry") : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return serialize([["M", x, y], ["H", x + w], ["V", y + h], ["H", x], ["Z"]]);
      return serialize([
        ["M", x + rx, y],
        ["H", x + w - rx],
        ["A", rx, ry, 0, 0, 1, x + w, y + ry],
        ["V", y + h - ry],
        ["A", rx, ry, 0, 0, 1, x + w - rx, y + h],
        ["H", x + rx],
        ["A", rx, ry, 0, 0, 1, x, y + h - ry],
        ["V", y + ry],
        ["A", rx, ry, 0, 0, 1, x + rx, y],
        ["Z"],
      ]);
    }
    default:
      throw new Error(`unsupported SVG element <${tag}>`);
  }
}

function iconPaths(name) {
  const svg = readFileSync(join(iconsDir, "lucide", `${name}.svg`), "utf8");
  const body = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"));
  return [...body.matchAll(/<([a-z]+)\s([^>]*?)\/>/g)].map((m) => elementToPath(m[1], attrs(m[2])));
}

// ---------- identifiers ----------
const words = (name) => name.split("-");
const swiftCase = (name) => {
  const id = words(name).map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
  return ["repeat", "import", "package", "default", "case", "in", "is", "as", "func", "return"].includes(id) ? `\`${id}\`` : id;
};
const kotlinCase = (name) => words(name).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
const resName = (name) => `lucide_${name.replace(/-/g, "_")}`;

const allPaths = new Map(names.map((n) => [n, iconPaths(n)]));
const assetFor = (key) => meta.legacyKeyMap[key] ?? key;
for (const key of [...meta.accountIcons, ...meta.categoryIcons]) {
  if (!allPaths.has(assetFor(key))) throw new Error(`stored icon key ${key} has no asset`);
}

// ---------- iOS ----------
if (ios) {
  const catalog = join(ios, "BuddyBudget", "Resources", "Icons.xcassets");
  writeOut(join(catalog, "Contents.json"), JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2) + "\n");
  for (const [name, paths] of allPaths) {
    const asset = `lucide-${name}`;
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">`,
      ...paths.map(
        (d) =>
          `<path d="${d}" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      ),
      `</svg>`,
      "",
    ].join("\n");
    writeOut(join(catalog, `${asset}.imageset`, `${asset}.svg`), svg);
    writeOut(
      join(catalog, `${asset}.imageset`, "Contents.json"),
      JSON.stringify(
        {
          images: [{ filename: `${asset}.svg`, idiom: "universal" }],
          info: { author: "xcode", version: 1 },
          properties: { "preserves-vector-representation": true, "template-rendering-intent": "template" },
        },
        null,
        2,
      ) + "\n",
    );
  }
  const swift = [
    header(SCRIPT, SOURCES),
    `// lucide ${meta.lucideVersion} (ISC) · ${names.length} icons. Render with \`BBIconView(_:size:)\` (DesignSystem/Components).`,
    "",
    "import Foundation",
    "",
    "/// Every Lucide icon the app ships. Raw value = lucide name; the asset is `lucide-<name>` in Icons.xcassets.",
    "enum BBIcon: String, CaseIterable, Sendable {",
    ...names.map((n) => `    case ${swiftCase(n)} = "${n}"`),
    "}",
    "",
    "extension BBIcon {",
    "    /// Image name in Icons.xcassets (template rendering).",
    '    var assetName: String { "lucide-" + rawValue }',
    "",
    "    /// Icon keys stored in the database are legacy lucide names (iconography-assets.md §1.3).",
    "    static let legacyKeyMap: [String: BBIcon] = [",
    ...Object.entries(meta.legacyKeyMap).map(([k, v]) => `        "${k}": .${swiftCase(v)},`),
    "    ]",
    "",
    "    /// Account icon keys (`ACCOUNT_ICONS`), in the web order.",
    `    static let accountKeys: [String] = [${meta.accountIcons.map((k) => `"${k}"`).join(", ")}]`,
    "",
    "    /// Category icon keys (`CATEGORY_ICONS`), in the web order.",
    `    static let categoryKeys: [String] = [${meta.categoryIcons.map((k) => `"${k}"`).join(", ")}]`,
    "",
    "    /// Asset for a stored key, or nil if unknown.",
    "    static func forKey(_ key: String?) -> BBIcon? {",
    "        guard let key else { return nil }",
    "        return legacyKeyMap[key] ?? BBIcon(rawValue: key)",
    "    }",
    "",
    `    /// Account avatar icon; unknown → \`${meta.fallback.account}\`.`,
    `    static func account(_ key: String?) -> BBIcon { forKey(key) ?? .${swiftCase(meta.fallback.account)} }`,
    "",
    `    /// Category avatar icon; unknown → \`${meta.fallback.category}\`.`,
    `    static func category(_ key: String?) -> BBIcon { forKey(key) ?? .${swiftCase(meta.fallback.category)} }`,
    "}",
    "",
  ].join("\n");
  writeOut(join(ios, "BuddyBudget", "DesignSystem", "Generated", "Icons.swift"), swift);
  copyOut(join(iconsDir, "LICENSE-lucide.txt"), join(ios, "BuddyBudget", "Resources", "Licenses", "Lucide-ISC.txt"));

  // Remove nothing automatically, but warn about stale imagesets (icon removed from the web).
  if (existsSync(catalog)) {
    const stale = readdirSync(catalog).filter((f) => f.endsWith(".imageset") && !allPaths.has(f.replace(/^lucide-|\.imageset$/g, "")));
    if (stale.length) console.warn(`  warning: stale iOS icon assets (delete them): ${stale.join(", ")}`);
  }
}

// ---------- Android ----------
if (android) {
  const res = join(android, "app", "src", "main", "res", "drawable");
  for (const [name, paths] of allPaths) {
    const xml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      header(SCRIPT, SOURCES, "xml"),
      `<!-- lucide ${name} (ISC) -->`,
      '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
      '    android:width="24dp"',
      '    android:height="24dp"',
      '    android:viewportWidth="24"',
      '    android:viewportHeight="24">',
      ...paths.map((d) =>
        [
          "    <path",
          `        android:pathData="${d}"`,
          '        android:fillColor="#00000000"',
          '        android:strokeColor="#FF000000"',
          '        android:strokeWidth="2"',
          '        android:strokeLineCap="round"',
          '        android:strokeLineJoin="round" />',
        ].join("\n"),
      ),
      "</vector>",
      "",
    ].join("\n");
    writeOut(join(res, `${resName(name)}.xml`), xml);
  }
  const kt = [
    header(SCRIPT, SOURCES),
    `// lucide ${meta.lucideVersion} (ISC) · ${names.length} icons. Render with \`BBIconView(icon, size)\` (designsystem/components).`,
    "",
    "package io.buddybudget.app.designsystem.generated",
    "",
    "import androidx.annotation.DrawableRes",
    "import io.buddybudget.app.R",
    "",
    "/** Every Lucide icon the app ships. [key] = lucide name; [drawable] = `R.drawable.lucide_<name>` (VectorDrawable). */",
    "enum class BBIcon(val key: String, @param:DrawableRes val drawable: Int) {",
    ...names.map((n) => `    ${kotlinCase(n)}("${n}", R.drawable.${resName(n)}),`),
    "    ;",
    "",
    "    companion object {",
    "        private val byKey: Map<String, BBIcon> = entries.associateBy { it.key }",
    "",
    "        /** Icon keys stored in the database are legacy lucide names (iconography-assets.md §1.3). */",
    "        val legacyKeyMap: Map<String, BBIcon> = mapOf(",
    ...Object.entries(meta.legacyKeyMap).map(([k, v]) => `            "${k}" to ${kotlinCase(v)},`),
    "        )",
    "",
    "        /** Account icon keys (`ACCOUNT_ICONS`), in the web order. */",
    `        val accountKeys: List<String> = listOf(${meta.accountIcons.map((k) => `"${k}"`).join(", ")})`,
    "",
    "        /** Category icon keys (`CATEGORY_ICONS`), in the web order. */",
    `        val categoryKeys: List<String> = listOf(${meta.categoryIcons.map((k) => `"${k}"`).join(", ")})`,
    "",
    "        /** Asset for a stored key, or null if unknown. */",
    "        fun forKey(key: String?): BBIcon? = key?.let { legacyKeyMap[it] ?: byKey[it] }",
    "",
    `        /** Account avatar icon; unknown → \`${meta.fallback.account}\`. */`,
    `        fun account(key: String?): BBIcon = forKey(key) ?: ${kotlinCase(meta.fallback.account)}`,
    "",
    `        /** Category avatar icon; unknown → \`${meta.fallback.category}\`. */`,
    `        fun category(key: String?): BBIcon = forKey(key) ?: ${kotlinCase(meta.fallback.category)}`,
    "    }",
    "}",
    "",
  ].join("\n");
  writeOut(join(android, "app", "src", "main", "kotlin", "io", "buddybudget", "app", "designsystem", "generated", "Icons.kt"), kt);
  copyOut(join(iconsDir, "LICENSE-lucide.txt"), join(android, "app", "src", "main", "assets", "licenses", "Lucide-ISC.txt"));

  if (existsSync(res)) {
    const stale = readdirSync(res).filter((f) => f.startsWith("lucide_") && !names.some((n) => `${resName(n)}.xml` === f));
    if (stale.length) console.warn(`  warning: stale Android icon drawables (delete them): ${stale.join(", ")}`);
  }
}
console.log(`gen-icons: ${names.length} icons`);
