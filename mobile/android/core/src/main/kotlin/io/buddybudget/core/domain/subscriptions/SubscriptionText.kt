package io.buddybudget.core.domain.subscriptions

import io.buddybudget.core.data.SubscriptionActivity
import io.buddybudget.core.data.SubscriptionDecision
import io.buddybudget.core.data.SubscriptionItem
import io.buddybudget.core.data.SubscriptionPriceChange
import io.buddybudget.core.data.SubscriptionReason
import io.buddybudget.core.data.SubscriptionTotals
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate

/** A piece of a sentence with its emphasis, so whole-sentence catalog keys can still bold the name or the amounts. */
data class SubscriptionTextRun(val text: String, val style: Style = Style.Plain) {
    /** `Strong` = font-semibold (a name); `Amount` = semibold tabular in `--foreground`. */
    enum class Style { Plain, Strong, Amount }
}

/**
 * Hero line 2 (SUB-005): `Prossimo addebito: **name** {when}` and, with more than one charge in the window,
 * the muted `· nei prossimi 30 giorni {n} addebiti, {sum}`.
 */
data class SubscriptionNextChargeLine(val main: List<SubscriptionTextRun>, val window: String?)

/**
 * Subscription phrasing (web `subscriptions-format.ts` + the overview hero), bound to one language. [translate] maps an
 * Italian catalog key to its template in the app language (`LocalStrings.lookup` on Android, `L10n.lookup(italian:)` on
 * iOS; identity in tests). Same API as `SubscriptionText` on iOS.
 */
class SubscriptionText(val locale: BBLocale, private val translate: (String) -> String) {
    private val italian: Boolean get() = locale == BBLocale.IT_IT

    private fun tr(key: String, values: Map<String, String> = emptyMap()): String {
        val template = translate(key)
        return if (values.isEmpty()) template else BBFormat.interpolate(template, values)
    }

    private fun money(value: Double, currency: String, masked: Boolean, digits: Int = 2): String =
        BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits = digits, masked = masked)

    // Cadence

    /** `ogni mese`, or `cadenza da definire` when unknown. */
    fun cadenceLabel(cadence: SubscriptionCadence?): String =
        if (cadence == null) tr("cadenza da definire") else tr(cadenceKey(cadence))

    /** Select option: the label capitalized (`Ogni mese`). */
    fun cadenceOption(cadence: SubscriptionCadence): String = BBFormat.capitalize(tr(cadenceKey(cadence)))

    // Dates (SUB-006)

    /** «il 12 nov» / «l'8 nov» (Italian elides the article before 8 and 11); other languages use `il {0}`. */
    fun onDate(date: String, withYear: Boolean = false): String {
        val formatted = if (withYear) BBFormat.formatDateWithYear(date, locale) else BBFormat.formatShortDate(date, locale)
        if (italian) {
            val day = CalendarDate.parse(date)?.day ?: 0
            return (if (day == 8 || day == 11) "l'" else "il ") + formatted
        }
        return tr("il {0}", mapOf("0" to formatted))
    }

    /** «dal 12 nov» / «dall'8 nov». */
    fun fromDate(date: String, withYear: Boolean = false): String {
        val formatted = if (withYear) BBFormat.formatDateWithYear(date, locale) else BBFormat.formatShortDate(date, locale)
        if (italian) {
            val day = CalendarDate.parse(date)?.day ?: 0
            return (if (day == 8 || day == 11) "dall'" else "dal ") + formatted
        }
        return tr("dal {0}", mapOf("0" to formatted))
    }

    /** `oggi`, `domani`, `tra {n} giorni` (2–14), else the short date (with the year beyond 300 days). */
    fun whenPhrase(today: String, date: String): String {
        val days = SubscriptionsView.daysBetween(today, date)
        return when {
            days == 0 -> tr("oggi")
            days == 1 -> tr("domani")
            days in 2..14 -> tr("tra {0} giorni", mapOf("0" to days.toString()))
            else -> onDate(date, withYear = days > SubscriptionsView.YEAR_AWAY_DAYS)
        }
    }

    // Rows and detail (SUB-014, SUB-016)

    /** Row/detail hint line (`itemHint`). */
    fun hint(item: SubscriptionItem, today: String): String {
        val cadence = cadenceLabel(item.cadence)
        if (item.decision == SubscriptionDecision.Terminato || item.decision == SubscriptionDecision.Escluso) {
            val last = item.lastDate ?: return cadence
            return tr("{0} · ultimo addebito {1}", mapOf("0" to cadence, "1" to onDate(last)))
        }
        if (item.activity == SubscriptionActivity.Fermo) {
            val last = item.lastDate ?: return tr("{0} · non lo vediamo più tra i movimenti", mapOf("0" to cadence))
            return tr("Ultimo addebito {0}, atteso {1}", mapOf("0" to onDate(last), "1" to onDate(item.nextDate ?: last)))
        }
        val next = item.nextDate ?: return cadence
        val overdue = SubscriptionsView.daysBetween(today, next) < 0
        return "$cadence · ${if (overdue) tr("atteso") else tr("prossimo")} ${whenPhrase(today, next)}"
    }

    /** `era {old price}` under the amount after a rise. */
    fun previousPrice(change: SubscriptionPriceChange, currency: String, masked: Boolean): String =
        "${tr("era")} ${money(change.from, currency, masked)}"

    /** `{monthly}/mese` under the amount for non-monthly cadences. */
    fun monthlySuffix(monthly: Double, currency: String, masked: Boolean): String = money(monthly, currency, masked) + tr("/mese")

    /** Detail: `Pesa {monthly} al mese` (whole-sentence key). */
    fun monthlyWeight(monthly: Double, currency: String, masked: Boolean): String =
        tr("Pesa {0} al mese", mapOf("0" to money(monthly, currency, masked)))

    /** `Aumenti di prezzo` row hint: `Da {from} a {to} {dal d MMM}`. */
    fun priceRiseHint(change: SubscriptionPriceChange, currency: String, masked: Boolean): String =
        tr("Da {0} a {1} {2}", mapOf("0" to money(change.from, currency, masked), "1" to money(change.to, currency, masked), "2" to fromDate(change.since)))

    /** `+{difference}` in red. */
    fun priceRiseDelta(change: SubscriptionPriceChange, currency: String, masked: Boolean): String =
        "+" + money(JSNumber.round2(change.to - change.from), currency, masked)

    /** One `Perché lo vediamo qui` bullet (`reasonSentence`); null for a reason this version does not know. */
    fun reason(reason: SubscriptionReason, currency: String, masked: Boolean): String? = when (reason) {
        is SubscriptionReason.Count -> tr("{0} addebiti dello stesso esercente", mapOf("0" to reason.count.toString()))
        is SubscriptionReason.Cadence -> tr(
            "Tornano {0}{1}",
            mapOf("0" to tr(cadenceKey(reason.cadence)), "1" to if (reason.skipped) tr(" (un addebito è saltato, lo abbiamo perdonato)") else ""),
        )
        is SubscriptionReason.Amount -> if (reason.constant) tr("Importo sempre uguale") else tr("Importo quasi sempre uguale (differenze minime)")
        is SubscriptionReason.PriceChange -> tr(
            "Il prezzo è passato da {0} a {1} {2}",
            mapOf("0" to money(reason.from, currency, masked), "1" to money(reason.to, currency, masked), "2" to fromDate(reason.since, withYear = true)),
        )
        is SubscriptionReason.Day -> tr("Sempre intorno al giorno {0} del mese", mapOf("0" to reason.day.toString()))
        SubscriptionReason.Unknown -> null
    }

    // Hero (SUB-002…005)

    /** Hero line 1: yearly total and count (or the confirm prompt), plus the pending sentence. */
    fun heroSummary(totals: SubscriptionTotals, currency: String, masked: Boolean): List<SubscriptionTextRun> {
        val runs = mutableListOf<SubscriptionTextRun>()
        if (totals.count > 0) {
            val key = if (totals.count == 1) "{0} all'anno, in {1} abbonamento confermato." else "{0} all'anno, in {1} abbonamenti confermati."
            runs += runs(
                translate(key),
                mapOf(
                    "0" to SubscriptionTextRun(money(totals.yearly, currency, masked, 0), SubscriptionTextRun.Style.Amount),
                    "1" to SubscriptionTextRun(totals.count.toString()),
                ),
            )
        } else {
            runs += SubscriptionTextRun(tr("Conferma quelli che riconosci qui sotto e li sommiamo."))
        }
        if (totals.pendingCount > 0) {
            runs += SubscriptionTextRun(" ")
            runs += runs(
                translate("Altri {0} da confermare valgono circa {1} al mese."),
                mapOf(
                    "0" to SubscriptionTextRun(totals.pendingCount.toString()),
                    "1" to SubscriptionTextRun(money(totals.pendingMonthly, currency, masked, 0), SubscriptionTextRun.Style.Amount),
                ),
            )
        }
        return merged(runs)
    }

    /** Hero line 2 (bell), null when nothing confirmed is due within 30 days. */
    fun nextChargeLine(next: SubscriptionNextCharge?, today: String, currency: String, masked: Boolean): SubscriptionNextChargeLine? {
        next ?: return null
        val main = runs(
            translate("Prossimo addebito: {0} {1}"),
            mapOf(
                "0" to SubscriptionTextRun(next.item.name, SubscriptionTextRun.Style.Strong),
                "1" to SubscriptionTextRun(whenPhrase(today, next.date)),
            ),
        )
        val window = if (next.count > 1) {
            tr("· nei prossimi 30 giorni {0} addebiti, {1}", mapOf("0" to next.count.toString(), "1" to money(next.total, currency, masked, 0)))
        } else {
            null
        }
        return SubscriptionNextChargeLine(merged(main), window)
    }

    companion object {
        /** Italian catalog key of a cadence label (`CADENCE_LABELS`). */
        fun cadenceKey(cadence: SubscriptionCadence): String = when (cadence) {
            SubscriptionCadence.SETTIMANALE -> "ogni settimana"
            SubscriptionCadence.MENSILE -> "ogni mese"
            SubscriptionCadence.TRIMESTRALE -> "ogni 3 mesi"
            SubscriptionCadence.SEMESTRALE -> "ogni 6 mesi"
            SubscriptionCadence.ANNUALE -> "ogni anno"
        }

        private val PLACEHOLDER = Regex("""\{(\w+)\}""")

        /** Splits a template at `{name}` placeholders, substituting styled runs; unknown placeholders stay as text. */
        fun runs(template: String, values: Map<String, SubscriptionTextRun>): List<SubscriptionTextRun> {
            val out = mutableListOf<SubscriptionTextRun>()
            var plain = StringBuilder()
            var index = 0
            for (m in PLACEHOLDER.findAll(template)) {
                plain.append(template, index, m.range.first)
                val value = values[m.groupValues[1]]
                if (value == null) {
                    plain.append(m.value)
                } else {
                    if (plain.isNotEmpty()) out += SubscriptionTextRun(plain.toString())
                    plain = StringBuilder()
                    out += value
                }
                index = m.range.last + 1
            }
            plain.append(template, index, template.length)
            if (plain.isNotEmpty()) out += SubscriptionTextRun(plain.toString())
            return out
        }

        /** Joins adjacent runs with the same style. */
        fun merged(runs: List<SubscriptionTextRun>): List<SubscriptionTextRun> {
            val out = mutableListOf<SubscriptionTextRun>()
            for (run in runs) {
                if (run.text.isEmpty()) continue
                val last = out.lastOrNull()
                if (last != null && last.style == run.style) out[out.size - 1] = SubscriptionTextRun(last.text + run.text, run.style) else out += run
            }
            return out
        }
    }
}
