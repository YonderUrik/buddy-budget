#!/usr/bin/env node
// Generate the iOS string resources from strings/catalog.json + strings/mobile.json.
//
// Usage: node scripts/gen-strings-ios.mjs <ios-repo-path>
// Writes (relative to the iOS repo):
//   BuddyBudget/Resources/Localizable.xcstrings          string catalog, source language it, + en, de
//   BuddyBudget/Resources/Generated/L10n.swift           typed accessors + L10n.lookup(italian:) runtime lookup
//   BuddyBudget/Resources/Generated/LocalizedStrings.swift  account-driven language switching
import { join } from "node:path";
import { camel, header, requireDir, writeOut } from "./lib/common.mjs";
import { LANGS, loadMergedStrings, tokenize } from "./lib/strings.mjs";

const SCRIPT = "gen-strings-ios.mjs";
const SOURCES = ["strings/catalog.json", "strings/mobile.json"];
const ios = requireDir(process.argv[2] ?? "", "iOS repo (pass its path as the first argument)");
const resDir = join(ios, "BuddyBudget", "Resources");

const { catalog, entries, aliases } = loadMergedStrings();

// ---------- Localizable.xcstrings ----------
/** `{x}` → `%N$@`, literal `%` → `%%` (every value is passed through String(format:)). */
function iosTemplate(text, names) {
  return tokenize(text, names)
    .map((p) => (p.arg ? `%${p.arg}$@` : p.text.replace(/%/g, "%%")))
    .join("");
}

const strings = {};
for (const e of entries) {
  const localizations = {};
  for (const l of [...LANGS].sort()) {
    localizations[l] = { stringUnit: { state: "translated", value: iosTemplate(e[l], e.placeholders) } };
  }
  strings[e.id] = { extractionState: "manual", localizations };
}
// Xcode's own formatting (`"key" : value`, two-space indent) so opening the catalog in Xcode does not rewrite it.
const xcstrings =
  JSON.stringify({ sourceLanguage: "it", strings, version: "1.0" }, null, 2).replace(
    /^(\s*"(?:[^"\\]|\\.)*"): /gm,
    "$1 : ",
  ) + "\n";

// ---------- L10n.swift ----------
const SWIFT_KEYWORDS = new Set(
  ("associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private " +
    "precedencegroup protocol public rethrows static struct subscript typealias var break case catch continue default " +
    "defer do else fallthrough for guard if in repeat return throw switch where while as false is nil self Self super " +
    "throws true try any some Type await async lookup key")
    .split(" "),
);

function swiftIdent(words) {
  let id = camel(words);
  if (!id) id = "s";
  if (/^[0-9]/.test(id)) id = "s" + id;
  if (SWIFT_KEYWORDS.has(id)) id += "_";
  return id;
}

const swiftStr = (s) =>
  '"' +
  s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/[\x00-\x1f]/g, (c) => `\\u{${c.charCodeAt(0).toString(16)}}`) +
  '"';

const docText = (s) => s.replace(/\r?\n/g, "⏎").replace(/\s+$/, "␠").replace(/^\s+/, "␠");

// Accessor names: the id without its hash; names shared by several entries keep the hash so they never depend on order.
const baseName = (e) => swiftIdent(e.id.replace(/_[0-9a-f]{6}$/, "").replace(/^s_/, "").split("_"));
// Alias names (mobile.json) win: an accessor whose name an alias takes keeps its hash suffix instead.
const aliasNames = new Set();
for (const a of aliases) {
  if (aliasNames.has(a.name) || SWIFT_KEYWORDS.has(a.name)) throw new Error(`alias ${a.name} is duplicated or reserved`);
  aliasNames.add(a.name);
}
const nameCount = new Map();
for (const e of entries) nameCount.set(baseName(e), (nameCount.get(baseName(e)) ?? 0) + 1);
const accessorName = new Map(
  entries.map((e) => {
    const b = baseName(e);
    return [e.id, nameCount.get(b) > 1 || aliasNames.has(b) ? `${b}_${e.id.slice(-6)}` : b];
  }),
);

const paramName = (p) => (/^[0-9]/.test(p) ? `p${p}` : SWIFT_KEYWORDS.has(p) ? `${p}_` : p);
function signature(name, e) {
  if (!e.placeholders.length) return { decl: `static var ${name}: String`, call: null };
  const params = e.placeholders.map((p) => `_ ${paramName(p)}: String`).join(", ");
  return { decl: `static func ${name}(${params}) -> String`, args: e.placeholders.map(paramName) };
}

const out = [];
out.push(header(SCRIPT, SOURCES));
out.push(`// Catalog ${catalog.version} · ${entries.length} strings`);
out.push("");
out.push("import Foundation");
out.push("");
out.push("/// Typed accessors for every UI string (spec: domain/formatting-localization.md §5).");
out.push("///");
out.push("/// Names come from the English text; the doc comment shows the Italian source and English text.");
out.push("/// Values resolve in the *account* language held by `LocalizedStrings.shared`, not the device language.");
out.push("/// Strings with `{n}` placeholders are functions taking already-formatted values (use `BBFormat`).");
out.push("enum L10n {");
for (const e of entries) {
  const name = accessorName.get(e.id);
  const sig = signature(name, e);
  out.push(`    /// it: ${docText(e.it)}`);
  out.push(`    /// en: ${docText(e.en)}`);
  if (!sig.args) out.push(`    ${sig.decl} { LocalizedStrings.shared.string(${swiftStr(e.id)}) }`);
  else out.push(`    ${sig.decl} { LocalizedStrings.shared.format(${swiftStr(e.id)}, [${sig.args.join(", ")}]) }`);
}
out.push("");
out.push("    // MARK: Aliases (strings/mobile.json `aliases`)");
for (const a of aliases) {
  const e = a.entry;
  const sig = signature(a.name, e);
  const target = accessorName.get(e.id);
  out.push(`    /// Alias of \`${target}\` — it: ${docText(e.it)}`);
  out.push(sig.args ? `    ${sig.decl} { ${target}(${sig.args.join(", ")}) }` : `    ${sig.decl} { ${target} }`);
}
out.push("}");
out.push("");
out.push("// MARK: - Runtime lookup by Italian source text");
out.push("");
out.push("extension L10n {");
out.push("    /// Translates an Italian source label returned by the API (e.g. group labels \"Dovute\", \"Oggi\"),");
out.push("    /// exactly like the web's `translate(language, source, values)`: unknown sources fall back to the");
out.push("    /// Italian text, and `{name}` placeholders without a value are left as-is.");
out.push("    static func lookup(italian source: String, _ values: [String: String] = [:]) -> String {");
out.push("        guard let key = L10nIndex.sourceIndex[source] else { return L10nIndex.substitute(source, values) }");
out.push("        guard let names = L10nIndex.placeholderNames[key] else { return LocalizedStrings.shared.string(key) }");
out.push('        return LocalizedStrings.shared.format(key, names.map { values[$0] ?? "{" + $0 + "}" })');
out.push("    }");
out.push("");
out.push("    /// Catalog key for an Italian source string, if the catalog has it.");
out.push("    static func key(italian source: String) -> String? { L10nIndex.sourceIndex[source] }");
out.push("}");
out.push("");
out.push("/// Data behind `L10n.lookup(italian:)`; kept out of `L10n` so it cannot clash with accessor names.");
out.push("enum L10nIndex {");
out.push("    static func substitute(_ text: String, _ values: [String: String]) -> String {");
out.push("        guard !values.isEmpty, text.contains(\"{\") else { return text }");
out.push("        var result = \"\"");
out.push("        var rest = Substring(text)");
out.push("        while let open = rest.firstIndex(of: \"{\") {");
out.push("            result += rest[..<open]");
out.push("            let after = rest.index(after: open)");
out.push("            if let close = rest[after...].firstIndex(of: \"}\"),");
out.push("               case let name = rest[after..<close],");
out.push("               !name.isEmpty, name.allSatisfy({ $0.isLetter || $0.isNumber || $0 == \"_\" }),");
out.push("               let value = values[String(name)] {");
out.push("                result += value");
out.push("                rest = rest[rest.index(after: close)...]");
out.push("            } else {");
out.push("                result += \"{\"");
out.push("                rest = rest[after...]");
out.push("            }");
out.push("        }");
out.push("        result += rest");
out.push("        return result");
out.push("    }");
out.push("");
out.push("    /// Placeholder names (in argument order) of the keys that have placeholders.");
out.push("    static let placeholderNames: [String: [String]] = [");
for (const e of entries.filter((x) => x.placeholders.length)) {
  out.push(`        ${swiftStr(e.id)}: [${e.placeholders.map(swiftStr).join(", ")}],`);
}
out.push("    ]");
out.push("");
out.push("    /// Italian source text → catalog key.");
out.push("    static let sourceIndex: [String: String] = Dictionary(uniqueKeysWithValues: zip(sources, keys))");
out.push("");
out.push("    // Parallel arrays: plain array literals type-check much faster than a 4 000-entry dictionary literal.");
out.push("    private static let sources: [String] = [");
for (const e of entries) out.push(`        ${swiftStr(e.it)},`);
out.push("    ]");
out.push("    private static let keys: [String] = [");
for (const e of entries) out.push(`        ${swiftStr(e.id)},`);
out.push("    ]");
out.push("}");
out.push("");

// ---------- LocalizedStrings.swift ----------
const localized = `${header(SCRIPT, SOURCES)}

import Foundation
import Observation

/// Language of the signed-in account (\`user.language\`). The app language follows the account,
/// never the device language (spec: domain/formatting-localization.md §1).
enum AppLanguage: String, CaseIterable, Sendable {
    case it, en, de

    /// Formatting locale for \`BBFormat\`: it → it-IT, en → en-GB, de → de-DE.
    var localeIdentifier: String {
        switch self {
        case .it: "it-IT"
        case .en: "en-GB"
        case .de: "de-DE"
        }
    }

    var locale: Locale { Locale(identifier: localeIdentifier) }

    /// Resolves the stored language against the product country, like the web:
    /// IT allows it/en (default it), DE allows en/de (default en). Unknown country → IT rules.
    static func resolve(language: String?, productCountry: String?) -> AppLanguage {
        let requested = language.flatMap { AppLanguage(rawValue: $0.lowercased()) }
        let (allowed, fallback): ([AppLanguage], AppLanguage) =
            productCountry?.uppercased() == "DE" ? ([.en, .de], .en) : ([.it, .en], .it)
        if let requested, allowed.contains(requested) { return requested }
        return fallback
    }
}

/// Resolves catalog keys in the account language.
///
/// How it works: Xcode compiles \`Localizable.xcstrings\` into \`it.lproj\`, \`en.lproj\` and \`de.lproj\`
/// inside the app bundle. Instead of letting \`Bundle.main\` pick the device language, this class
/// loads the \`.lproj\` bundle of the language chosen in the user's account and resolves every
/// \`L10n\` accessor through it.
///
/// Usage:
/// - After sign-in / on \`/api/user/settings\` changes, call
///   \`LocalizedStrings.shared.setLanguage(.resolve(language: user.language, productCountry: user.productCountry))\`.
///   When signed out, use the persisted \`bb-language\` choice (default \`.it\`).
/// - SwiftUI views refresh automatically: reading any \`L10n\` value on the main thread registers an
///   Observation dependency on the current language, so bodies re-render after \`setLanguage\`.
/// - Pass \`LocalizedStrings.shared.locale\` to \`BBFormat\` and \`.environment(\\.locale, …)\` at the root so
///   system controls (date pickers) match.
/// - Missing keys fall back to the Italian source (same as the web), then to the key itself.
@Observable
final class LocalizedStrings: @unchecked Sendable {
    static let shared = LocalizedStrings()

    /// Bumped on every language change; read on the main thread to register SwiftUI dependencies.
    private var revision = 0
    @ObservationIgnored private let lock = NSLock()
    @ObservationIgnored private let baseBundle: Bundle
    @ObservationIgnored private var current: AppLanguage
    @ObservationIgnored private var bundles: [AppLanguage: Bundle] = [:]

    init(bundle: Bundle = .main, language: AppLanguage = .it) {
        baseBundle = bundle
        current = language
    }

    var language: AppLanguage {
        observe()
        return lock.withLock { current }
    }

    var locale: Locale { language.locale }

    @MainActor
    func setLanguage(_ language: AppLanguage) {
        let changed = lock.withLock { () -> Bool in
            guard current != language else { return false }
            current = language
            return true
        }
        if changed { revision &+= 1 }
    }

    /// Text for a key without placeholders.
    func string(_ key: String) -> String {
        format(key, [])
    }

    /// Text for a key with positional \`%N$@\` placeholders.
    func format(_ key: String, _ args: [String]) -> String {
        observe()
        let (template, locale) = lock.withLock { () -> (String, Locale) in
            (rawTemplate(key, in: current), current.locale)
        }
        // Every catalog value escapes a literal % as %%, so always run it through String(format:).
        return String(format: template, locale: locale, arguments: args.map { $0 as CVarArg })
    }

    // MARK: Private (call with the lock held)

    private static let missing = "\\u{1}__missing__"

    private func rawTemplate(_ key: String, in language: AppLanguage) -> String {
        let value = bundle(for: language).localizedString(forKey: key, value: Self.missing, table: "Localizable")
        if value != Self.missing { return value }
        if language != .it {
            let italian = bundle(for: .it).localizedString(forKey: key, value: Self.missing, table: "Localizable")
            if italian != Self.missing { return italian }
        }
        return key.replacingOccurrences(of: "%", with: "%%")
    }

    private func bundle(for language: AppLanguage) -> Bundle {
        if let cached = bundles[language] { return cached }
        let resolved = baseBundle.path(forResource: language.rawValue, ofType: "lproj").flatMap(Bundle.init(path:)) ?? baseBundle
        bundles[language] = resolved
        return resolved
    }

    private func observe() {
        if Thread.isMainThread { _ = revision }
    }
}
`;

console.log("gen-strings-ios");
writeOut(join(resDir, "Localizable.xcstrings"), xcstrings);
writeOut(join(resDir, "Generated", "L10n.swift"), out.join("\n"));
writeOut(join(resDir, "Generated", "LocalizedStrings.swift"), localized);
console.log(`  ${entries.length} strings, ${aliases.length} aliases, ${entries.filter((e) => e.placeholders.length).length} with placeholders`);
