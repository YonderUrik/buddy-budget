#!/usr/bin/env node
// Generate design tokens and bundle fonts for both apps from design/tokens.json and design/fonts/.
//
// Usage: node scripts/gen-tokens.mjs <ios-repo-path> <android-repo-path>
//   (pass "-" to skip a platform)
// Writes:
//   iOS      BuddyBudget/DesignSystem/Generated/Tokens.swift
//            BuddyBudget/Resources/Fonts/*.ttf + *-OFL.txt
//   Android  app/src/main/kotlin/io/buddybudget/app/designsystem/generated/Tokens.kt
//            app/src/main/res/font/*.ttf
//            app/src/main/assets/licenses/*-OFL.txt
// Rules: design/tokens.md (§0 units, §8 naming, §9 generator sketch).
import { existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { SPEC_ROOT, copyOut, header, readJSON, requireDir, upperFirst, writeOut } from "./lib/common.mjs";

const SCRIPT = "gen-tokens.mjs";
const SOURCES = ["design/tokens.json"];
const [iosArg, androidArg] = process.argv.slice(2);
if (!iosArg || !androidArg) {
  console.error("usage: node scripts/gen-tokens.mjs <ios-repo-path|-> <android-repo-path|->");
  process.exit(1);
}
const ios = iosArg === "-" ? null : requireDir(iosArg, "iOS repo");
const android = androidArg === "-" ? null : requireDir(androidArg, "Android repo");

const tokensJson = readJSON(join(SPEC_ROOT, "design", "tokens.json"));
const tokens = tokensJson.tokens;
const byName = new Map(tokens.map((t) => [t.name, t]));
const ofType = (type, prefix) => tokens.filter((t) => t.type === type && (!prefix || t.name.startsWith(prefix + ".")));
const category = (t) => t.name.split(".")[0];

/** tokens.md §8: drop the leading category, camel-case the rest, digit-leading segments join the previous one. */
function ident(name) {
  const [cat, ...segs] = name.split(".");
  let out = "";
  for (const raw of segs) {
    const s = raw.replace(/[^A-Za-z0-9_]/g, "");
    if (!out) out = s;
    else out += /^[0-9]/.test(s) ? s : upperFirst(s);
  }
  if (/^[0-9]/.test(out)) out = cat + out;
  return out;
}

// ---------- Colors ----------
/** "#rrggbb" / "#rrggbbaa" → [rgb hex (6), alpha hex (2)] */
function parseHex(hex) {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex);
  if (!m) throw new Error(`bad color ${hex}`);
  return [m[1].toUpperCase(), (m[2] ?? "ff").toUpperCase()];
}
/** Web order #RRGGBBAA → Swift literal 0xRRGGBBAA (kept in web order; the helper unpacks it). */
const swiftRGBA = (hex) => {
  const [rgb, a] = parseHex(hex);
  return `0x${rgb}${a}`;
};
/** Web order #RRGGBBAA → Compose 0xAARRGGBB. */
const composeARGB = (hex) => {
  const [rgb, a] = parseHex(hex);
  return `0x${a}${rgb}`;
};

const colors = ofType("color").map((t) => ({ ...t, id: ident(t.name) }));
const swatches = colors.filter((c) => c.group === "swatch");
const swatchOrder = tokensJson.$meta.swatchOrder;
for (const key of swatchOrder) if (!swatches.find((s) => s.key === key)) throw new Error(`swatchOrder key ${key} has no token`);
const swatchByKey = new Map(swatches.map((s) => [s.key, s]));

const colorDoc = (c) => {
  const src = c.source ? `\`${c.source.split("  ")[0]}\` — ` : "";
  return c.light === c.dark ? `${src}${c.light} (both themes)` : `${src}light ${c.light} · dark ${c.dark}`;
};

/** Delete generated font files no longer in the token set (a dropped family). Honors --check. */
function removeStale(dir, isStale) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).filter(isStale)) {
    if (process.env.BB_SYNC_CHECK === "1") {
      console.error(`  stale: ${join(dir, name)}`);
      process.exitCode = 1;
    } else {
      unlinkSync(join(dir, name));
      console.log(`  removed ${join(dir, name)}`);
    }
  }
}

// ---------- Fonts ----------
const fontsDir = join(SPEC_ROOT, "design", "fonts");
const staticDir = join(fontsDir, "static");
const STYLE_WEIGHT = { Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 };
const families = ofType("fontFamily").map((t) => {
  const role = ident(t.name).replace(/^family/, "").toLowerCase(); // sans / display / mono
  // A `system` family (the platform monospace) bundles nothing.
  if (t.system) return { token: t, role, name: t.value, ps: null, faces: [], license: null, system: true };
  const ps = t.value.replace(/\s+/g, "");
  const faces = readdirSync(staticDir)
    .filter((f) => f.startsWith(ps + "-") && f.endsWith(".ttf"))
    .sort()
    .map((file) => {
      const style = file.slice(ps.length + 1, -4);
      if (!(style in STYLE_WEIGHT)) throw new Error(`unknown font style in ${file}`);
      return {
        file,
        postScript: file.slice(0, -4),
        weight: STYLE_WEIGHT[style],
        androidRes: `${t.value.toLowerCase().replace(/\s+/g, "_")}_${style.toLowerCase()}`,
      };
    })
    .sort((a, b) => a.weight - b.weight);
  if (!faces.length) throw new Error(`no static fonts for ${t.value} in design/fonts/static`);
  const license = readdirSync(fontsDir).find((f) => f === `${ps}-OFL.txt`);
  if (!license) throw new Error(`missing ${ps}-OFL.txt in design/fonts`);
  return { token: t, role, name: t.value, ps, faces, license, system: false };
});
const familyByToken = new Map(families.map((f) => [f.token.name, f]));

// Dynamic Type anchors (tokens.md §2.4). button and mono are not listed there: 14 pt → subheadline, 12 pt → caption.
const DYNAMIC_TYPE = {
  display: "largeTitle",
  pageTitle: "largeTitle",
  statValue: "title",
  amountLarge: "title",
  sectionTitle: "title3",
  cardTitle: "headline",
  body: "subheadline",
  bodyStrong: "subheadline",
  bodyLarge: "body",
  caption: "caption",
  overline: "caption",
  badge: "caption",
  micro: "caption",
  button: "subheadline",
  mono: "caption",
};
const typography = ofType("typography").map((t) => {
  const id = ident(t.name);
  const fam = familyByToken.get(t.fontFamily);
  if (!fam) throw new Error(`${t.name}: unknown font family ${t.fontFamily}`);
  if (!fam.system && !fam.faces.some((f) => f.weight === t.weight)) throw new Error(`${t.name}: no ${fam.name} ${t.weight} instance bundled`);
  if (!DYNAMIC_TYPE[id]) console.warn(`  warning: ${t.name} has no Dynamic Type anchor; using .body`);
  return { ...t, id, fam, anchor: DYNAMIC_TYPE[id] ?? "body" };
});

const num = (v) => (Number.isInteger(v) ? String(v) : String(v));
const fl = (v) => `${Number.isInteger(v) ? v.toFixed(1) : v}f`;
const ktDouble = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

const dimensionGroups = [
  ["radius", "BBRadius", "Corner radii (pt). `full` = capsule."],
  ["space", "BBSpacing", "Spacing scale (pt), `space.<tailwindStep>`."],
  ["layout", "BBLayout", "Component metrics."],
  ["breakpoint", "BBBreakpoint", "Adaptive layout breakpoints (pt)."],
];
const dimsOf = (cat) => tokens.filter((t) => category(t) === cat && (t.type === "dimension" || t.type === "number"));
const handled = new Set(["color", "typography", "fontFamily", "fontWeight", "fontSize", "letterSpacing", "lineHeightMultiplier", "shadow", "border", "spring", "duration", "cubicBezier"]);
for (const t of tokens) {
  if (!handled.has(t.type) && !dimensionGroups.some(([c]) => c === category(t))) throw new Error(`unhandled token ${t.name} (${t.type})`);
}

// =====================================================================================
// iOS
// =====================================================================================
function swiftTokens() {
  const o = [];
  o.push(header(SCRIPT, SOURCES));
  o.push(`// tokens.json v${tokensJson.$meta.version} (${tokensJson.$meta.generatedAt}) · ${tokens.length} tokens`);
  o.push("");
  o.push("import SwiftUI");
  o.push("import UIKit");
  o.push("");
  o.push("// MARK: - Color construction");
  o.push("");
  o.push("extension UIColor {");
  o.push("    /// sRGB color from a value in **web order** `0xRRGGBBAA` (alpha last, as in tokens.json).");
  o.push("    convenience init(bbRGBA value: UInt32) {");
  o.push("        self.init(");
  o.push("            red: CGFloat((value >> 24) & 0xFF) / 255,");
  o.push("            green: CGFloat((value >> 16) & 0xFF) / 255,");
  o.push("            blue: CGFloat((value >> 8) & 0xFF) / 255,");
  o.push("            alpha: CGFloat(value & 0xFF) / 255");
  o.push("        )");
  o.push("    }");
  o.push("}");
  o.push("");
  o.push("extension Color {");
  o.push("    /// Light/dark color resolved per trait collection, so it follows both the system appearance");
  o.push("    /// and the in-app theme override (`preferredColorScheme` / `overrideUserInterfaceStyle`).");
  o.push("    init(bbLight light: UInt32, dark: UInt32) {");
  o.push("        if light == dark {");
  o.push("            self.init(uiColor: UIColor(bbRGBA: light))");
  o.push("        } else {");
  o.push("            self.init(uiColor: UIColor { traits in");
  o.push("                UIColor(bbRGBA: traits.userInterfaceStyle == .dark ? dark : light)");
  o.push("            })");
  o.push("        }");
  o.push("    }");
  o.push("}");
  o.push("");
  o.push("// MARK: - Colors (color.*)");
  o.push("");
  o.push("extension Color {");
  let group = null;
  for (const c of colors) {
    if (c.group !== group) {
      if (group !== null) o.push("");
      o.push(`    // ${c.group}`);
      group = c.group;
    }
    o.push(`    /// ${colorDoc(c)}${c.note ? ` — ${c.note}` : ""}`);
    o.push(`    static let bb${upperFirst(c.id)} = Color(bbLight: ${swiftRGBA(c.light)}, dark: ${swiftRGBA(c.dark)})`);
  }
  o.push("}");
  o.push("");
  o.push("/// Category/account color keys (persisted server-side; never rename or reorder).");
  o.push("enum BBSwatch {");
  o.push("    /// All 48 keys in persisted order (`distributeColors` uses index % 48).");
  o.push("    static let order: [String] = [");
  for (let i = 0; i < swatchOrder.length; i += 8) {
    o.push(`        ${swatchOrder.slice(i, i + 8).map((k) => `"${k}"`).join(", ")},`);
  }
  o.push("    ]");
  o.push("    /// The 16 base keys offered in color pickers, in order.");
  o.push("    static let pickerKeys: [String] = Array(order.prefix(16))");
  o.push("    /// Color for a stored key; unknown or legacy keys fall back to `slate`.");
  o.push("    static func color(forKey key: String) -> Color { byKey[key] ?? .bbSwatchSlate }");
  o.push("    static let byKey: [String: Color] = [");
  for (const key of swatchOrder) o.push(`        "${key}": .bb${upperFirst(swatchByKey.get(key).id)},`);
  o.push("    ]");
  o.push("}");
  o.push("");
  o.push("// MARK: - Dimensions");
  for (const [cat, typeName, doc] of dimensionGroups) {
    o.push("");
    o.push(`/// ${doc}`);
    o.push(`enum ${typeName} {`);
    for (const t of dimsOf(cat)) {
      const unit = t.type === "number" ? ` (${t.unit})` : "";
      if (t.note || unit) o.push(`    /// ${[t.note, unit.trim()].filter(Boolean).join(" ")}`);
      if (t.type === "number") o.push(`    static let ${ident(t.name)}: Double = ${num(t.value)}`);
      else o.push(`    static let ${ident(t.name)}: CGFloat = ${num(t.value)}`);
    }
    o.push("}");
  }
  o.push("");
  o.push("// MARK: - Fonts");
  o.push("");
  o.push("/// Bundled font families (static instances in Resources/Fonts, registered via UIAppFonts).");
  o.push("enum BBFontRole: String, CaseIterable, Sendable {");
  for (const f of families) o.push(`    case ${f.role}`);
  o.push("");
  o.push("    var familyName: String {");
  o.push("        switch self {");
  for (const f of families) o.push(`        case .${f.role}: "${f.name}"`);
  o.push("        }");
  o.push("    }");
  o.push("");
  o.push("    /// True for a platform font (nothing bundled): render with the system font of that design.");
  o.push("    var isSystem: Bool {");
  o.push("        switch self {");
  for (const f of families) o.push(`        case .${f.role}: ${f.system}`);
  o.push("        }");
  o.push("    }");
  o.push("");
  o.push("    /// Bundled weights and their PostScript names.");
  o.push("    var faces: [(weight: Int, postScriptName: String)] {");
  o.push("        switch self {");
  for (const f of families) {
    o.push(`        case .${f.role}: [${f.faces.map((x) => `(${x.weight}, "${x.postScript}")`).join(", ")}]`.replace(": []", ": []"));
  }
  o.push("        }");
  o.push("    }");
  o.push("");
  o.push("    /// PostScript name of the bundled instance closest to `weight` (empty for a system family).");
  o.push("    func postScriptName(weight: Int) -> String {");
  o.push("        faces.min { abs($0.weight - weight) < abs($1.weight - weight) }?.postScriptName ?? \"\"");
  o.push("    }");
  o.push("");
  o.push("    /// Font files to list under `UIAppFonts`.");
  o.push("    static let fontFiles: [String] = [");
  for (const f of families) for (const x of f.faces) o.push(`        "${x.file}",`);
  o.push("    ]");
  o.push("}");
  o.push("");
  o.push("/// Font size with its line height (`nil` = inherits from the context).");
  o.push("struct BBFontSize: Sendable, Hashable {");
  o.push("    let size: CGFloat");
  o.push("    let lineHeight: CGFloat?");
  o.push("}");
  o.push("");
  o.push("/// Raw font scale tokens (font.*). Prefer `BBTypography` styles in UI code.");
  o.push("enum BBFontTokens {");
  for (const t of tokens.filter((x) => category(x) === "font")) {
    const id = ident(t.name);
    switch (t.type) {
      case "fontFamily":
        o.push(`    static let ${id} = "${t.value}"`);
        break;
      case "fontWeight":
        o.push(`    static let ${id} = ${t.value}`);
        break;
      case "fontSize":
        o.push(`    static let ${id} = BBFontSize(size: ${num(t.size)}, lineHeight: ${t.lineHeight == null ? "nil" : num(t.lineHeight)})`);
        break;
      case "letterSpacing":
        o.push(`    /// em`);
        o.push(`    static let ${id}: CGFloat = ${num(t.value)}`);
        break;
      case "lineHeightMultiplier":
        o.push(`    static let ${id}: CGFloat = ${num(t.value)}`);
        break;
      default:
        throw new Error(`unexpected font token ${t.name}`);
    }
  }
  o.push("}");
  o.push("");
  o.push("// MARK: - Typography (typography.*)");
  o.push("");
  o.push("/// Dynamic Type anchor (`Font.custom(_:size:relativeTo:)`), tokens.md §2.4.");
  o.push("enum BBDynamicTypeAnchor: Sendable {");
  o.push("    case largeTitle, title, title2, title3, headline, body, subheadline, callout, footnote, caption, caption2");
  o.push("}");
  o.push("");
  o.push("/// A semantic text style. Rendering lives in DesignSystem/Theme.swift (`Font.bb(_:)`, `.bbTextStyle(_:)`).");
  o.push("struct BBTextStyle: Sendable {");
  o.push("    let role: BBFontRole");
  o.push("    let size: CGFloat");
  o.push("    let lineHeight: CGFloat");
  o.push("    let weight: Int");
  o.push("    /// Tracking in em (multiply by `size` for points).");
  o.push("    let letterSpacingEm: CGFloat");
  o.push("    let tabularNums: Bool");
  o.push("    let uppercase: Bool");
  o.push("    let anchor: BBDynamicTypeAnchor");
  o.push("}");
  o.push("");
  o.push("enum BBTypography {");
  for (const t of typography) {
    if (t.note) o.push(`    /// ${t.note}`);
    o.push(
      `    static let ${t.id} = BBTextStyle(role: .${t.fam.role}, size: ${num(t.size)}, lineHeight: ${num(t.lineHeight)}, ` +
        `weight: ${t.weight}, letterSpacingEm: ${num(t.letterSpacingEm ?? 0)}, tabularNums: ${!!t.tabularNums}, ` +
        `uppercase: ${!!t.uppercase}, anchor: .${t.anchor})`,
    );
  }
  o.push("}");
  o.push("");
  o.push("// MARK: - Elevation");
  o.push("");
  o.push("/// One CSS box-shadow layer (pt). SwiftUI has no spread: see `View.bbShadow(_:)`.");
  o.push("struct BBShadowLayer: Sendable {");
  o.push("    let x: CGFloat");
  o.push("    let y: CGFloat");
  o.push("    let blur: CGFloat");
  o.push("    let spread: CGFloat");
  o.push("    let color: Color");
  o.push("}");
  o.push("");
  o.push("enum BBShadow {");
  for (const t of ofType("shadow")) {
    const layers = t.layers.map(
      (l) => `BBShadowLayer(x: ${num(l.x)}, y: ${num(l.y)}, blur: ${num(l.blur)}, spread: ${num(l.spread)}, color: Color(bbLight: ${swiftRGBA(l.color)}, dark: ${swiftRGBA(l.color)}))`,
    );
    o.push(`    static let ${ident(t.name)}: [BBShadowLayer] = [`);
    for (const l of layers) o.push(`        ${l},`);
    o.push("    ]");
  }
  o.push("}");
  o.push("");
  o.push("enum BBElevation {");
  for (const t of ofType("border")) {
    const ref = byName.get(t.color);
    if (!ref) throw new Error(`${t.name}: unknown color ${t.color}`);
    if (t.note) o.push(`    /// ${t.note}`);
    o.push(`    static let ${ident(t.name)}Width: CGFloat = ${num(t.width)}`);
    o.push(`    static let ${ident(t.name)}Color: Color = .bb${upperFirst(ident(ref.name))}`);
  }
  o.push("}");
  o.push("");
  o.push("// MARK: - Motion");
  o.push("");
  o.push("/// Mass-spring-damper parameters (same equation as the web). `Animation.bb(_:)` in Theme.swift.");
  o.push("struct BBSpring: Sendable {");
  o.push("    let stiffness: Double");
  o.push("    let damping: Double");
  o.push("    let mass: Double");
  o.push("    let dampingRatio: Double");
  o.push("    let settleMs: Int");
  o.push("}");
  o.push("");
  o.push("struct BBCubicBezier: Sendable {");
  o.push("    let x1: Double");
  o.push("    let y1: Double");
  o.push("    let x2: Double");
  o.push("    let y2: Double");
  o.push("}");
  o.push("");
  o.push("enum BBMotion {");
  for (const t of ofType("spring")) {
    if (t.note) o.push(`    /// ${t.note}`);
    o.push(
      `    static let ${ident(t.name)} = BBSpring(stiffness: ${num(t.stiffness)}, damping: ${num(t.damping)}, mass: ${num(t.mass)}, dampingRatio: ${num(t.dampingRatio)}, settleMs: ${t.settleMs})`,
    );
  }
  for (const t of ofType("duration")) {
    o.push(`    /// ${t.value} ms`);
    o.push(`    static let ${ident(t.name)}: TimeInterval = ${num(t.value / 1000)}`);
  }
  for (const t of ofType("cubicBezier")) {
    const [x1, y1, x2, y2] = t.value;
    o.push(`    static let ${ident(t.name)} = BBCubicBezier(x1: ${num(x1)}, y1: ${num(y1)}, x2: ${num(x2)}, y2: ${num(y2)})`);
  }
  o.push("}");
  o.push("");
  return o.join("\n");
}

// =====================================================================================
// Android
// =====================================================================================
function kotlinTokens() {
  const o = [];
  o.push(header(SCRIPT, SOURCES));
  o.push(`// tokens.json v${tokensJson.$meta.version} (${tokensJson.$meta.generatedAt}) · ${tokens.length} tokens`);
  o.push('@file:Suppress("MagicNumber", "MaxLineLength", "LargeClass")');
  o.push("");
  o.push("package io.buddybudget.app.designsystem.generated");
  o.push("");
  o.push("import androidx.compose.animation.core.CubicBezierEasing");
  o.push("import androidx.compose.animation.core.SpringSpec");
  o.push("import androidx.compose.animation.core.spring");
  o.push("import androidx.compose.runtime.Immutable");
  o.push("import androidx.compose.ui.graphics.Color");
  o.push("import androidx.compose.ui.text.TextStyle");
  o.push("import androidx.compose.ui.text.font.Font");
  o.push("import androidx.compose.ui.text.font.FontFamily");
  o.push("import androidx.compose.ui.text.font.FontWeight");
  o.push("import androidx.compose.ui.text.style.LineHeightStyle");
  o.push("import androidx.compose.ui.unit.Dp");
  o.push("import androidx.compose.ui.unit.TextUnit");
  o.push("import androidx.compose.ui.unit.dp");
  o.push("import androidx.compose.ui.unit.em");
  o.push("import androidx.compose.ui.unit.sp");
  o.push("import io.buddybudget.app.R");
  o.push("");
  o.push("// ---------------------------------------------------------------- Colors (color.*)");
  o.push("// tokens.json stores #RRGGBBAA (alpha last); Compose literals below are 0xAARRGGBB.");
  o.push("");
  o.push("/** Every color token. Read through `BuddyBudgetTheme.colors` (LocalBBColors), never hard-code hex. */");
  o.push("@Immutable");
  o.push("interface BBColors {");
  let group = null;
  for (const c of colors) {
    if (c.group !== group) {
      if (group !== null) o.push("");
      o.push(`    // ${c.group}`);
      group = c.group;
    }
    o.push(`    /** ${colorDoc(c)} */`);
    o.push(`    val ${c.id}: Color`);
  }
  o.push("}");
  for (const theme of ["light", "dark"]) {
    o.push("");
    o.push(`object BB${upperFirst(theme)}Colors : BBColors {`);
    for (const c of colors) o.push(`    override val ${c.id} = Color(${composeARGB(c[theme])})`);
    o.push("}");
  }
  o.push("");
  o.push("/** Category/account color keys (persisted server-side; never rename or reorder). */");
  o.push("object BBSwatch {");
  o.push("    /** All 48 keys in persisted order (`distributeColors` uses index % 48). */");
  o.push("    val order: List<String> = listOf(");
  for (let i = 0; i < swatchOrder.length; i += 8) {
    o.push(`        ${swatchOrder.slice(i, i + 8).map((k) => `"${k}"`).join(", ")},`);
  }
  o.push("    )");
  o.push("");
  o.push("    /** The 16 base keys offered in color pickers, in order. */");
  o.push("    val pickerKeys: List<String> = order.take(16)");
  o.push("");
  o.push("    /** Color for a stored key; unknown or legacy keys fall back to `slate`. */");
  o.push("    fun color(colors: BBColors, key: String): Color =");
  o.push("        when (key) {");
  for (const key of swatchOrder) o.push(`            "${key}" -> colors.${swatchByKey.get(key).id}`);
  o.push(`            else -> colors.${swatchByKey.get("slate").id}`);
  o.push("        }");
  o.push("}");
  o.push("");
  o.push("// ---------------------------------------------------------------- Dimensions");
  for (const [cat, typeName, doc] of dimensionGroups) {
    o.push("");
    o.push(`/** ${doc} */`);
    o.push(`object ${typeName} {`);
    for (const t of dimsOf(cat)) {
      if (t.note) o.push(`    /** ${t.note} */`);
      if (t.type === "number") o.push(`    /** ${t.unit} */\n    const val ${ident(t.name)}: Float = ${fl(t.value)}`);
      else o.push(`    val ${ident(t.name)}: Dp = ${num(t.value)}.dp`);
    }
    o.push("}");
  }
  o.push("");
  o.push("// ---------------------------------------------------------------- Fonts");
  o.push("");
  o.push("/** Bundled static font instances (res/font). */");
  o.push("object BBFontFamilies {");
  for (const f of families) {
    o.push(`    /** ${f.name} — ${f.token.role ?? ""} */`);
    if (f.system) {
      o.push(`    val ${f.role}: FontFamily = FontFamily.Monospace`);
      continue;
    }
    o.push(`    val ${f.role}: FontFamily = FontFamily(`);
    for (const x of f.faces) o.push(`        Font(R.font.${x.androidRes}, FontWeight.W${x.weight}),`);
    o.push("    )");
  }
  o.push("}");
  o.push("");
  o.push("/** Font size with its line height (`TextUnit.Unspecified` = inherits). */");
  o.push("data class BBFontSize(val size: TextUnit, val lineHeight: TextUnit)");
  o.push("");
  o.push("/** Raw font scale tokens (font.*). Prefer [BBTextStyle] in UI code. Tracking values are em. */");
  o.push("object BBFontTokens {");
  for (const t of tokens.filter((x) => category(x) === "font")) {
    const id = ident(t.name);
    switch (t.type) {
      case "fontFamily":
        o.push(`    const val ${id}: String = "${t.value}"`);
        break;
      case "fontWeight":
        o.push(`    val ${id}: FontWeight = FontWeight(${t.value})`);
        break;
      case "fontSize":
        o.push(`    val ${id} = BBFontSize(${num(t.size)}.sp, ${t.lineHeight == null ? "TextUnit.Unspecified" : `${num(t.lineHeight)}.sp`})`);
        break;
      case "letterSpacing":
      case "lineHeightMultiplier":
        o.push(`    const val ${id}: Float = ${fl(t.value)}`);
        break;
      default:
        throw new Error(`unexpected font token ${t.name}`);
    }
  }
  o.push("}");
  o.push("");
  o.push("// ---------------------------------------------------------------- Typography (typography.*)");
  o.push("");
  o.push("/** CSS half-leading: center glyphs in the line box, no trimming (tokens.md §9). */");
  o.push("private val CssLineHeight = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)");
  o.push("");
  o.push("/**");
  o.push(" * Semantic text styles. [uppercase] styles must be rendered with `text.uppercase(locale)`;");
  o.push(" * tabular figures are already in the TextStyle (`tnum`).");
  o.push(" */");
  o.push("enum class BBTextStyle(val style: TextStyle, val uppercase: Boolean) {");
  for (const t of typography) {
    if (t.note) o.push(`    /** ${t.note} */`);
    o.push(`    ${upperFirst(t.id)}(`);
    o.push("        TextStyle(");
    o.push(`            fontFamily = BBFontFamilies.${t.fam.role},`);
    o.push(`            fontWeight = FontWeight.W${t.weight},`);
    o.push(`            fontSize = ${num(t.size)}.sp,`);
    o.push(`            lineHeight = ${num(t.lineHeight)}.sp,`);
    o.push(`            letterSpacing = ${(t.letterSpacingEm ?? 0) < 0 ? `(${ktDouble(t.letterSpacingEm)})` : ktDouble(t.letterSpacingEm ?? 0)}.em,`);
    if (t.tabularNums) o.push(`            fontFeatureSettings = "tnum",`);
    o.push("            lineHeightStyle = CssLineHeight,");
    o.push("        ),");
    o.push(`        uppercase = ${!!t.uppercase},`);
    o.push("    ),");
  }
  o.push("}");
  o.push("");
  o.push("// ---------------------------------------------------------------- Elevation");
  o.push("");
  o.push("/** One CSS box-shadow layer. */");
  o.push("data class BBShadowLayer(val x: Dp, val y: Dp, val blur: Dp, val spread: Dp, val color: Color)");
  o.push("");
  o.push("object BBShadow {");
  for (const t of ofType("shadow")) {
    o.push(`    val ${ident(t.name)}: List<BBShadowLayer> = listOf(`);
    for (const l of t.layers) {
      o.push(`        BBShadowLayer(${num(l.x)}.dp, ${num(l.y)}.dp, ${num(l.blur)}.dp, ${l.spread < 0 ? `(${num(l.spread)}).dp` : `${num(l.spread)}.dp`}, Color(${composeARGB(l.color)})),`);
    }
    o.push("    )");
  }
  o.push("}");
  o.push("");
  o.push("object BBElevation {");
  for (const t of ofType("border")) {
    const ref = byName.get(t.color);
    if (!ref) throw new Error(`${t.name}: unknown color ${t.color}`);
    if (t.note) o.push(`    /** ${t.note} */`);
    o.push(`    val ${ident(t.name)}Width: Dp = ${num(t.width)}.dp`);
    o.push(`    fun ${ident(t.name)}Color(colors: BBColors): Color = colors.${ident(ref.name)}`);
  }
  o.push("}");
  o.push("");
  o.push("// ---------------------------------------------------------------- Motion");
  o.push("");
  o.push("/** Mass-spring-damper parameters (same equation as the web). */");
  o.push("data class BBSpring(val stiffness: Float, val damping: Float, val mass: Float, val dampingRatio: Float, val settleMs: Int) {");
  o.push("    /** Compose assumes mass 1, so stiffness is divided by mass (tokens.md §6.1). */");
  o.push("    fun <T> spec(): SpringSpec<T> = spring(dampingRatio = dampingRatio, stiffness = stiffness / mass)");
  o.push("}");
  o.push("");
  o.push("object BBMotion {");
  for (const t of ofType("spring")) {
    if (t.note) o.push(`    /** ${t.note} */`);
    o.push(`    val ${ident(t.name)} = BBSpring(${fl(t.stiffness)}, ${fl(t.damping)}, ${fl(t.mass)}, ${fl(t.dampingRatio)}, ${t.settleMs})`);
  }
  for (const t of ofType("duration")) o.push(`    /** ms */\n    const val ${ident(t.name)}: Int = ${t.value}`);
  for (const t of ofType("cubicBezier")) {
    o.push(`    val ${ident(t.name)} = CubicBezierEasing(${t.value.map(fl).join(", ")})`);
  }
  o.push("}");
  o.push("");
  return o.join("\n");
}

// =====================================================================================
console.log("gen-tokens");
if (ios) {
  writeOut(join(ios, "BuddyBudget", "DesignSystem", "Generated", "Tokens.swift"), swiftTokens());
  const fontOut = join(ios, "BuddyBudget", "Resources", "Fonts");
  for (const f of families.filter((x) => !x.system)) {
    for (const x of f.faces) copyOut(join(staticDir, x.file), join(fontOut, x.file));
    copyOut(join(fontsDir, f.license), join(fontOut, f.license));
  }
  const keepIos = new Set(families.flatMap((f) => (f.system ? [] : [...f.faces.map((x) => x.file), f.license])));
  removeStale(fontOut, (name) => /\.(ttf|otf)$|-OFL\.txt$/.test(name) && !keepIos.has(name));
  // project.yml must register every font under UIAppFonts.
  const projectYml = readFileSync(join(ios, "project.yml"), "utf8");
  const missing = families.flatMap((f) => f.faces.map((x) => x.file)).filter((file) => !projectYml.includes(file));
  if (missing.length) console.warn(`  warning: project.yml UIAppFonts is missing: ${missing.join(", ")}`);
}
if (android) {
  const appMain = join(android, "app", "src", "main");
  writeOut(join(appMain, "kotlin", "io", "buddybudget", "app", "designsystem", "generated", "Tokens.kt"), kotlinTokens());
  for (const f of families.filter((x) => !x.system)) {
    for (const x of f.faces) copyOut(join(staticDir, x.file), join(appMain, "res", "font", `${x.androidRes}.ttf`));
    copyOut(join(fontsDir, f.license), join(appMain, "assets", "licenses", f.license));
  }
  const keepRes = new Set(families.flatMap((f) => f.faces.map((x) => `${x.androidRes}.ttf`)));
  removeStale(join(appMain, "res", "font"), (name) => name.endsWith(".ttf") && !keepRes.has(name));
  const keepLic = new Set(families.filter((f) => !f.system).map((f) => f.license));
  removeStale(join(appMain, "assets", "licenses"), (name) => name.endsWith("-OFL.txt") && !keepLic.has(name));
}
console.log(`  ${colors.length} colors, ${typography.length} text styles, ${families.reduce((n, f) => n + f.faces.length, 0)} font files`);
