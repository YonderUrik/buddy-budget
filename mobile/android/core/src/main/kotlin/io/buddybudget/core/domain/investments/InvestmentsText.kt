package io.buddybudget.core.domain.investments

import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InvestmentsPerformance
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.OperationResult
import io.buddybudget.core.data.OperationTotals
import io.buddybudget.core.data.PositionRow
import io.buddybudget.core.data.ReturnHeatmap
import io.buddybudget.core.data.ReturnValues
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import kotlin.math.abs

/** A piece of an Investimenti sentence with its emphasis. */
data class InvestmentsTextRun(val text: String, val style: Style = Style.Plain) {
    enum class Style { Plain, Strong, Pos, Neg, Muted }
}

/**
 * Investimenti phrasing, bound to one language. [translate] maps an Italian catalog key to its template in the app
 * language (identity in tests). Same API as `InvestmentsText` on iOS.
 */
class InvestmentsText(
    val locale: BBLocale,
    /** INV-112 (web #448): «Nascondi gli importi» also hides quantities, prices and fees. */
    val masked: Boolean = false,
    private val translate: (String) -> String,
) {
    fun tr(key: String, values: Map<String, String> = emptyMap()): String {
        val template = translate(key)
        return if (values.isEmpty()) template else BBFormat.interpolate(template, values)
    }

    fun money(value: Double, currency: String, digits: Int = 2, masked: Boolean = false): String =
        BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits = digits, masked = masked)

    fun pct(ratio: Double): String = BBFormat.formatSignedPct(ratio, locale)
    fun date(iso: String): String = BBFormat.formatDateWithYear(iso, locale)
    fun price(value: Double, currency: String): String =
        if (masked) BBFormat.AMOUNT_MASK else "${BBFormat.formatNumber(value, locale, maximumFractionDigits = 4)} $currency"
    fun quantity(value: Double): String = number(value, 6)

    /** A number of the user's money without a currency (`privateNumberFormat`): `••••` while amounts are hidden. */
    fun number(value: Double, maximumFractionDigits: Int = 3): String =
        if (masked) BBFormat.AMOUNT_MASK else BBFormat.formatNumber(value, locale, maximumFractionDigits = maximumFractionDigits)

    // Portafoglio hero (INV-011…014)

    fun dayChange(amount: Double, ratio: Double, currency: String, masked: Boolean): String {
        val sign = if (amount < 0) BBFormat.MINUS_SIGN else "+"
        return "$sign${money(abs(amount), currency, 0, masked)} (${pct(ratio)})"
    }

    fun cashLine(cash: Double, total: Double, currency: String, masked: Boolean): String =
        "${tr("Solo titoli. In più hai")} ${money(cash, currency, 0, masked)} ${tr("di liquidità sui broker (totale")} ${money(total, currency, 0, masked)})."

    fun simulationLine(extra: Double, currency: String, masked: Boolean): String =
        "${tr("Simulazione ·")} ${if (extra >= 0) "+" else ""}${money(extra, currency, masked = masked)} ${tr("rispetto al valore registrato.")}"

    fun gainSentence(b: InvestmentsView.Breakdown, unpriced: Int, currency: String, masked: Boolean): List<InvestmentsTextRun> {
        val gaining = b.market >= 0
        val marketPct = if (b.paid > 0) b.market / b.paid else null
        val runs = mutableListOf(
            InvestmentsTextRun("${tr("Per quello che possiedi hai pagato")} "),
            InvestmentsTextRun(money(b.paid, currency, 0, masked), InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun("${tr(": il mercato ha")} ${if (gaining) tr("aggiunto") else tr("tolto")} "),
            InvestmentsTextRun("${if (gaining) "+" else BBFormat.MINUS_SIGN}${money(abs(b.market), currency, 0, masked)}" +
                (marketPct?.let { " (${pct(it)})" } ?: ""), if (gaining) InvestmentsTextRun.Style.Pos else InvestmentsTextRun.Style.Neg),
            InvestmentsTextRun("."),
        )
        if (b.cashedIn != 0.0) {
            runs += InvestmentsTextRun(" ${tr("Hai già")} ${if (b.cashedIn > 0) tr("incassato") else tr("perso")} ${money(abs(b.cashedIn), currency, 0, masked)} ${tr("tra vendite, dividendi e cedole.")}",
                InvestmentsTextRun.Style.Muted)
        }
        if (unpriced > 0) {
            val head = if (unpriced == 1) tr("Uno strumento non ha") else tr("{0} strumenti non hanno", mapOf("0" to unpriced.toString()))
            runs += InvestmentsTextRun(" $head ${tr("ancora un prezzo e non è contato.")}", InvestmentsTextRun.Style.Muted)
        }
        return runs
    }

    fun periodGainSentence(g: InvestmentsView.PeriodGain, currency: String, masked: Boolean): List<InvestmentsTextRun> {
        val m = { v: Double -> money(v, currency, 0, masked) }
        val positive = g.gain >= 0
        val runs = mutableListOf(
            InvestmentsTextRun("${tr("Da")} ${date(g.fromKey)} ${tr("il valore è passato da")} "),
            InvestmentsTextRun(m(g.startValue), InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun(" ${tr("a")} "),
            InvestmentsTextRun(m(g.endValue), InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun("."),
        )
        if (abs(g.netContributions) >= 0.5) {
            runs += InvestmentsTextRun(" ${tr("Nel periodo hai")} ${if (g.netContributions > 0) tr("versato") else tr("ritirato")} ${m(abs(g.netContributions))}${tr(": quello non è guadagno.")}")
        }
        runs += InvestmentsTextRun(" ${tr("Il periodo ha")} ${if (positive) tr("reso") else tr("perso")} ")
        runs += InvestmentsTextRun("${if (positive) "+" else BBFormat.MINUS_SIGN}${m(abs(g.gain))}" + (g.twr?.let { " (${pct(it)})" } ?: ""),
            if (positive) InvestmentsTextRun.Style.Pos else InvestmentsTextRun.Style.Neg)
        if (g.income > 0.5) runs += InvestmentsTextRun("${tr(", compresi")} ${m(g.income)} ${tr("tra dividendi e cedole")}", InvestmentsTextRun.Style.Muted)
        runs += InvestmentsTextRun(".")
        return runs
    }

    // Positions (INV-021)

    fun quantityWithUnit(row: PositionRow): String = "${quantity(row.quantity)} ${if (row.instrument.isPercentOfNominal) "nominale" else tr("quote")}"

    fun positionGain(row: PositionRow, currency: String, masked: Boolean): String {
        val gain = row.unrealizedGain ?: return tr("senza prezzo")
        val amount = BBFormat.formatSignedCurrency(gain, currency, locale, masked)
        return row.unrealizedGainPct?.let { "$amount · ${pct(it)}" } ?: amount
    }

    // Performance (INV-031…044)

    fun rangeLabel(v: ReturnValues): String =
        if (v.days == 0) tr("Valore iniziale al {0}", mapOf("0" to date(v.baseKey ?: v.fromKey))) else "${date(v.fromKey)} – ${date(v.toKey)}"

    fun drawdownText(d: InvestmentsPerformance.Drawdown, recoveryDays: Int?): String {
        if (d.depth == 0.0) return tr("Nel periodo non è mai sceso sotto il massimo precedente.")
        val span = tr("Dal {0} al {1}", mapOf("0" to date(d.peakDate ?: ""), "1" to date(d.troughDate ?: "")))
        if (d.recoveryDate != null && recoveryDays != null) return tr("{0}; tornato al massimo in {1} giorni.", mapOf("0" to span, "1" to recoveryDays.toString()))
        return tr("{0}; non è ancora tornato al massimo (a fine periodo {1}).", mapOf("0" to span, "1" to pct(d.current ?: 0.0)))
    }

    fun heatmapSummary(h: ReturnHeatmap): String {
        val nouns = when (h.grouping) {
            "giorno" -> "giorno" to "giorni"
            "settimana" -> "settimana" to "settimane"
            "anno" -> "anno" to "anni"
            else -> "mese" to "mesi"
        }
        if (h.counted == 0) return tr("Ancora nessun {0} con un rendimento.", mapOf("0" to tr(nouns.first)))
        val flat = h.counted - h.positive - h.negative
        return tr("{0} {1} in guadagno e {2} in perdita{3}.", mapOf(
            "0" to h.positive.toString(), "1" to tr(if (h.positive == 1) nouns.first else nouns.second), "2" to h.negative.toString(),
            "3" to if (flat > 0) tr(", {0} praticamente fermi", mapOf("0" to flat.toString())) else "",
        ))
    }

    // Operazioni (INV-056…059)

    fun gainText(gain: Double, ratio: Double?, currency: String, masked: Boolean): String {
        val amount = BBFormat.formatSignedCurrency(gain, currency, locale, masked)
        return ratio?.let { "$amount · ${pct(it)}" } ?: amount
    }

    fun operationDetails(op: OperationResult, instrument: Instrument?): String {
        val t = op.transaction
        val currency = instrument?.currency ?: ""
        val cur = currency.ifEmpty { "EUR" }
        val parts = mutableListOf(date(t.date))
        when (t.type) {
            "rettifica" -> parts += tr("Nessun movimento di cassa · base trasferita {0}", mapOf("0" to money(t.grossValue ?: 0.0, cur)))
            "split" -> parts += tr("ogni quota diventa {0}", mapOf("0" to quantity(t.quantityValue)))
            "dividendo", "cedola" -> parts += tr("{0} lordi", mapOf("0" to money(t.grossValue ?: 0.0, cur)))
            else -> {
                val unit = if (instrument?.isPercentOfNominal == true) "% " else " "
                parts += tr("{0} × {1}{2}{3}", mapOf("0" to quantity(t.quantityValue), "1" to number(t.priceValue), "2" to unit, "3" to currency))
            }
        }
        if (t.feesValue > 0) parts += tr("commissioni {0}", mapOf("0" to number(t.feesValue)))
        val remaining = op.remainingQuantity
        if (t.type == "acquisto" && remaining != null && remaining > 1e-9 && t.quantityValue - remaining > 1e-9) {
            parts += tr("ne restano {0}", mapOf("0" to number(remaining, 4)))
        }
        return parts.joinToString(" · ")
    }

    fun monthParts(totals: OperationTotals, currency: String, masked: Boolean): String {
        val m = { v: Double -> money(v, currency, 0, masked) }
        return listOfNotNull(
            if (totals.bought > 0) tr("acquistato {0}", mapOf("0" to m(totals.bought))) else null,
            if (totals.sold > 0) tr("venduto {0}", mapOf("0" to m(totals.sold))) else null,
            if (totals.income > 0) tr("proventi {0}", mapOf("0" to m(totals.income))) else null,
        ).joinToString(" · ")
    }
}
