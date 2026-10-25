package io.buddybudget.core.domain.overview

import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.OverviewPeriod
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.data.StartStatus
import io.buddybudget.core.data.WhatsNew
import io.buddybudget.core.data.WhatsNewEntry
import io.buddybudget.core.designsystem.ChartCurve
import io.buddybudget.core.designsystem.ChartPathCommand
import io.buddybudget.core.designsystem.ChartPaths
import io.buddybudget.core.designsystem.ChartPoint
import io.buddybudget.core.designsystem.ChartScale
import io.buddybudget.core.domain.format.BBDateSkeleton
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Presentation rules of the Overview (spec: features/02-overview.md). Numbers come from `GET /api/overview`; these are
// the client-side choices the web makes while rendering (greeting, legend toggles, which blocks show, step copy…).
// Visible text is returned as Italian catalog sources (`CatalogText`) that the UI translates. Same names on iOS.

/** An Italian catalog source plus its `{n}` values, translated by the UI (`tr`). */
data class CatalogText(val source: String, val values: Map<String, String> = emptyMap())

// ---------------------------------------------------------------- Greeting (OV-001, OV-002)

object Greeting {
    /** OV-001: `Buongiorno` before 12, `Buon pomeriggio` 12–17, `Buonasera` from 18 (device hour). */
    fun source(hour: Int): String = when {
        hour < 12 -> "Buongiorno"
        hour < 18 -> "Buon pomeriggio"
        else -> "Buonasera"
    }

    /** First word of the user's name; null when the name is empty. */
    fun firstName(name: String?): String? = name?.split(" ")?.firstOrNull { it.isNotEmpty() }

    /** `Buongiorno, Giulia` from an already translated greeting. */
    fun title(greeting: String, name: String?): String = firstName(name)?.let { "$greeting, $it" } ?: greeting

    /** OV-002: «Martedì 6 ottobre 2026» (long date with weekday, first letter capitalized). */
    fun dateLabel(date: CalendarDate, locale: BBLocale): String =
        BBFormat.capitalize(BBFormat.formatDate(date, BBDateSkeleton.EEEE_D_MMMM_Y, locale))
}

// ---------------------------------------------------------------- Screen state (OV-005…007)

/** What the Overview body shows under the greeting. */
sealed class OverviewContent {
    /** OV-005: skeleton of three blocks. */
    data object Loading : OverviewContent()

    /** OV-006: `Impossibile caricare i dati della panoramica.` + retry. */
    data object Failed : OverviewContent()

    /** OV-007: no account, no investments, no pension → checklist (or empty state) + demo offer. */
    data class Empty(val view: OverviewView) : OverviewContent()
    data class Loaded(val view: OverviewView) : OverviewContent()

    val viewOrNull: OverviewView?
        get() = when (this) {
            is Empty -> view
            is Loaded -> view
            else -> null
        }

    companion object {
        fun resolve(view: OverviewView?, failed: Boolean): OverviewContent = when {
            view == null -> if (failed) Failed else Loading
            view.isEmpty -> Empty(view)
            else -> Loaded(view)
        }
    }
}

/** Voice sentences (server `voice`): `strong` segments are the figures, masked when amounts are hidden (OV-021). */
object OverviewVoice {
    const val MASK = "••••"

    fun segments(lines: List<OverviewView.VoiceLine>, hideAmounts: Boolean): List<OverviewView.VoiceSegment> {
        val out = mutableListOf<OverviewView.VoiceSegment>()
        lines.forEachIndexed { i, line ->
            line.segments.forEach { s -> out += if (s.strong && hideAmounts) OverviewView.VoiceSegment(MASK, true) else s }
            if (i < lines.size - 1) out += OverviewView.VoiceSegment(" ")
        }
        return out
    }
}

// ---------------------------------------------------------------- Asset classes

object AssetClass {
    const val LIQUIDITY = "liquidita"
    const val INVESTMENTS = "investimenti"
    const val PENSION = "previdenza"
    const val DEBTS = "debiti"

    /** Stacking order from the bottom (`ASSET_CLASS_ORDER`). */
    val order = listOf(LIQUIDITY, INVESTMENTS, PENSION, DEBTS)

    /** Italian label (catalog source). */
    fun label(key: String): String = when (key) {
        LIQUIDITY -> "Liquidità"
        INVESTMENTS -> "Investimenti"
        PENSION -> "Previdenza"
        DEBTS -> "Debiti"
        else -> key
    }

    /** Swatch token of each class (`ASSET_CLASS_COLORS`): `primary`, `neg` or a `--swatch-*` name. */
    fun colorToken(key: String): String = when (key) {
        LIQUIDITY -> "swatch-teal"
        INVESTMENTS -> "primary"
        DEBTS -> "neg"
        else -> "swatch-slate"
    }

    /** Classes with at least one non-zero value, in stacking order (`assetClassesInSeries`). */
    fun present(series: List<OverviewView.SeriesPoint>): List<String> {
        val present = mutableSetOf<String>()
        for (p in series) for ((k, v) in p.byClass) if (v != 0.0) present += k
        fun rank(k: String) = order.indexOf(k).let { if (it == -1) order.size else it }
        return present.sortedWith(compareBy<String> { rank(it) }.thenBy { it })
    }

    /** OV-022: area screen of a composition row. */
    fun path(key: String): String = when (key) {
        LIQUIDITY -> "/liquidita/conti"
        INVESTMENTS -> "/investimenti"
        PENSION -> "/pensione"
        else -> "/debiti"
    }
}

// ---------------------------------------------------------------- Net worth chart (OV-012…020)

enum class NetWorthChartView(val label: String) { Total("Totale"), ByClass("Per classe") }

/** `toggleHiddenClass` / `visibleClasses` / `countedClasses` (components/domain/net-worth/net-worth-chart.utils.ts). */
object NetWorthLegend {
    /** OV-016: showing removes from hidden; hiding adds, but never the last visible class (set unchanged). */
    fun toggle(hidden: Set<String>, key: String, allClasses: List<String>): Set<String> {
        if (key in hidden) return hidden - key
        val stillVisible = allClasses.filter { it != key && it !in hidden }
        if (stillVisible.isEmpty()) return hidden
        return hidden + key
    }

    fun visible(allClasses: List<String>, hidden: Set<String>): List<String> = allClasses.filter { it !in hidden }

    /** Classes that count in the shown total: the visible ones, minus pension when excluded. */
    fun counted(visible: List<String>, pensionIncluded: Boolean): List<String> =
        visible.filter { it != AssetClass.PENSION || pensionIncluded }
}

/** Everything the net-worth card renders, derived from the served series and the local toggles. */
class NetWorthChartState(
    val series: List<OverviewView.SeriesPoint>,
    change: OverviewView.Change,
    val view: NetWorthChartView,
    hidden: Set<String>,
    pensionIncluded: Boolean,
) {
    data class LegendItem(val key: String, val visible: Boolean, val latest: Double)

    /** [label] is an Italian source (`Debiti (già sottratti)` for debts). */
    data class Row(val key: String, val label: String, val value: Double)

    /** OV-020: one point's detail (date, rows top-down, total). */
    data class PointDetail(val date: String, val isEstimated: Boolean, val rows: List<Row>, val totalLabel: String, val total: Double)

    val allClasses: List<String>
    val visibleClasses: List<String>
    val isPartial: Boolean
    val hasPension: Boolean
    val pensionExcluded: Boolean
    /** Series behind the headline and the chart (restricted to the visible classes when some are hidden). */
    val shownSeries: List<OverviewView.SeriesPoint>
    val change: OverviewView.Change
    val hasHistory: Boolean = series.size >= 2
    val showsDebts: Boolean
    val showsNetLine: Boolean
    val tooltipClasses: List<String>
    val totalLabel: String

    init {
        val present = AssetClass.present(series)
        val hasDebts = AssetClass.DEBTS in present
        val assets = present.filter { it != AssetClass.DEBTS }
        val all = assets.ifEmpty { listOf(AssetClass.LIQUIDITY) }
        val effectiveHidden = if (view == NetWorthChartView.Total) emptySet() else hidden
        val visible = NetWorthLegend.visible(all, effectiveHidden)
        val partial = visible.size < all.size
        val pension = AssetClass.PENSION in all
        val excluded = pension && !pensionIncluded
        allClasses = all
        visibleClasses = visible
        isPartial = partial
        hasPension = pension
        pensionExcluded = excluded
        if (partial) {
            val counted = NetWorthLegend.counted(visible, pensionIncluded)
            shownSeries = series.map { p -> p.copy(value = counted.sumOf { p.byClass[it] ?: 0.0 }) }
            this.change = change(shownSeries)
        } else {
            shownSeries = series
            this.change = change
        }
        val debtsShown = hasDebts && !partial
        showsDebts = debtsShown
        showsNetLine = debtsShown || (excluded && AssetClass.PENSION in visible)
        if (view == NetWorthChartView.Total) {
            tooltipClasses = if (debtsShown) all + AssetClass.DEBTS else all
            totalLabel = if (excluded) "Totale senza previdenza" else "Totale"
        } else {
            tooltipClasses = if (debtsShown) visible + AssetClass.DEBTS else visible
            totalLabel = when {
                partial -> "Totale parziale"
                excluded -> "Totale senza previdenza"
                else -> "Totale"
            }
        }
    }

    /** OV-014: the `Totale` / `Per classe` toggle. */
    val showsViewToggle: Boolean get() = hasHistory && allClasses.size > 1

    /** OV-018: the pension switch. */
    val showsPensionSwitch: Boolean get() = hasPension

    /** OV-016: legend chips (Per classe, more than one class). */
    val showsLegend: Boolean get() = view == NetWorthChartView.ByClass && hasHistory && allClasses.size > 1

    val legend: List<LegendItem>
        get() {
            val last = shownSeries.lastOrNull()
            return allClasses.map { LegendItem(it, it in visibleClasses, last?.byClass?.get(it) ?: 0.0) }
        }

    /** OV-017: hidden class keys (the UI lower-cases the translated labels). */
    val hiddenClasses: List<String> get() = allClasses.filter { it !in visibleClasses }

    /** OV-015 / OV-019: notes under the legend (Per classe), Italian sources. */
    val notes: List<String>
        get() {
            if (view != NetWorthChartView.ByClass || !(allClasses.size > 1 || showsNetLine)) return emptyList()
            val out = mutableListOf<String>()
            if (showsNetLine) out += "Linea scura: patrimonio netto"
            if (showsDebts) out += "Il patrimonio netto è già al netto dei debiti"
            if (pensionExcluded && AssetClass.PENSION in visibleClasses) out += "Area grigia: previdenza, non inclusa nel totale"
            return out
        }

    /** Headline (OV-012), or the scrubbed point (mobile adaptation: the headline follows the finger). */
    fun headline(scrub: Int?): Pair<Double, OverviewView.Change> {
        if (scrub == null || scrub !in shownSeries.indices) return change.end to change
        return shownSeries[scrub].value to change(listOf(shownSeries[0], shownSeries[scrub]))
    }

    /** OV-020: detail of one point. */
    fun detail(index: Int): PointDetail? {
        val p = shownSeries.getOrNull(index) ?: return null
        val rows = if (tooltipClasses.size > 1) {
            tooltipClasses.reversed().map { k ->
                Row(k, if (k == AssetClass.DEBTS) "Debiti (già sottratti)" else AssetClass.label(k), p.byClass[k] ?: 0.0)
            }
        } else emptyList()
        return PointDetail(p.date, p.isEstimated, rows, totalLabel, p.value)
    }

    companion object {
        /** `computeNetWorthChange`: first vs last point; `deltaPct` on |start|, null when start is 0 or < 2 points. */
        fun change(series: List<OverviewView.SeriesPoint>): OverviewView.Change {
            val first = series.firstOrNull() ?: return OverviewView.Change(0.0, 0.0, 0.0, null)
            val last = series.last()
            val delta = last.value - first.value
            val pct = if (series.size >= 2 && first.value != 0.0) delta / abs(first.value) else null
            return OverviewView.Change(first.value, last.value, delta, pct)
        }

        /** X-axis label of a point: `d MMM` for daily periods, `MMM yy` for monthly ones. */
        fun axisLabel(date: String, period: OverviewPeriod, locale: BBLocale): String {
            val d = CalendarDate.parse(date) ?: return date
            val skeleton = if (period == OverviewPeriod.OneMonth || period == OverviewPeriod.ThreeMonths) BBDateSkeleton.D_MMM else BBDateSkeleton.MMM_YY
            return BBFormat.formatDate(d, skeleton, locale)
        }
    }
}

/** Stacked areas of `Per classe` (OV-015): cumulative bands from the bottom, plus the plot's Y domain. */
object NetWorthStack {
    data class Band(val key: String, val lower: List<Double>, val upper: List<Double>)

    fun bands(series: List<OverviewView.SeriesPoint>, classes: List<String>): List<Band> {
        var base = List(series.size) { 0.0 }
        return classes.map { key ->
            val lower = base
            val upper = series.mapIndexed { i, p -> base[i] + (p.byClass[key] ?: 0.0) }
            base = upper
            Band(key, lower, upper)
        }
    }

    /** Recharts `[0, auto]` with the hidden Y axis: from min(0, lowest value) to the nice maximum. */
    fun domain(bands: List<Band>, netLine: List<Double>?): ClosedFloatingPointRange<Double> {
        val values = bands.flatMap { it.upper + it.lower } + (netLine ?: emptyList())
        val lo = min(0.0, values.minOrNull() ?: 0.0)
        val hi = max(values.maxOrNull() ?: 1.0, lo + 1)
        val ticks = ChartScale.niceTicks(lo, hi)
        return (ticks.firstOrNull() ?: lo)..(ticks.lastOrNull() ?: hi)
    }

    /**
     * Closed band between two curves (monotone upper edge left→right, lower edge right→left), as Recharts draws a
     * stacked area whose base is the previous series.
     */
    fun bandPath(upper: List<ChartPoint>, lower: List<ChartPoint>, curve: ChartCurve = ChartCurve.Monotone): List<ChartPathCommand> {
        if (lower.isEmpty() || upper.isEmpty()) return emptyList()
        // Replay each lower segment p[i] → p[i+1] backwards, from p[i+1] to p[i].
        val segments = mutableListOf<Pair<ChartPoint, ChartPathCommand>>()
        var cursor = lower.first()
        for (command in ChartPaths.line(lower, curve).drop(1)) {
            segments += cursor to command
            when (command) {
                is ChartPathCommand.Line -> cursor = command.p
                is ChartPathCommand.Cubic -> cursor = command.to
                else -> {}
            }
        }
        val back = mutableListOf<ChartPathCommand>(ChartPathCommand.Line(lower.last()))
        for ((from, command) in segments.reversed()) {
            when (command) {
                is ChartPathCommand.Line -> back += ChartPathCommand.Line(from)
                is ChartPathCommand.Cubic -> back += ChartPathCommand.Cubic(command.c2, command.c1, from)
                else -> {}
            }
        }
        return ChartPaths.line(upper, curve) + back + ChartPathCommand.Close
    }

    /**
     * X labels kept by Recharts' default `preserveEnd` thinning with `minTickGap`: walk from the end, keep a label
     * when it does not overlap the previously kept one. [centers]/[widths] in dp.
     */
    fun thinLabels(centers: List<Double>, widths: List<Double>, minGap: Double = 32.0, plotWidth: Double): List<Int> {
        if (centers.isEmpty()) return emptyList()
        val kept = mutableListOf<Int>()
        var lastStart = Double.POSITIVE_INFINITY
        for (i in centers.indices.reversed()) {
            val half = widths[i] / 2
            var start = centers[i] - half
            var end = centers[i] + half
            if (i == centers.size - 1) {
                end = min(end, plotWidth)
                start = end - widths[i]
            }
            if (start < 0) continue
            if (end + minGap <= lastStart) {
                kept += i
                lastStart = start
            }
        }
        return kept.reversed()
    }
}

// ---------------------------------------------------------------- Composition (OV-022…025)

object CompositionDisplay {
    fun assetCount(items: List<OverviewView.CompositionItem>): Int = items.count { !it.isLiability }

    /** Slices: assets with a positive share. */
    fun donutItems(items: List<OverviewView.CompositionItem>): List<OverviewView.CompositionItem> =
        items.filter { !it.isLiability && it.share > 0 }

    /** OV-024: donut with 2 or more asset classes. */
    fun showsDonut(items: List<OverviewView.CompositionItem>): Boolean = assetCount(items) > 1 && donutItems(items).isNotEmpty()

    /** `computeInvestedShare`: the investments share when there are 2+ asset classes. */
    fun investedShare(items: List<OverviewView.CompositionItem>): Double? {
        if (assetCount(items) < 2) return null
        return items.firstOrNull { it.key == AssetClass.INVESTMENTS }?.share
    }

    /** OV-023: ` · {pct}%` on asset rows when there are 2+ asset classes. */
    fun showsShare(item: OverviewView.CompositionItem, items: List<OverviewView.CompositionItem>): Boolean =
        assetCount(items) > 1 && !item.isLiability

    /** `Math.round(ratio × 100)%`. */
    fun percent(ratio: Double): String = "${jsRound(ratio * 100)}%"

    /** Sentence under the title when there is no donut (`investedSentence`). */
    fun sentence(items: List<OverviewView.CompositionItem>): CatalogText? {
        val share = investedShare(items) ?: return null
        if (showsDonut(items)) return null
        if (share == 0.0) return CatalogText("Per ora è tutto liquidità.")
        return CatalogText("Il {0} è investito, il resto è liquidità.", mapOf("0" to percent(share)))
    }
}

/** `Math.round` (half up), same as Swift `.rounded()` for the non-negative values used here. */
internal fun jsRound(x: Double): Int = kotlin.math.floor(x + 0.5).toInt()

// ---------------------------------------------------------------- Month pace (OV-026)

object MonthPaceDisplay {
    /** Budget used (capped at 1), null without budgets. */
    fun budgetUsed(pace: OverviewView.MonthPace): Double? {
        val total = pace.budgetTotal ?: return null
        if (total <= 0) return null
        return min(1.0, pace.budgetSpent / total)
    }

    fun isOverBudget(pace: OverviewView.MonthPace): Boolean = pace.budgetTotal?.let { pace.budgetSpent > it } ?: false

    /** `restano {0}` / `sforato di {0}` with the amount to format. */
    fun budgetText(pace: OverviewView.MonthPace): Pair<String, Double>? {
        if (budgetUsed(pace) == null) return null
        val total = pace.budgetTotal ?: return null
        return if (isOverBudget(pace)) "sforato di {0}" to (pace.budgetSpent - total) else "restano {0}" to (total - pace.budgetSpent)
    }
}

/** Geometry of the hand-drawn `MonthPaceChart` (charts.md §3): height 200, pad {22, 64, 28, 8}, max × 1.12. */
class MonthPaceGeometry(pace: OverviewView.MonthPace, width: Double) {
    val width: Double = max(240.0, width)
    val daysInMonth: Int = pace.daysInMonth
    val max: Double = maxOf(1.0, pace.current.maxOrNull() ?: 0.0, pace.typical?.maxOrNull() ?: 0.0) * 1.12

    fun x(day: Int): Double = PAD_LEFT + (day - 1).toDouble() / max(1, daysInMonth - 1) * (width - PAD_LEFT - PAD_RIGHT)

    fun y(value: Double): Double = PAD_TOP + (1 - value / max) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

    fun points(values: List<Double>): List<ChartPoint> = values.mapIndexed { i, v -> ChartPoint(x(i + 1), y(v)) }

    /** X ticks: 1, mid-month, last day. */
    val ticks: List<Int> get() = listOf(1, ceil(daysInMonth / 2.0).toInt(), daysInMonth)
    val baselineY: Double get() = HEIGHT - PAD_BOTTOM

    companion object {
        const val HEIGHT = 200.0
        const val PAD_TOP = 22.0
        const val PAD_RIGHT = 64.0
        const val PAD_BOTTOM = 28.0
        const val PAD_LEFT = 8.0
    }
}

// ---------------------------------------------------------------- Investments pulse (OV-028)

class InvestmentsPulse(inv: OverviewView.Investments) {
    val value = inv.value
    val paid = inv.paid
    val marketGain = inv.marketGain
    val positions = inv.positions

    val isLoss: Boolean get() = marketGain < 0
    val sign: String get() = if (isLoss) "−" else "+"

    /** Gain on paid, null when nothing was paid. */
    val ratio: Double? get() = if (paid > 0) marketGain / paid else null

    /** Share of the bar for the paid part (never above 100%). */
    val paidShare: Double get() = if (value > 0) min(1.0, max(0.0, min(paid, value) / value)) else 0.0

    /** `{±x,x}% sul versato`, or `dal mercato` when nothing was paid. */
    fun ratioText(locale: BBLocale): CatalogText {
        val r = ratio ?: return CatalogText("dal mercato")
        val pct = BBFormat.formatNumber(abs(r * 100), locale, minimumFractionDigits = 1, maximumFractionDigits = 1)
        return CatalogText("{0}{1}% sul versato", mapOf("0" to sign, "1" to pct))
    }

    /** `1 posizione` / `{0} posizioni`. */
    val positionsText: CatalogText
        get() = if (positions == 1) CatalogText("1 posizione") else CatalogText("{0} posizioni", mapOf("0" to positions.toString()))
}

// ---------------------------------------------------------------- Upcoming dues (OV-027)

object UpcomingDues {
    const val LIMIT = 3

    fun shown(debts: OverviewView.Debts?): List<OverviewView.NextDue> = (debts?.nextDue ?: emptyList()).take(LIMIT)
}

// ---------------------------------------------------------------- «Primi passi» (OV-033…037)

/** «Primi passi» steps (OV-033, web #444: debts and pension added). */
enum class StartStepId(val raw: String) {
    Conto("conto"), Import("import"), Investimento("investimento"), Debito("debito"), Pensione("pensione"), Obiettivo("obiettivo");

    companion object {
        fun of(raw: String): StartStepId? = entries.firstOrNull { it.raw == raw }

        /** Steps asked when the user picked no focus (the original four). */
        val defaults: List<StartStepId> = listOf(Conto, Import, Investimento, Obiettivo)

        /** OV-046: the account can be postponed but never skipped. */
        val unskippable: Set<StartStepId> = setOf(Conto)
    }
}

/** One step: title, description, CTA, in-app path and the «done» text (toast and acknowledgement, OV-048 / SHELL-060). */
data class StartStepDefinition(val id: StartStepId, val title: String, val description: String, val cta: String, val path: String, val done: String)

/** «Cosa vuoi tenere sotto controllo?» (AUTH-058, OV-047): the answers and the step each one adds. */
enum class StartFocus(val raw: String, val title: String, val description: String, val iconKey: String, val step: StartStepId) {
    Spese("spese", "Spese e conti", "Dove vanno i soldi ogni mese, per categoria.", "wallet", StartStepId.Import),
    Investimenti("investimenti", "Investimenti", "ETF, azioni, BTP e crypto, con rendimento e tasse.", "trending-up", StartStepId.Investimento),
    Debiti("debiti", "Mutuo e prestiti", "Rate, interessi e quando finisci di pagare.", "credit-card", StartStepId.Debito),
    Pensione("pensione", "Fondo pensione", "Quanto hai da parte e quanto rende.", "umbrella", StartStepId.Pensione);

    companion object {
        fun of(raw: String): StartFocus? = entries.firstOrNull { it.raw == raw }

        /** The answers available in a product country: the pension one only where the pension section exists. */
        fun options(pensionAvailable: Boolean): List<StartFocus> = if (pensionAvailable) entries else entries.filter { it != Pensione }
    }
}

object StartChecklist {
    /** OV-033 / OV-037 (`START_STEPS`, `obiettivo` replaced by the budget step where `retirement` is off). */
    fun steps(retirement: Boolean): List<StartStepDefinition> = listOf(
        StartStepDefinition(
            StartStepId.Conto, "Aggiungi il tuo conto", "Crealo a mano: bastano il nome e il saldo di oggi.",
            "Aggiungi un conto", "/liquidita/conti?nuovo=1", "Conto aggiunto",
        ),
        StartStepDefinition(
            StartStepId.Import, "Importa i movimenti", "Carica il CSV o l'estratto conto della tua banca.",
            "Importa un file", "/importazioni", "Movimenti aggiunti",
        ),
        StartStepDefinition(
            StartStepId.Investimento, "Aggiungi un investimento", "Registra un acquisto o importa il rendiconto del tuo broker.",
            "Vai agli investimenti", "/investimenti", "Primo investimento registrato",
        ),
        StartStepDefinition(
            StartStepId.Debito, "Aggiungi il mutuo o un prestito",
            "Importo, tasso e durata: calcoliamo il piano rate, quanto paghi di interessi e quando finisci.",
            "Aggiungi un finanziamento", "/debiti", "Finanziamento aggiunto",
        ),
        StartStepDefinition(
            StartStepId.Pensione, "Aggiungi il fondo pensione", "Bastano i contributi versati e il valore di oggi, dall'area clienti del fondo.",
            "Aggiungi il fondo", "/pensione", "Fondo pensione aggiunto",
        ),
        if (retirement) {
            StartStepDefinition(
                StartStepId.Obiettivo, "Fissa il tuo traguardo",
                "Dicci quanto ti serve in un anno: calcoliamo il patrimonio che ti basta per vivere di rendita e quando ci arrivi.",
                "Fissa il traguardo", "/analitiche?traguardo=1", "Traguardo fissato",
            )
        } else {
            StartStepDefinition(StartStepId.Obiettivo, "Imposta un budget", "Imposta un budget per categoria.", "Vai alle categorie", "/liquidita/categorie", "Budget impostato")
        },
    )

    fun definition(id: StartStepId, retirement: Boolean): StartStepDefinition = steps(retirement).first { it.id == id }

    /** Steps asked for a focus (`startStepsFor`): account first, target last, the others by focus; never pension where hidden. */
    fun stepsFor(focus: List<StartFocus>?, pensionAvailable: Boolean): List<StartStepId> {
        val wanted = if (focus.isNullOrEmpty()) StartStepId.defaults.toSet()
        else (listOf(StartStepId.Conto) + focus.map { it.step } + StartStepId.Obiettivo).toSet()
        return StartStepId.entries.filter { it in wanted && (pensionAvailable || it != StartStepId.Pensione) }
    }

    fun doneCount(status: StartStatus): Int = status.askedSteps.count { status.steps.isDone(it) }

    /** OV-034: «{n} su {m} fatti» — m = steps asked minus those skipped and not done. */
    fun statusLine(status: StartStatus): CatalogText {
        val asked = status.askedSteps.count { !status.skippedSteps.contains(it) || status.steps.isDone(it) }
        return CatalogText("{0} su {1} fatti", mapOf("0" to doneCount(status).toString(), "1" to asked.toString()))
    }

    /** OV-045: the first step neither done nor skipped; null when all are settled. */
    fun nextStep(status: StartStatus): StartStepId? = status.askedSteps.firstOrNull { !status.steps.isDone(it) && it !in status.skippedSteps }

    /** OV-046: «Non mi serve» is offered for every step but the account. */
    fun canSkip(step: StartStepId): Boolean = step !in StartStepId.unskippable

    /** The state of a step in the list under the next step. */
    enum class RowState { Done, Skipped, Todo }

    fun rowState(status: StartStatus, step: StartStepId): RowState = when {
        status.steps.isDone(step) -> RowState.Done
        step in status.skippedSteps -> RowState.Skipped
        else -> RowState.Todo
    }

    /** SHELL-060 / OV-048: steps asked that are done now and were not in [before]. */
    fun newlyDone(before: Set<StartStepId>, status: StartStatus): List<StartStepId> =
        status.askedSteps.filter { status.steps.isDone(it) && it !in before }

    /** OV-035: normal layout → not dismissed, not completed, no demo; empty layout (forced) → not completed, no demo. */
    fun isVisible(status: StartStatus, forced: Boolean): Boolean =
        if (forced) !status.completed && !status.demoActive else !status.dismissed && !status.completed && !status.demoActive

    /** OV-038: re-read every 15 s while a step is missing and the checklist is not dismissed. */
    const val POLL_MS = 15_000L

    fun shouldPoll(status: StartStatus?): Boolean = status != null && !status.completed && !status.dismissed
}

// ---------------------------------------------------------------- Goals tile (OV-030…032)

object GoalsTile {
    const val LIMIT = 3

    sealed class Mode {
        data object Hidden : Mode()

        /** OV-031: «Novità: obiettivi di risparmio». */
        data object Invite : Mode()

        /** OV-032: up to 3 open goals. */
        data class List(val goals: kotlin.collections.List<GoalView>) : Mode()
    }

    /** OV-030: requested only where `/analitiche/obiettivi` exists (`capabilities.sections.goals`, false for DE). */
    fun isAvailable(sections: MeBootstrap.Sections): Boolean = sections.goals

    /** OV-032: open goals by months-to-go ascending (no ETA last), then progress descending. */
    fun closest(goals: List<GoalView>, limit: Int = LIMIT): List<GoalView> =
        goals.filter { it.status != "raggiunto" }
            .sortedWith(compareBy<GoalView> { it.monthsToGo?.toDouble() ?: Double.POSITIVE_INFINITY }.thenByDescending { it.progress })
            .take(limit)

    /** OV-031: [checklistShown] hides the invite while «Primi passi» is on screen (web #444). */
    fun mode(view: GoalsView?, inviteDismissed: Boolean, checklistShown: Boolean = false): Mode {
        if (view == null) return Mode.Hidden
        if (view.goals.isEmpty()) return if (inviteDismissed || checklistShown) Mode.Hidden else Mode.Invite
        val shown = closest(view.goals)
        return if (shown.isEmpty()) Mode.Hidden else Mode.List(shown)
    }

    /** Status in a word (`statusLabel`), Italian source. */
    fun statusLabel(status: String): String? = when (status) {
        "raggiunto" -> "Raggiunto"
        "in_linea" -> "In linea"
        "in_ritardo" -> "In ritardo"
        else -> null
    }

    /**
     * `statusSentence`: parts translated and joined by the UI; the first part is capitalized after translation when
     * the second value is true. [money] / [month] are the formatters.
     */
    fun statusSentence(goal: GoalView, money: (Double) -> String, month: (String) -> String): Pair<List<CatalogText>, Boolean> =
        when (goal.status) {
            "raggiunto" -> listOf(
                if (goal.achievedAt != null) CatalogText("Segnato come raggiunto: non prende più niente dal risparmio del mese.")
                else CatalogText("I soldi ci sono tutti: puoi segnarlo come raggiunto."),
            ) to false
            "fermo" -> listOf(
                if (goal.monthly <= 0) CatalogText("Nessuna quota al mese: scegline una per sapere quando ci arrivi.")
                else CatalogText("Questo mese il risparmio non arriva fin qui: gli obiettivi più in alto prendono tutto."),
            ) to false
            else -> {
                val parts = mutableListOf(
                    CatalogText("al ritmo di {0} al mese ci arrivi a {1}", mapOf("0" to money(goal.funded), "1" to month(goal.etaMonth ?: ""))),
                )
                if (goal.funded + 0.5 < goal.monthly) {
                    parts += CatalogText(" (ricevi {0} dei {1} che hai scelto)", mapOf("0" to money(goal.funded), "1" to money(goal.monthly)))
                }
                val target = goal.targetDate
                parts += if (goal.status == "in_ritardo" && target != null) {
                    CatalogText(", dopo {0}: servirebbero {1} al mese.", mapOf("0" to month(target), "1" to money(goal.required ?: 0.0)))
                } else CatalogText(".")
                parts to true
            }
        }

    /** Icon key and swatch token of a goal kind (`GOAL_KIND_INFO`). */
    fun iconKey(kind: String): String = when (kind) {
        "emergenza" -> "shield-check"
        "viaggio" -> "plane"
        "casa" -> "house"
        "acquisto" -> "shopping-bag"
        else -> "sparkles"
    }

    fun colorToken(kind: String): String = when (kind) {
        "emergenza" -> "swatch-teal"
        "viaggio" -> "swatch-amber"
        "casa" -> "swatch-violet"
        "acquisto" -> "swatch-blue"
        else -> "swatch-pink"
    }

    /** Progress bar color: amber when late, `--pos` when reached, `--primary` otherwise. */
    fun progressToken(status: String): String = when (status) {
        "in_ritardo" -> "swatch-amber"
        "raggiunto" -> "pos"
        else -> "primary"
    }
}

// ---------------------------------------------------------------- «Novità» (SHELL-049, SHELL-050)

object WhatsNewDismissals {
    /** Device key (`bb:whats-new-dismissed`), ids joined by commas as on the web. */
    const val KEY = "bb:whats-new-dismissed"

    fun parse(raw: String?): List<String> = (raw ?: "").split(",").filter { it.isNotEmpty() }

    fun adding(id: String, raw: String?): String {
        val ids = parse(raw).toMutableList()
        if (id !in ids) ids += id
        return ids.joinToString(",")
    }

    /** SHELL-049: at most one entry — the server's `current`, or the newest fresh entry not dismissed here. */
    fun pick(whatsNew: WhatsNew?, dismissed: List<String>): WhatsNewEntry? {
        if (whatsNew == null) return null
        whatsNew.current?.let { if (it.id !in dismissed) return it }
        return whatsNew.entries.firstOrNull { it.id !in dismissed }
    }
}

/** Per-device keys of the Overview (decision 0003: same keys and defaults as the web's localStorage). */
object OverviewPreferenceKeys {
    /** OV-018: default on, shared with «Il tuo quadro» › Oggi. */
    const val INCLUDE_PENSION = "bb:net-worth-include-pension"

    /** OV-031: default off. */
    const val GOALS_INVITE_DISMISSED = "bb-goals-invite-dismissed"
}
