package io.buddybudget.core.domain.pension

import io.buddybudget.core.data.PensionSnapshot
import io.buddybudget.core.data.PensionView
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.investments.InvestmentsTextRun
import io.buddybudget.core.domain.periods.CalendarDate

// Pensione screens state and rules (spec: features/09-pension.md). The server computes performance, scenarios, TFR,
// yearly breakdown and the exit-tax timeline per whole year (`GET /api/pension/view`); the projection sliders run
// `PensionCalc.projectPension` on the device. Same names on iOS (`PensionUiState.swift`).

/** The five Pensione tabs. */
/** `iconKey`: Lucide icon in the views sheet (web `PENSION_TABS`). */
enum class PensionTab(val title: String, val description: String, val iconKey: String) {
    Overview("Panoramica", "Il fondo in sintesi", "layout-dashboard"),
    Trend("Andamento", "Contributi e valore nel tempo", "chart-column"),
    Scenarios("Scenari", "Cosa cambia con ipotesi diverse", "scale"),
    Projection("Proiezione", "Quanto potresti avere alla pensione", "hourglass"),
    Data("I tuoi dati", "Fondo, fotografie e importazioni", "database");

    companion object {
        /** Web sub-paths (`/pensione/scenari`…). */
        fun fromPath(path: String): PensionTab? = when (path.substringBefore('?')) {
            "/pensione" -> Overview
            "/pensione/andamento" -> Trend
            "/pensione/scenari" -> Scenarios
            "/pensione/proiezione" -> Projection
            "/pensione/dati" -> Data
            else -> null
        }
    }
}

/** What the Pensione frame shows. */
enum class PensionGate {
    Loading, Failed, Unavailable, Empty, Content;

    companion object {
        fun of(view: PensionView?, failed: Boolean, unavailable: Boolean): PensionGate = when {
            unavailable -> Unavailable
            view == null -> if (failed) Failed else Loading
            view.fund == null -> Empty
            else -> Content
        }
    }
}

/** One snapshot row with the contribution derived from the previous one (PEN-011). */
data class PensionSnapshotRow(val snapshot: PensionSnapshot, val delta: Double?) {
    val id: String get() = snapshot.id
}

object PensionRules {
    const val MAX_FUNDS = 10
    const val NAME_MAX_LENGTH = 80
    const val VISIBLE_SNAPSHOTS = 6
    const val MIN_CHART_POINTS = 2
    const val PREVIEW_YEARS = 25
    const val FLAT_YEARS = 15
    const val IMPORT_MAX_ROWS = 1000
    const val MAX_SNAPSHOTS = 5000
    const val MIN_YEAR = 1950

    fun snapshotRows(snapshots: List<PensionSnapshot>): List<PensionSnapshotRow> {
        val sorted = snapshots.sortedBy { it.date }
        return sorted.mapIndexed { index, s ->
            val delta = if (index > 0) s.netContributions - sorted[index - 1].netContributions else null
            PensionSnapshotRow(s, delta?.takeIf { it > 0 })
        }.reversed()
    }

    fun parseAmount(text: String): Double? = BBFormat.parseAmount(text)?.takeIf { it >= 0 }

    fun isPlausibleDate(value: String, today: String): Boolean {
        val day = CalendarDate.parse(value) ?: return false
        if (day.iso != value || day.year < MIN_YEAR) return false
        val limit = CalendarDate.parse(today)?.plusDays(1) ?: return false
        return day.epochDay <= limit.epochDay
    }

    fun canSaveProfile(name: String, date: String, originalName: String, originalDate: String): Boolean {
        val trimmed = JSNumber.trim(name)
        val changed = trimmed != originalName || date != originalDate
        return changed && trimmed.isNotEmpty() && date.isNotEmpty()
    }

    fun bestAndWorst(years: List<PensionView.Year>): Pair<PensionView.Year, PensionView.Year>? {
        if (years.size <= 1) return null
        var best = years.first()
        var worst = years.first()
        for (year in years.drop(1)) {
            if (year.gain > best.gain) best = year
            if (year.gain < worst.gain) worst = year
        }
        return best to worst
    }

    fun beatsTfr(view: PensionView): Boolean {
        val annual = view.performance?.annualReturn ?: return false
        val tfr = view.tfr ?: return false
        return annual >= tfr.annualRate
    }

    fun scenarios(view: PensionView, years: Int?): List<PensionView.Scenario> {
        if (years == null) return view.scenarios
        val clamped = years.coerceIn(0, view.exitTax.maxYears)
        return view.exitTax.timeline.firstOrNull { it.years == clamped }?.scenarios ?: view.scenarios
    }

    fun defaultQuarterly(view: PensionView): Double {
        val slider = view.projection.sliders.quarterlyContribution
        return if (slider.step > 0) JSNumber.round(slider.default / slider.step) * slider.step else slider.default
    }

    fun projection(startValue: Double, quarterly: Double, years: Int, rates: PensionView.Projection.Rates): List<PensionProjectionPoint> =
        PensionCalc.projectPension(startValue, quarterly, years.toDouble(), PensionProjectionRates(rates.prudent, rates.base, rates.optimistic))
}

/** Everything the Pensione frame renders. Same fields as `PensionUiState` on iOS. */
data class PensionUiState(
    val view: PensionView? = null,
    val failed: Boolean = false,
    val unavailable: Boolean = false,
    val tab: PensionTab = PensionTab.Overview,
    val fundId: String? = null,
    val simulatedYears: Int? = null,
    val projectionYears: Int? = null,
    val projectionQuarterly: Double? = null,
) {
    val gate: PensionGate get() = PensionGate.of(view, failed, unavailable)
    val fund: PensionView.Fund? get() = view?.fund
    val hasSnapshots: Boolean get() = view?.last != null && view.performance != null

    val shownYears: Int get() = view?.let { (simulatedYears ?: it.exitTax.realYears).coerceIn(0, it.exitTax.maxYears) } ?: 0
    val isSimulating: Boolean get() = view != null && simulatedYears != null && simulatedYears != view.exitTax.realYears
    val scenarios: List<PensionView.Scenario>
        get() = view?.let { if (isSimulating) PensionRules.scenarios(it, simulatedYears) else it.scenarios } ?: emptyList()

    val years: Int get() = projectionYears ?: (view?.projection?.sliders?.years?.default?.toInt() ?: 25)
    val quarterly: Double get() = projectionQuarterly ?: view?.let(PensionRules::defaultQuarterly) ?: 0.0

    /** Selecting another fund resets the per-fund simulations. */
    fun selectingFund(id: String?): PensionUiState = copy(fundId = id, simulatedYears = null, projectionQuarterly = null)
}

/** Pensione phrasing, bound to one language. Same API as `PensionText` on iOS. */
class PensionText(val locale: BBLocale, private val translate: (String) -> String) {
    fun tr(key: String, values: Map<String, String> = emptyMap()): String {
        val template = translate(key)
        return if (values.isEmpty()) template else BBFormat.interpolate(template, values)
    }

    fun money(value: Double, currency: String, masked: Boolean = false): String =
        BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits = 0, masked = masked)

    fun percent(ratio: Double, digits: Int = 1): String = BBFormat.formatPct(ratio, locale, digits)

    fun signedPercent(ratio: Double): String = (if (ratio >= 0) "+" else BBFormat.MINUS_SIGN) + percent(Math.abs(ratio))

    fun signedMoney(value: Double, currency: String, masked: Boolean = false): String =
        (if (value >= 0) "+" else BBFormat.MINUS_SIGN) + money(Math.abs(value), currency, masked)

    fun longDate(iso: String): String = CalendarDate.parse(iso)?.let { BBFormat.formatLongDate(it, locale) } ?: iso

    fun shortDate(iso: String): String = BBFormat.formatDateWithYear(iso, locale)

    fun chartDate(iso: String): String {
        val d = CalendarDate.parse(iso) ?: return iso
        return "${BBFormat.shortMonthLabel(d.month, locale)} ${(d.year % 100).toString().padStart(2, '0')}"
    }

    fun heroEyebrow(name: String, lastDate: String): String = "$name · ${tr("aggiornato al")} ${longDate(lastDate)}"

    fun gainCaption(gain: Double): String = "${if (gain >= 0) tr("di guadagno") else tr("di perdita")} ${tr("sui contributi versati")}"

    fun annualReturnLabel(approximate: Boolean): String = tr("Rendimento annuo") + if (approximate) tr(" (stima)") else ""

    fun reasonTitle(reason: String): String = when (reason) {
        "pensionamento" -> tr("Alla pensione")
        "sanitarie" -> tr("Spese sanitarie straordinarie")
        else -> tr("Altri motivi")
    }

    fun reasonDetail(reason: String): String = when (reason) {
        "pensionamento" -> tr("Fino al 50-60% in capitale, il resto in rendita")
        "sanitarie" -> tr("Anticipazione per terapie e interventi")
        else -> tr("Riscatto fuori dai casi previsti dalla legge")
    }

    fun scenarioDetail(scenario: PensionView.Scenario, delta: Double, currency: String, masked: Boolean = false): List<InvestmentsTextRun> {
        val runs = mutableListOf(InvestmentsTextRun("${reasonDetail(scenario.reason)} ${tr("· aliquota")} ${percent(scenario.rate)}", InvestmentsTextRun.Style.Muted))
        if (delta != 0.0) {
            runs.add(InvestmentsTextRun(" · ${signedMoney(delta, currency, masked)} ${tr("rispetto a oggi")}",
                if (delta > 0) InvestmentsTextRun.Style.Pos else InvestmentsTextRun.Style.Neg))
        }
        return runs
    }

    fun tfrConclusion(fundValue: Double, tfr: PensionView.Tfr, inflation: Double, currency: String, masked: Boolean = false): List<InvestmentsTextRun> {
        val diff = fundValue - tfr.net
        val better = diff >= 0
        val diffPct = if (tfr.net > 0) diff / tfr.net else null
        return listOf(
            InvestmentsTextRun("${if (better) tr("Finora il fondo ha reso") else tr("Finora il TFR in azienda avrebbe reso")} ", InvestmentsTextRun.Style.Muted),
            InvestmentsTextRun(money(Math.abs(diff), currency, masked), if (better) InvestmentsTextRun.Style.Pos else InvestmentsTextRun.Style.Neg),
            InvestmentsTextRun((diffPct?.let { " (${signedPercent(Math.abs(it))})" } ?: "") +
                " ${tr("in più. Rivalutazione in azienda stimata al")} ${percent(tfr.annualRate)} ${tr("l'anno con inflazione ipotizzata al")} ${percent(inflation)}" +
                tr(": il confronto ha senso solo su periodi lunghi, perché il fondo oscilla."), InvestmentsTextRun.Style.Muted),
        )
    }

    fun taxSimulation(state: PensionUiState, adhesionDate: String, currency: String, masked: Boolean = false): List<InvestmentsTextRun> {
        val view = state.view
        if (!state.isSimulating || view == null) {
            return listOf(InvestmentsTextRun(tr("Trascina l'aliquota lungo la linea (o usa le frecce) per vedere cosa cambierebbe nelle stime. Resta solo su questa pagina: non viene salvato nulla."),
                InvestmentsTextRun.Style.Muted))
        }
        val years = state.shownYears
        val year = (adhesionDate.take(4).toIntOrNull() ?: 0) + years
        val scenario = state.scenarios.firstOrNull()
        val baseline = view.scenarios.firstOrNull()
        val runs = mutableListOf(
            InvestmentsTextRun(tr("Simulazione"), InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun("${tr(": dopo")} $years ${tr("anni di adesione (nel")} $year${tr(") l'aliquota sarebbe")} ${percent(scenario?.rate ?: 0.0)}"),
        )
        if (scenario != null && baseline != null) {
            val delta = scenario.netLow - baseline.netLow
            runs.add(InvestmentsTextRun("${tr(", e alla pensione ti resterebbero almeno")} "))
            runs.add(InvestmentsTextRun(money(scenario.netLow, currency, masked), InvestmentsTextRun.Style.Strong))
            runs.add(InvestmentsTextRun(" (${signedMoney(delta, currency, masked)} ${tr("rispetto a oggi).")}"))
        } else {
            runs.add(InvestmentsTextRun("."))
        }
        return runs
    }

    fun projectionCaption(years: Int, gain: Double, currency: String, masked: Boolean = false): String =
        "${tr("tra")} $years ${tr("anni, di cui")} ${money(Math.max(0.0, gain), currency, masked)} ${tr("di rendimento")}"

    fun paidInSentence(paidIn: Double, currency: String, masked: Boolean = false): List<InvestmentsTextRun> = listOf(
        InvestmentsTextRun("${tr("Verserai ancora")} ", InvestmentsTextRun.Style.Muted),
        InvestmentsTextRun(money(paidIn, currency, masked), InvestmentsTextRun.Style.Strong),
        InvestmentsTextRun(tr(": il resto del valore finale è rendimento. Con meno anni o versamenti più bassi la cifra scende, muovi gli slider per vederlo."),
            InvestmentsTextRun.Style.Muted),
    )

    fun yearLine(year: PensionView.Year, currency: String, masked: Boolean = false): String =
        "${year.year} · ${signedMoney(year.gain, currency, masked)}" + (year.returnRate?.let { " (${signedPercent(it)})" } ?: "")
}
