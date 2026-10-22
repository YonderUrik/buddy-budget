#!/usr/bin/env node
// Generate the Android string resources from strings/catalog.json + strings/mobile.json.
//
// Usage: node scripts/gen-strings-android.mjs <android-repo-path>
// Writes (relative to the Android repo):
//   app/src/main/res/values/strings_generated.xml      Italian (default resources)
//   app/src/main/res/values-en/strings_generated.xml   English
//   app/src/main/res/values-de/strings_generated.xml   German
//   app/src/main/kotlin/io/buddybudget/app/generated/L10n.kt              aliases + Italian-source lookup map
//   app/src/main/kotlin/io/buddybudget/app/generated/LocalizedStrings.kt  account-driven language switching
import { join } from "node:path";
import { header, requireDir, writeOut } from "./lib/common.mjs";
import { loadMergedStrings, tokenize } from "./lib/strings.mjs";

const SCRIPT = "gen-strings-android.mjs";
const SOURCES = ["strings/catalog.json", "strings/mobile.json"];
const android = requireDir(process.argv[2] ?? "", "Android repo (pass its path as the first argument)");
const main = join(android, "app", "src", "main");
const pkgDir = join(main, "kotlin", "io", "buddybudget", "app", "generated");

const { catalog, entries, aliases } = loadMergedStrings();

// ---------- strings.xml ----------
const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Escape a literal run of text for an Android <string> body (aapt2 rules). */
function escapeLiteral(text, hasArgs) {
  let s = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  if (hasArgs) s = s.replace(/%/g, "%%");
  return s;
}

/** Returns {body, formattedFalse}. Placeholders → %N$s. */
function androidValue(text, names) {
  const hasArgs = names.length > 0;
  let body = tokenize(text, names)
    .map((p) => (p.arg ? `%${p.arg}$s` : escapeLiteral(p.text, hasArgs)))
    .join("");
  if (/^[@?]/.test(body)) body = "\\" + body; // resource/attribute reference markers
  // aapt2 trims and collapses whitespace outside double quotes: quote to keep it byte-exact.
  if (/^\s|\s$|\s\s/.test(text)) body = `"${body}"`;
  return { body: xmlEscape(body), formattedFalse: !hasArgs && text.includes("%") };
}

function stringsXml(lang) {
  const lines = ['<?xml version="1.0" encoding="utf-8"?>', header(SCRIPT, SOURCES, "xml"), "<resources>"];
  for (const e of entries) {
    const { body, formattedFalse } = androidValue(e[lang], e.placeholders);
    lines.push(`    <string name="${e.id}"${formattedFalse ? ' formatted="false"' : ""}>${body}</string>`);
  }
  lines.push("</resources>", "");
  return lines.join("\n");
}

// ---------- L10n.kt ----------
const ktStr = (s) =>
  '"' +
  s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/[\x00-\x1f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`) +
  '"';
const kdoc = (s) => s.replace(/\*\//g, "*∕").replace(/\r?\n/g, "⏎");

const CHUNK = 250; // keeps every generated method far below the JVM's 64 KB bytecode limit
const chunks = [];
for (let i = 0; i < entries.length; i += CHUNK) chunks.push(entries.slice(i, i + CHUNK));
const withArgs = entries.filter((e) => e.placeholders.length);

const kt = [];
kt.push(header(SCRIPT, SOURCES));
kt.push(`// Catalog ${catalog.version} · ${entries.length} strings`);
kt.push('@file:Suppress("SpellCheckingInspection", "LargeClass", "MaxLineLength")');
kt.push("");
kt.push("package io.buddybudget.app.generated");
kt.push("");
kt.push("import androidx.annotation.StringRes");
kt.push("import io.buddybudget.app.R");
kt.push("");
kt.push("/**");
kt.push(" * Generated string helpers. Every catalog entry is a `R.string.<id>` resource");
kt.push(" * (`values/` = Italian, `values-en/`, `values-de/`); resolve them with [LocalizedStrings] so the");
kt.push(" * account language wins over the device language.");
kt.push(" */");
kt.push("object L10n {");
kt.push("    // Friendly names (strings/mobile.json `aliases`).");
for (const a of aliases) {
  kt.push(`    /** ${kdoc(a.entry.it)} */`);
  kt.push(`    @get:StringRes val ${a.name}: Int get() = R.string.${a.entry.id}`);
}
kt.push("");
kt.push("    /** Resource id for an Italian source string returned by the API, or null if the catalog lacks it. */");
kt.push("    @StringRes");
kt.push("    fun idForItalian(source: String): Int? = index[source]");
kt.push("");
kt.push("    /** Placeholder names, in `%N\\$s` argument order, for a resource id (empty when none). */");
kt.push("    fun placeholderNames(@StringRes id: Int): List<String> = placeholders[id] ?: emptyList()");
kt.push("");
kt.push(`    private val index: Map<String, Int> by lazy {`);
kt.push(`        HashMap<String, Int>(${Math.ceil((entries.length * 4) / 3) + 1}).also { m ->`);
for (let i = 0; i < chunks.length; i++) kt.push(`            L10nIndex${i}.fill(m)`);
kt.push("        }");
kt.push("    }");
kt.push("");
kt.push(`    private val placeholders: Map<Int, List<String>> by lazy {`);
kt.push(`        HashMap<Int, List<String>>(${Math.ceil((withArgs.length * 4) / 3) + 1}).also { m ->`);
for (let i = 0; i < withArgs.length; i += CHUNK) kt.push(`            L10nPlaceholders${i / CHUNK}.fill(m)`);
kt.push("        }");
kt.push("    }");
kt.push("}");
for (let i = 0; i < chunks.length; i++) {
  kt.push("");
  kt.push(`private object L10nIndex${i} {`);
  kt.push("    fun fill(m: HashMap<String, Int>) {");
  for (const e of chunks[i]) kt.push(`        m[${ktStr(e.it)}] = R.string.${e.id}`);
  kt.push("    }");
  kt.push("}");
}
for (let i = 0; i < withArgs.length; i += CHUNK) {
  kt.push("");
  kt.push(`private object L10nPlaceholders${i / CHUNK} {`);
  kt.push("    fun fill(m: HashMap<Int, List<String>>) {");
  for (const e of withArgs.slice(i, i + CHUNK)) {
    kt.push(`        m[R.string.${e.id}] = listOf(${e.placeholders.map(ktStr).join(", ")})`);
  }
  kt.push("    }");
  kt.push("}");
}
kt.push("");

// ---------- LocalizedStrings.kt ----------
const localized = `${header(SCRIPT, SOURCES)}

package io.buddybudget.app.generated

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.content.res.Resources
import android.os.LocaleList
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

/**
 * Language of the signed-in account (\`user.language\`). The app language follows the account,
 * never the device language (spec: domain/formatting-localization.md §1).
 */
enum class AppLanguage(val code: String, val localeTag: String) {
    IT("it", "it-IT"),
    EN("en", "en-GB"),
    DE("de", "de-DE"),
    ;

    /** Formatting locale for \`BBFormat\`. */
    val locale: Locale get() = Locale.forLanguageTag(localeTag)

    companion object {
        /**
         * Resolves the stored language against the product country, like the web:
         * IT allows it/en (default it), DE allows en/de (default en), OTHER allows en/it/de (default en).
         * Unknown country → IT rules.
         */
        fun resolve(language: String?, productCountry: String?): AppLanguage {
            val requested = entries.firstOrNull { it.code == language?.lowercase() }
            val (allowed, fallback) = when (productCountry?.uppercase()) {
                "DE" -> listOf(EN, DE) to EN
                "OTHER" -> listOf(EN, IT, DE) to EN
                else -> listOf(IT, EN) to IT
            }
            return if (requested != null && requested in allowed) requested else fallback
        }
    }
}

/**
 * Resolves generated \`R.string\` resources in the account language.
 *
 * How it works: the generator writes Italian into \`values/\` and translations into \`values-en/\`
 * and \`values-de/\`. Instead of relying on the device locale, this class builds a
 * \`Resources\` object for the account's locale (\`createConfigurationContext\`) and reads every
 * string from it. In Compose, wrap the UI in [ProvideLocalizedStrings] and read strings with
 * [l10n]; when \`user.language\` changes, pass the new [AppLanguage] and the tree recomposes.
 * The provider also overrides \`LocalContext\`/\`LocalConfiguration\` so locale-aware Material
 * components (date pickers, …) follow the account language.
 *
 * Prefer [l10n] over \`stringResource\`: depending on the Compose version, \`stringResource\` may read
 * resources that ignore the override.
 */
class LocalizedStrings(base: Context, val language: AppLanguage) {
    val configuration: Configuration =
        Configuration(base.resources.configuration).apply { setLocales(LocaleList(language.locale)) }

    val resources: Resources = base.createConfigurationContext(configuration).resources

    /** A context that keeps the Activity chain (for permission/result APIs) but resolves localized resources. */
    val context: Context =
        object : ContextWrapper(base) {
            override fun getResources(): Resources = this@LocalizedStrings.resources
        }

    /** Text of a resource; \`args\` are already-formatted values for \`%N\\$s\` placeholders. */
    fun get(@StringRes id: Int, vararg args: Any): String =
        if (args.isEmpty()) resources.getString(id) else resources.getString(id, *args)

    /**
     * Translates an Italian source label returned by the API, exactly like the web's
     * \`translate(language, source, values)\`: unknown sources fall back to the Italian text and
     * \`{name}\` placeholders without a value are left as-is.
     */
    fun lookup(italian: String, values: Map<String, String> = emptyMap()): String {
        val id = L10n.idForItalian(italian) ?: return substitute(italian, values)
        val names = L10n.placeholderNames(id)
        if (names.isEmpty()) return resources.getString(id)
        return resources.getString(id, *names.map { values[it] ?: "{" + it + "}" }.toTypedArray())
    }

    private fun substitute(text: String, values: Map<String, String>): String =
        if (values.isEmpty()) text else PLACEHOLDER.replace(text) { m -> values[m.groupValues[1]] ?: m.value }

    private companion object {
        val PLACEHOLDER = Regex("""\\{(\\w+)\\}""")
    }
}

val LocalStrings = staticCompositionLocalOf<LocalizedStrings> {
    error("No LocalizedStrings provided: wrap the UI in ProvideLocalizedStrings(language)")
}

/** Provides [LocalizedStrings] for [language] to [content]. */
@Composable
fun ProvideLocalizedStrings(language: AppLanguage, content: @Composable () -> Unit) {
    val base = LocalContext.current
    val strings = remember(base, language) { LocalizedStrings(base, language) }
    CompositionLocalProvider(
        LocalStrings provides strings,
        LocalContext provides strings.context,
        LocalConfiguration provides strings.configuration,
        content = content,
    )
}

/** Composable accessor: \`l10n(L10n.retry)\`, \`l10n(R.string.data_as_of_0_8edc5c, date)\`. */
@Composable
@ReadOnlyComposable
fun l10n(@StringRes id: Int, vararg args: Any): String = LocalStrings.current.get(id, *args)
`;

console.log("gen-strings-android");
writeOut(join(main, "res", "values", "strings_generated.xml"), stringsXml("it"));
writeOut(join(main, "res", "values-en", "strings_generated.xml"), stringsXml("en"));
writeOut(join(main, "res", "values-de", "strings_generated.xml"), stringsXml("de"));
writeOut(join(pkgDir, "L10n.kt"), kt.join("\n"));
writeOut(join(pkgDir, "LocalizedStrings.kt"), localized);
console.log(`  ${entries.length} strings × 3 languages, ${aliases.length} aliases, ${chunks.length} index chunks`);
