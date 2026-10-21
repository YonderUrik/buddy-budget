package io.buddybudget.core.domain.format

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.log10
import kotlin.math.roundToInt

/** Formatting locale. Derived from the **account language**, never from the device. */
enum class BBLocale(val tag: String) {
    IT_IT("it-IT"),
    EN_GB("en-GB"),
    DE_DE("de-DE");

    val language: BBLanguage
        get() = when (this) {
            IT_IT -> BBLanguage.IT
            EN_GB -> BBLanguage.EN
            DE_DE -> BBLanguage.DE
        }

    companion object {
        fun fromTag(tag: String): BBLocale? = entries.firstOrNull { it.tag == tag }
        fun of(language: BBLanguage): BBLocale = when (language) {
            BBLanguage.IT -> IT_IT
            BBLanguage.EN -> EN_GB
            BBLanguage.DE -> DE_DE
        }
    }
}

/** Account language (`user.language`). */
enum class BBLanguage(val code: String) {
    IT("it"),
    EN("en"),
    DE("de");

    companion object {
        fun fromCode(code: String): BBLanguage? = entries.firstOrNull { it.code == code }
    }
}

/** Date skeletons the web uses (`locale-data.json → dateSkeletonsSample`). */
enum class BBDateSkeleton(val pattern: String) {
    D_MMM("d MMM"),
    D_MMM_Y("d MMM y"),
    D_MMMM_Y("d MMMM y"),
    D_MMMM("d MMMM"),
    MMMM_Y("MMMM y"),
    MMM_Y("MMM y"),
    MMM_YY("MMM yy"),
    D_MMM_YY("d MMM yy"),
    DD_MMM_Y("dd MMM y"),
    EEEE_D_MMMM("EEEE d MMMM"),
    EEEE_D_MMMM_Y("EEEE d MMMM y"),
    EEE_D_MMMM_Y("EEE d MMMM y"),
    HH_MM("HH:mm"),
}

/**
 * One locale's tables, loaded from the bundled copy of `spec/domain/locale-data/locale-data.json`
 * (exported from the web's ICU). Refresh: copy the spec file over
 * `core/src/main/resources/io/buddybudget/core/domain/format/locale-data.json`; the vector tests fail while
 * the two copies differ.
 */
internal class FormatLocaleTable(
    val decimal: String,
    val group: String,
    val minimumGroupingDigits: Int,
    val minusSign: String,
    val percentPattern: String,
    val currency: Map<String, CurrencyPattern>,
    /** Indexed by magnitude (floor(log10)) 3…14. */
    val compact: Map<Int, CompactEntry>,
    val monthsLong: List<String>,
    /** Stand-alone `{month:"short"}` (de "Mär", "Sep"). */
    val monthsShort: List<String>,
    /** Format-context abbreviation used inside dates (de "März", "Sept.", it "set"). */
    val monthsAbbreviated: List<String>,
    val weekdaysLong: List<String>,
    val weekdaysShort: List<String>,
    /** Skeleton → template with `{d}`, `{dd}`, `{MMM}`, `{MMMM}`, `{y}`, `{yy}`, `{EEEE}`, `{EEE}`, `{HH}`, `{mm}`. */
    val dateTemplates: Map<BBDateSkeleton, String>,
    val listConjunction2: String,
) {
    class CurrencyPattern(val pattern: String, val symbol: String)

    /** [divisorExponent] = power of ten the value is divided by (0 = not abbreviated, e.g. de-DE thousands). */
    class CompactEntry(val divisorExponent: Int, val prefix: String, val suffix: String)
}

internal object FormatLocaleData {
    const val RESOURCE = "/io/buddybudget/core/domain/format/locale-data.json"

    val tables: Map<BBLocale, FormatLocaleTable> by lazy {
        val text = bundledText() ?: error("BuddyBudget core: locale-data.json resource missing")
        load(text)
    }

    fun bundledText(): String? =
        FormatLocaleData::class.java.getResourceAsStream(RESOURCE)?.use { it.readBytes().toString(Charsets.UTF_8) }

    fun table(locale: BBLocale): FormatLocaleTable = tables.getValue(locale)

    fun load(text: String): Map<BBLocale, FormatLocaleTable> {
        val locales = Json.parseToJsonElement(text).jsonObject.getValue("locales").jsonObject
        return BBLocale.entries.associateWith { build(locales[it.tag]?.jsonObject ?: error("missing ${it.tag}")) }
    }

    private fun JsonObject.str(key: String) = getValue(key).jsonPrimitive.content
    private fun JsonObject.list(key: String) = getValue(key).jsonArray.map { it.jsonPrimitive.content }

    private fun build(raw: JsonObject): FormatLocaleTable {
        val group = raw.str("group")

        // Compact: "1 Mln" for 1e6 → divide by 1e6, suffix " Mln"; "10.000" (de, 1e4) → not abbreviated.
        val known = raw.getValue("compact").jsonObject.map { (key, value) ->
            val power = log10(key.toDouble()).roundToInt()
            val output = value.jsonPrimitive.content
            val start = output.indexOfFirst { it in '0'..'9' }
            require(start >= 0) { "compact $output" }
            var end = start
            while (end < output.length && (output[end] in '0'..'9' || output.substring(end).startsWith(group))) end++
            val shown = output.substring(start, end).filter { it in '0'..'9' }
            power to FormatLocaleTable.CompactEntry(power - (shown.length - 1), output.substring(0, start), output.substring(end))
        }.sortedBy { it.first }
        val compact = (3..14).mapNotNull { m -> known.lastOrNull { it.first <= m }?.let { m to it.second } }.toMap()

        // Format-context month abbreviation: "1. Jan." → "Jan.", "1 set" → "set".
        val stripped = raw.list("monthsShortInDate").map { it.trimStart('1') }
        var common = 0
        val first = stripped.first()
        while (common < first.length && !first[common].isLetter() && stripped.all { common < it.length && it[common] == first[common] }) common++
        val abbreviated = stripped.map { it.substring(common) }

        val weekdaysLong = raw.list("weekdaysLong")
        val weekdaysShort = raw.list("weekdaysShort")
        val monthsLong = raw.list("monthsLong")
        val outputs = raw.getValue("dateSkeletonsSample").jsonObject.getValue("outputs").jsonObject

        // Date templates from the sample date: Sunday 6 September 2026, 14:05.
        val samples = mapOf(
            "EEEE" to weekdaysLong[6], "EEE" to weekdaysShort[6], "MMMM" to monthsLong[8], "MMM" to abbreviated[8],
            "y" to "2026", "yy" to "26", "HH" to "14", "mm" to "05", "dd" to "06", "d" to "6",
        )
        val order = listOf("EEEE", "EEE", "MMMM", "MMM", "y", "yy", "HH", "mm", "dd", "d")
        val templates = BBDateSkeleton.entries.associateWith { skeleton ->
            var out = outputs[skeleton.pattern]?.jsonPrimitive?.content ?: error("skeleton ${skeleton.pattern}")
            val fields = skeleton.pattern.split(Regex("[^A-Za-z]+")).filter { it.isNotEmpty() }
            for (field in order) {
                if (field !in fields) continue
                val sample = samples.getValue(field)
                val at = out.indexOf(sample)
                require(at >= 0) { "field $field not found in $out" }
                out = out.substring(0, at) + "{$field}" + out.substring(at + sample.length)
            }
            out
        }

        return FormatLocaleTable(
            decimal = raw.str("decimal"),
            group = group,
            minimumGroupingDigits = raw.getValue("minimumGroupingDigits").jsonPrimitive.int,
            minusSign = raw.str("minusSign"),
            percentPattern = raw.str("percentPattern"),
            currency = raw.getValue("currency").jsonObject.mapValues { (_, v) ->
                FormatLocaleTable.CurrencyPattern(v.jsonObject.str("pattern"), v.jsonObject.str("symbol"))
            },
            compact = compact,
            monthsLong = monthsLong,
            monthsShort = raw.list("monthsShort"),
            monthsAbbreviated = abbreviated,
            weekdaysLong = weekdaysLong,
            weekdaysShort = weekdaysShort,
            dateTemplates = templates,
            listConjunction2 = raw.str("listConjunction2"),
        )
    }
}
