package io.buddybudget.core.domain.investments

import io.buddybudget.core.data.BackfillState
import io.buddybudget.core.data.InspectPoint
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentCreateInput
import io.buddybudget.core.data.InstrumentSearchResult
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.data.InvestmentTransaction
import io.buddybudget.core.data.InvestmentsTaxes
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.OperationInput
import io.buddybudget.core.data.OperationMonth
import io.buddybudget.core.data.OperationTotals
import io.buddybudget.core.data.PriceOnDate
import io.buddybudget.core.data.TitleAnalysis
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import java.text.Normalizer
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

// Investimenti on the device (spec: features/07-investments.md, api/endpoints/investments-views.md «What stays on the
// device»). Same names on iOS (`BuddyBudgetKit/Domain/Investments/InvestmentsRules.swift`).

// ---------------------------------------------------------------- Period

/** Chart period of Portafoglio and Performance (INV-016). [raw] = the API's `period`. */
enum class InvestmentsPeriod(val raw: String, val label: String) {
    OneMonth("1mese", "1M"), ThreeMonths("3mesi", "3M"), Ytd("ytd", "YTD"), OneYear("1anno", "1A"), Max("max", "Max"),
    Custom("custom", "Personalizzato");

    companion object {
        /** INV-016: 3M on every visit. */
        val Default = ThreeMonths
    }
}

/** Inclusive `YYYY-MM-DD` bounds. */
data class ChartRange(val from: String, val to: String)

/** Security page chart period (SEC-020); labels are not translated. */
enum class TitlePeriod(val raw: String) {
    OneMonth("1M"), ThreeMonths("3M"), SixMonths("6M"), OneYear("1A"), FiveYears("5A"), Max("Max");

    companion object {
        val Default = OneYear
    }
}

// ---------------------------------------------------------------- Query

/** Shared query of the view endpoints. */
data class InvestmentsQuery(
    val period: InvestmentsPeriod,
    val range: ChartRange? = null,
    val selection: ChartRange? = null,
    val excludedBrokers: List<String> = emptyList(),
    val today: String,
) {
    val parameters: Map<String, String>
        get() {
            val out = linkedMapOf("period" to period.raw, "today" to today)
            if (period == InvestmentsPeriod.Custom && range != null) {
                out["from"] = range.from
                out["to"] = range.to
            }
            if (selection != null) {
                out["selFrom"] = selection.from
                out["selTo"] = selection.to
            }
            if (excludedBrokers.isNotEmpty()) out["excludeBrokers"] = excludedBrokers.joinToString(",")
            return out
        }

    companion object {
        /** YTD resolves to 1 Jan → today; custom carries its (validated) range. */
        fun make(period: InvestmentsPeriod, custom: ChartRange, today: String, excludedBrokers: Set<String>, selection: ChartRange? = null): InvestmentsQuery {
            val range = when (period) {
                InvestmentsPeriod.Ytd -> ChartRange("${today.take(4)}-01-01", today)
                InvestmentsPeriod.Custom -> if (InvestmentsRules.isValidRange(custom, today)) custom else null
                else -> null
            }
            val effective = if (period == InvestmentsPeriod.Custom && range == null) InvestmentsPeriod.Default else period
            return InvestmentsQuery(effective, range, selection, excludedBrokers.sorted(), today)
        }
    }
}

// ---------------------------------------------------------------- Tabs

/** The six Investimenti tabs (INV-002), each addressable by its web path. */
/** `iconKey`: Lucide icon in the views sheet (web `INVESTMENTS_TABS`). */
enum class InvestmentsTab(val path: String, val title: String, val subtitle: String, val iconKey: String) {
    Portfolio("/investimenti", "Portafoglio", "Valore, andamento e posizioni", "wallet"),
    Performance("/investimenti/performance", "Performance", "Rendimento, rischio e confronto", "trending-up"),
    Diversification("/investimenti/diversificazione", "Diversificazione", "Come è distribuito il portafoglio", "chart-pie"),
    Income("/investimenti/proventi", "Dividendi", "Cedole e proventi incassati", "hand-coins"),
    Taxes("/investimenti/tasse", "Tasse", "Stime fiscali e minusvalenze", "landmark"),
    Operations("/investimenti/operazioni", "Operazioni", "Acquisti e vendite registrati", "arrow-left-right");

    companion object {
        /** INV-003: Dividendi / Tasse only when the server says the path exists for the product country. */
        fun visible(sections: MeBootstrap.Sections): List<InvestmentsTab> = entries.filter {
            when (it) {
                Income -> sections.investmentIncome
                Taxes -> sections.investmentTaxes
                else -> true
            }
        }

        /** Deep link / legacy path → tab (INV-004); null = not a tab path. */
        fun fromPath(path: String): InvestmentsTab? {
            val clean = path.substringBefore("?").trim('/')
            return when (clean) {
                "investimenti", "investimenti/titoli" -> Portfolio
                "investimenti/rendiconti", "investimenti/rendiconti/importazioni" -> Operations
                else -> entries.firstOrNull { it.path == "/$clean" }
            }
        }

        /** Security page id from `/investimenti/titoli/{id}` (SEC-001). */
        fun instrumentId(path: String): String? {
            val clean = path.substringBefore("?")
            val prefix = "/investimenti/titoli/"
            if (!clean.startsWith(prefix)) return null
            return clean.removePrefix(prefix).trim('/').ifEmpty { null }
        }
    }
}

/**
 * What a Dividendi/Tasse tab renders (INV-091: the Italian endpoints are never called for DE). Web `productCountry ===
 * "DE" ? <PlanningScreen/> : <ItalianPage/>`: «Altro paese» gets the Italian screens before tax (INV-113, #465).
 */
enum class InvestmentsCountryContent {
    Italian, GermanPlan;

    companion object {
        fun of(country: String): InvestmentsCountryContent = if (country == "DE") GermanPlan else Italian
    }

    /**
     * PLAN-003: for DE only the exact `/investimenti/tasse` and `/investimenti/proventi` paths open; their subpaths go to
     * the country-unavailable screen (web `isCountryPathAvailable`).
     */
    fun blocksPath(path: String): Boolean {
        if (this != GermanPlan) return false
        val bare = path.substringBefore('?')
        return bare.startsWith("/investimenti/tasse/") || bare.startsWith("/investimenti/proventi/")
    }
}

// ---------------------------------------------------------------- Rules

object InvestmentsRules {
    const val STALE_PRICE_DAYS = 4
    const val RECENT_MONTHS = 3
    const val DEFAULT_CONTRIBUTION = 100.0
    const val MAX_TARGETS = 30

    /** INV-017: real calendar dates, from ≤ to, to ≤ today. */
    fun isValidRange(range: ChartRange, today: String): Boolean {
        val from = CalendarDate.parse(range.from) ?: return false
        val to = CalendarDate.parse(range.to) ?: return false
        if (from.iso != range.from || to.iso != range.to) return false
        return range.from <= range.to && range.to <= today
    }

    fun defaultCustomRange(today: String) = ChartRange("${today.take(4)}-01-01", today)

    /** INV-008. */
    fun showsBrokerSelector(brokers: List<InvestmentsView.Broker>): Boolean = brokers.any { it.id != "manual" }

    /** INV-018: switch on = reinvested = `include… = false`. */
    fun costScenario(scenarios: List<InvestmentsView.CostScenario>, reinvestFees: Boolean, reinvestTaxes: Boolean): InvestmentsView.CostScenario? =
        scenarios.firstOrNull { it.includeFees == !reinvestFees && it.includeTaxes == !reinvestTaxes }

    /** INV-034: nearest inspect entry (ties → the earlier one). */
    fun nearestInspect(index: Int, points: List<InspectPoint>): InspectPoint? {
        var best: InspectPoint? = null
        for (p in points) if (best == null || abs(p.index - index) < abs(best.index - index)) best = p
        return best
    }

    /** INV-057: «Tutti» (null) + years desc, only with more than one year. */
    fun yearOptions(years: List<Int>): List<Int?> {
        val sorted = years.toSet().sortedDescending()
        return if (sorted.size > 1) listOf<Int?>(null) + sorted else emptyList()
    }

    /** INV-056. */
    fun visibleMonths(months: List<OperationMonth>, year: Int?, showAll: Boolean): List<OperationMonth> {
        val filtered = if (year == null) months else months.filter { it.year == year }
        return if (showAll) filtered else filtered.take(RECENT_MONTHS)
    }

    /** INV-058: web `sumOperationTotals` over a year's operations (all years → the served totals). */
    fun totals(months: List<OperationMonth>, year: Int?, all: OperationTotals): OperationTotals {
        if (year == null) return all
        var bought = 0.0; var sold = 0.0; var income = 0.0; var gain = 0.0; var base = 0.0
        var count = 0; var unpriced = 0
        for (op in months.filter { it.year == year }.flatMap { it.operations }) {
            count += 1
            val type = op.transaction.type
            if (type == "split" || type == "rettifica") continue
            when (type) {
                "acquisto" -> bought += op.paid
                "vendita", "rimborso" -> sold += op.received
                else -> income += op.received
            }
            if (op.gain != null) {
                gain += op.gain
                base += op.gainBase ?: 0.0
            } else if (type == "acquisto" && (op.remainingQuantity ?: 0.0) > 1e-9) {
                unpriced += 1
            }
        }
        return OperationTotals(count, bought, sold, income, gain, if (base > 0) gain / base else null, unpriced)
    }

    /** INV-060/061. */
    fun canEdit(t: InvestmentTransaction): Boolean = t.type != "rettifica" && !t.isReconciled

    /** JS `String(number)` for form values. */
    fun jsString(value: Double): String =
        if (value == Math.rint(value) && abs(value) < 1e15) value.toLong().toString() else value.toString()

    /** `Math.round(share × 100)%`. */
    fun percent(share: Double): String = "${JSNumber.round(share * 100).toLong()}%"

    /** INV-055: floored to 4 decimals. */
    fun suggestedQuantity(amount: Double, lastPrice: Double?): Double? {
        if (lastPrice == null || lastPrice <= 0) return null
        return floor(amount / lastPrice * 10_000) / 10_000
    }
}

// ---------------------------------------------------------------- Register / edit operation

enum class OperationType(val raw: String, val label: String) {
    Acquisto("acquisto", "Acquisto"), Vendita("vendita", "Vendita"), Dividendo("dividendo", "Dividendo"), Cedola("cedola", "Cedola"),
    Rimborso("rimborso", "Rimborso"), Split("split", "Split");

    val isIncome: Boolean get() = this == Dividendo || this == Cedola
    val hasCosts: Boolean get() = this != Split
    val suggestsMarketPrice: Boolean get() = this == Acquisto || this == Vendita

    companion object {
        fun of(raw: String): OperationType? = entries.firstOrNull { it.raw == raw }
    }
}

/** Label of every stored type, Italian source. */
fun operationTypeLabel(raw: String): String = if (raw == "rettifica") "Operazione sul capitale" else OperationType.of(raw)?.label ?: raw

/** Form values and validation of «Registra operazione» / «Modifica operazione». */
data class OperationForm(
    val type: OperationType = OperationType.Acquisto,
    val instrument: Instrument? = null,
    val date: String,
    val quantity: String = "",
    val price: String = "",
    val gross: String = "",
    val fees: String = "",
    val taxes: String = "",
    val fxRate: String = "",
    val note: String? = null,
    val held: Double? = null,
) {
    val isBond: Boolean get() = instrument?.isPercentOfNominal == true
    val showsQuantity: Boolean get() = !type.isIncome
    val showsPrice: Boolean get() = !type.isIncome && type != OperationType.Split
    val showsGross: Boolean get() = type.isIncome
    val stepCount: Int get() = if (type.hasCosts) 3 else 2

    fun needsFx(userCurrency: String): Boolean = (instrument?.currency ?: userCurrency) != userCurrency

    val quantityLabel: String
        get() = if (type == OperationType.Split) "Quote nuove per ogni quota" else if (isBond) "Valore nominale" else "Quote"
    val priceLabel: String get() = if (isBond) "Prezzo (% del nominale)" else "Prezzo per quota"

    val quantityValue: Double? get() = BBFormat.parseAmount(quantity)
    val priceValue: Double? get() = BBFormat.parseAmount(price)
    val grossValue: Double? get() = BBFormat.parseAmount(gross)

    /** INV-065 «Controvalore». */
    val countervalue: Double?
        get() {
            if (type == OperationType.Split) return null
            if (type.isIncome) return grossValue
            val q = quantityValue ?: return null
            val p = priceValue ?: return null
            return q * p * (if (isBond) 0.01 else 1.0)
        }

    val stepOneError: String? get() = if (instrument == null) "Scegli uno strumento" else null

    val stepTwoError: String?
        get() {
            if (type == OperationType.Split) return if ((quantityValue ?: 0.0) > 0) null else "Scrivi il rapporto dello split."
            if (!type.isIncome && JSNumber.trim(quantity).isEmpty()) return "Scrivi la quantità."
            return null
        }

    /** INV-066 / INV-069 and the oversell guard. */
    fun validate(today: String): String? {
        stepOneError?.let { return it }
        if (CalendarDate.parse(date) == null) return "Data non valida"
        if (date > today) return "La data non può essere nel futuro"
        when (type) {
            OperationType.Split -> if ((quantityValue ?: 0.0) <= 0) return "Rapporto dello split non valido"
            OperationType.Dividendo, OperationType.Cedola -> if ((grossValue ?: 0.0) <= 0) return "Importo non valido"
            else -> {
                if ((quantityValue ?: 0.0) <= 0) return "Quantità non valida"
                if ((priceValue ?: 0.0) <= 0) return "Prezzo non valido"
                val q = quantityValue
                if (type != OperationType.Acquisto && held != null && q != null && q > held + 1e-9) {
                    return "Non puoi vendere più quote di quelle che possiedi"
                }
            }
        }
        for (text in listOf(fees, taxes)) {
            if (JSNumber.trim(text).isNotEmpty()) {
                val v = BBFormat.parseAmount(text)
                if (v == null || v < 0) return "Importo non valido"
            }
        }
        if (JSNumber.trim(fxRate).isNotEmpty() && (BBFormat.parseAmount(fxRate) ?: 0.0) <= 0) return "Cambio non valido"
        return null
    }

    fun input(today: String): OperationInput? {
        if (validate(today) != null) return null
        val instrument = instrument ?: return null
        val costs = type.hasCosts
        return OperationInput(
            instrumentId = instrument.id, type = type.raw, date = date,
            quantity = if (type.isIncome) null else quantityValue,
            price = if (showsPrice) priceValue else null,
            grossAmount = if (type.isIncome) grossValue else null,
            fxRate = if (costs) BBFormat.parseAmount(fxRate) else null,
            fees = if (costs) BBFormat.parseAmount(fees) ?: 0.0 else 0.0,
            taxes = if (costs) BBFormat.parseAmount(taxes) ?: 0.0 else 0.0,
            note = note?.takeIf { JSNumber.trim(it).isNotEmpty() },
        )
    }

    companion object {
        fun numberText(value: Double): String = InvestmentsRules.jsString(value).replace(".", ",")
        fun priceText(close: Double): String = numberText(Math.rint(close * 1_000_000) / 1_000_000)

        /** Edit: starts from the saved values (INV-071); FX empty keeps the stored rate. */
        fun editing(t: InvestmentTransaction, instrument: Instrument?, held: Double?): OperationForm = OperationForm(
            type = OperationType.of(t.type) ?: OperationType.Acquisto, instrument = instrument, date = t.date,
            quantity = numberText(t.quantityValue), price = numberText(t.priceValue), gross = t.grossValue?.let(::numberText) ?: "",
            fees = if (t.feesValue == 0.0) "" else numberText(t.feesValue), taxes = if (t.taxesValue == 0.0) "" else numberText(t.taxesValue),
            fxRate = "", note = t.note, held = held,
        )
    }
}

/** INV-067: the line under the price field. */
sealed interface PriceSuggestionHint {
    data object Searching : PriceSuggestionHint
    data object Downloading : PriceSuggestionHint
    data object None : PriceSuggestionHint
    data class Close(val date: String, val sameDay: Boolean, val manual: Boolean) : PriceSuggestionHint

    val source: String
        get() = when (this) {
            Searching -> "Cerco il prezzo di questa data…"
            Downloading -> "Scarico i prezzi di questa data…"
            None -> "Nessun prezzo per questa data: inseriscilo tu."
            is Close -> if (manual) {
                if (sameDay) "Il tuo prezzo del {0}" else "Il tuo ultimo prezzo prima di questa data, del {0}"
            } else {
                if (sameDay) "Chiusura del {0}" else "Ultima chiusura prima di questa data, del {0}"
            }
        }

    companion object {
        fun of(state: PriceOnDate?, fetching: Boolean, date: String): PriceSuggestionHint? {
            if (state == null) return if (fetching) Searching else null
            if (state.loading) return Downloading
            val price = state.price ?: return None
            return Close(price.date, price.date == date, price.origin == "manuale")
        }
    }
}

// ---------------------------------------------------------------- Targets editor (INV-051)

data class TargetDraft(val instrumentId: String, val name: String, val percent: String) {
    val value: Double? get() = BBFormat.parseAmount(percent)
}

object TargetsEditor {
    fun initial(saved: List<InvestmentsView.Target>, current: List<InvestmentsView.Target>, name: (String) -> String): List<TargetDraft> =
        (saved.ifEmpty { current }).map { TargetDraft(it.instrumentId, name(it.instrumentId), OperationForm.numberText(Math.rint(it.weight * 1000) / 10)) }

    fun total(rows: List<TargetDraft>): Double = rows.sumOf { it.value ?: 0.0 }

    fun missing(rows: List<TargetDraft>): Double = Math.rint((100 - total(rows)) * 10) / 10

    fun canSave(rows: List<TargetDraft>): Boolean {
        if (rows.isEmpty() || rows.size > InvestmentsRules.MAX_TARGETS || rows.map { it.instrumentId }.toSet().size != rows.size) return false
        if (!rows.all { (it.value ?: 0.0) > 0 && (it.value ?: 0.0) <= 100 }) return false
        return abs(total(rows) - 100) <= 0.01
    }

    fun weights(rows: List<TargetDraft>): List<InvestmentsView.Target> {
        val sum = total(rows)
        return rows.map { InvestmentsView.Target(it.instrumentId, (it.value ?: 0.0) / sum) }
    }

    fun fillLast(rows: List<TargetDraft>): List<TargetDraft> {
        val last = rows.lastOrNull() ?: return rows
        val value = last.value ?: return rows
        return rows.dropLast(1) + last.copy(percent = OperationForm.numberText(Math.rint((value + missing(rows)) * 10) / 10))
    }
}

// ---------------------------------------------------------------- Security page helpers

object TitleRules {
    /** SEC-030: comma or dot decimals; > 0. */
    fun parseAlertLevel(text: String): Double? {
        val trimmed = JSNumber.trim(text)
        if (trimmed.isEmpty()) return null
        val normalized = if (trimmed.contains(",") && trimmed.contains(".")) {
            if (trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')) trimmed.replace(".", "").replace(",", ".") else trimmed.replace(",", "")
        } else {
            trimmed.replace(",", ".")
        }
        val v = normalized.toDoubleOrNull() ?: return null
        return if (v.isFinite() && v > 0) v else null
    }

    fun riskLevel(volatility: Double): Int = when {
        volatility < 0.08 -> 1
        volatility < 0.15 -> 2
        volatility < 0.25 -> 3
        else -> 4
    }

    fun riskScalePosition(volatility: Double): Double = min(1.0, max(0.0, volatility / 0.35))

    val riskLevelLabels = listOf("Basso", "Medio", "Alto", "Molto alto")

    /** SEC-045. */
    fun terCost(ter: Double, years: Int, capital: Double = 10_000.0, rate: Double = 0.05): Double =
        capital * ((1 + rate).pow(years) - ((1 + rate) * (1 - ter)).pow(years))

    /** SEC-021. */
    fun purchaseMarkers(series: List<TitleAnalysis.Point>, purchases: List<TitleAnalysis.Purchase>): List<Int> {
        val first = series.firstOrNull()?.date ?: return emptyList()
        val last = series.last().date
        val out = mutableListOf<Int>()
        for (p in purchases) {
            if (p.date < first || p.date > last) continue
            val i = series.indexOfFirst { it.date >= p.date }
            if (i >= 0 && i !in out) out += i
        }
        return out
    }

    fun isRising(series: List<TitleAnalysis.Point>): Boolean {
        val first = series.firstOrNull() ?: return true
        return series.last().close >= first.close
    }

    fun isAtHigh(fromHigh: Double?): Boolean = (fromHigh ?: -1.0) > -0.005

    val returnKeys = listOf("1M" to "1 mese", "3M" to "3 mesi", "6M" to "6 mesi", "1A" to "1 anno", "YTD" to "Da inizio anno")
}

// ---------------------------------------------------------------- Instrument icon

data class InstrumentIconSpec(val initials: String, val swatch: String)

object InstrumentIcons {
    fun typeSwatch(type: InstrumentType): String = when (type) {
        InstrumentType.Etf -> "blue"
        InstrumentType.Azione -> "violet"
        InstrumentType.Obbligazione -> "teal"
        InstrumentType.Fondo -> "amber"
        InstrumentType.Crypto -> "orange"
        InstrumentType.Etc -> "slate"
    }

    fun typeLabel(type: InstrumentType): String = when (type) {
        InstrumentType.Etf -> "ETF"
        InstrumentType.Azione -> "Azione"
        InstrumentType.Obbligazione -> "Obbligazione / BTP"
        InstrumentType.Fondo -> "Fondo comune"
        InstrumentType.Crypto -> "Crypto"
        InstrumentType.Etc -> "ETC (materie prime)"
    }

    fun typePlural(type: InstrumentType): String = when (type) {
        InstrumentType.Etf -> "ETF"
        InstrumentType.Azione -> "Azioni"
        InstrumentType.Obbligazione -> "Obbligazioni"
        InstrumentType.Fondo -> "Fondi"
        InstrumentType.Crypto -> "Crypto"
        InstrumentType.Etc -> "Materie prime (ETC)"
    }

    private data class Issuer(val initials: String, val swatch: String, val prefixes: List<String>)

    private val issuers = listOf(
        Issuer("iS", "blue", listOf("ishares", "blackrock")), Issuer("V", "rose", listOf("vanguard")),
        Issuer("X", "teal", listOf("xtrackers", "db x trackers", "dws")), Issuer("S", "violet", listOf("spdr", "state street")),
        Issuer("A", "orange", listOf("amundi", "lyxor", "cpr")), Issuer("In", "emerald", listOf("invesco")),
        Issuer("W", "amber", listOf("wisdomtree", "etfs")), Issuer("VE", "teal", listOf("vaneck")), Issuer("U", "rose", listOf("ubs")),
        Issuer("H", "rose", listOf("hsbc")), Issuer("JP", "slate", listOf("jpmorgan", "j p morgan", "jp morgan")),
        Issuer("BN", "emerald", listOf("bnp paribas")), Issuer("GX", "blue", listOf("global x")), Issuer("F", "blue", listOf("franklin")),
        Issuer("Fi", "blue", listOf("fineco")),
    )

    fun normalize(name: String): String {
        val folded = Normalizer.normalize(name.lowercase(), Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")
        return folded.replace(Regex("[^a-z0-9]+"), " ").trim()
    }

    fun initials(name: String): String {
        val words = normalize(name).split(" ").filter { it.isNotEmpty() }
        val first = words.firstOrNull() ?: return "?"
        val letters = if (words.size == 1) first.take(2) else first.take(1) + words[1].take(1)
        return letters.take(1).uppercase() + letters.drop(1).lowercase()
    }

    fun issuer(name: String): InstrumentIconSpec? {
        val n = normalize(name)
        return issuers.firstOrNull { i -> i.prefixes.any { n == it || n.startsWith("$it ") } }?.let { InstrumentIconSpec(it.initials, it.swatch) }
    }

    fun spec(type: InstrumentType, name: String): InstrumentIconSpec {
        // ETFs, ETCs and funds show their issuer (ETCs since web #438).
        if (type == InstrumentType.Etf || type == InstrumentType.Etc || type == InstrumentType.Fondo) issuer(name)?.let { return it }
        return InstrumentIconSpec(initials(name), typeSwatch(type))
    }

    fun wantsRemoteLogo(type: InstrumentType, name: String): Boolean =
        type == InstrumentType.Azione || ((type == InstrumentType.Etf || type == InstrumentType.Etc || type == InstrumentType.Fondo) && issuer(name) != null)
}

// ---------------------------------------------------------------- Search results (SEC-003…006)

sealed interface MarketSearchItem {
    data class Yahoo(val hit: InstrumentSearchResult.MarketHit) : MarketSearchItem
    data class Coingecko(val coin: InstrumentSearchResult.CryptoHit) : MarketSearchItem

    val id: String get() = when (this) { is Yahoo -> "y:${hit.symbol}"; is Coingecko -> "cg:${coin.id}" }
    val type: InstrumentType get() = when (this) { is Yahoo -> hit.kind; is Coingecko -> InstrumentType.Crypto }
    val title: String get() = when (this) { is Yahoo -> hit.name; is Coingecko -> coin.name }

    fun detail(cryptoCurrency: String, inWord: String = "in"): String = when (this) {
        is Yahoo -> listOf(hit.symbol, hit.exchangeLabel ?: "").filter { it.isNotEmpty() }.joinToString(" · ")
        is Coingecko -> "${coin.symbol.uppercase()} · $inWord $cryptoCurrency"
    }

    fun createInput(currency: String, isin: String?): InstrumentCreateInput = when (this) {
        is Yahoo -> InstrumentCreateInput.Yahoo(hit.symbol, hit.name, hit.type, isin)
        is Coingecko -> InstrumentCreateInput.Coingecko(coin.id, coin.name, currency)
    }
}

data class SearchResultGroup(val type: InstrumentType, val items: List<MarketSearchItem>)

object InstrumentSearch {
    val typeOrder = listOf(InstrumentType.Etf, InstrumentType.Azione, InstrumentType.Fondo, InstrumentType.Obbligazione, InstrumentType.Etc, InstrumentType.Crypto)
    const val MAX_CRYPTO = 5
    const val MIN_QUERY_LENGTH = 2

    fun isSearchable(query: String): Boolean = query.trim().length >= MIN_QUERY_LENGTH

    fun relevantCrypto(coins: List<InstrumentSearchResult.CryptoHit>, query: String, hasMarketResults: Boolean): List<InstrumentSearchResult.CryptoHit> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return emptyList()
        return coins.filter { coin ->
            val symbol = coin.symbol.trim().lowercase()
            val name = coin.name.trim().lowercase()
            symbol == q || name == q || (!hasMarketResults && (symbol.startsWith(q) || name.startsWith(q)))
        }.take(MAX_CRYPTO)
    }

    fun group(result: InstrumentSearchResult, query: String): List<SearchResultGroup> {
        val stocks = result.market.filter { it.type != "crypto" }
        val coins = relevantCrypto(result.crypto, query, stocks.isNotEmpty())
        val items: List<MarketSearchItem> = result.market.filter { it.type != "crypto" || coins.isEmpty() }.map { MarketSearchItem.Yahoo(it) } +
            coins.map { MarketSearchItem.Coingecko(it) }
        return typeOrder.mapNotNull { type -> items.filter { it.type == type }.takeIf { it.isNotEmpty() }?.let { SearchResultGroup(type, it) } }
    }

    fun rankKnown(known: List<Instrument>, suggestions: List<Instrument>): List<Instrument> {
        val rank = suggestions.withIndex().associate { (i, s) -> s.id to i }
        return known.withIndex().sortedWith(compareBy({ rank[it.value.id] ?: Int.MAX_VALUE }, { it.index })).map { it.value }
    }

    fun manualDefaultType(isin: String?): InstrumentType = if (isin?.startsWith("IT") == true) InstrumentType.Obbligazione else InstrumentType.Fondo

    fun isValidCurrency(code: String): Boolean = code.length == 3 && code.all { it in 'A'..'Z' }

    fun manualInput(name: String, type: InstrumentType, currency: String, isin: String?): InstrumentCreateInput? {
        val trimmed = name.trim()
        if (trimmed.isEmpty() || !isValidCurrency(currency)) return null
        if (isin != null && type == InstrumentType.Obbligazione) return InstrumentCreateInput.Isin(isin, trimmed, type.raw, currency)
        return InstrumentCreateInput.Manual(trimmed, type.raw, currency, isin)
    }
}

// ---------------------------------------------------------------- Benchmark (INV-038…040)

data class BenchmarkSuggestion(val label: String, val description: String, val name: String, val yahooSymbol: String, val isin: String)

sealed interface BenchmarkWait {
    data object Checking : BenchmarkWait
    data class Downloading(val saved: Int, val total: Int?) : BenchmarkWait
    data object Failed : BenchmarkWait
    data class NoHistory(val firstPriceDate: String) : BenchmarkWait
    data object Incomplete : BenchmarkWait

    val canRetry: Boolean get() = this is Failed || this is Incomplete || this is NoHistory
}

/** Backfill state of the benchmark as read: [NotRead] = checking, [Read] with null = nothing on the server. */
sealed interface BackfillRead {
    data object NotRead : BackfillRead
    data class Read(val state: BackfillState?) : BackfillRead
}

object BenchmarkRules {
    val suggestions = listOf(
        BenchmarkSuggestion("S&P 500", "Grandi aziende statunitensi", "iShares Core S&P 500 UCITS ETF (Acc)", "CSPX.L", "IE00B5BMR087"),
        BenchmarkSuggestion("MSCI World", "Azioni dei mercati sviluppati", "iShares Core MSCI World UCITS ETF (Acc)", "IWDA.AS", "IE00B4L5Y983"),
        BenchmarkSuggestion("FTSE All-World", "Mercati sviluppati ed emergenti", "Vanguard FTSE All-World UCITS ETF (Acc)", "VWCE.DE", "IE00BK5BQT80"),
        BenchmarkSuggestion("Nasdaq-100", "Grandi aziende non finanziarie del Nasdaq", "iShares NASDAQ 100 UCITS ETF (Acc)", "SXRV.DE", "IE00B53SZB19"),
    )

    fun wait(backfill: BackfillRead, firstPriceDate: String?, baseKey: String): BenchmarkWait {
        val state = (backfill as? BackfillRead.Read ?: return BenchmarkWait.Checking).state
        if (state != null && state.isRunning) return BenchmarkWait.Downloading(state.saved ?: 0, state.total)
        val failed = state?.status == "failed" || state?.interrupted == true
        val first = firstPriceDate ?: return BenchmarkWait.Failed
        if (first > baseKey) {
            if (failed) return BenchmarkWait.Failed
            return if (state?.status == "done") BenchmarkWait.NoHistory(first) else BenchmarkWait.Incomplete
        }
        return if (failed) BenchmarkWait.Failed else BenchmarkWait.Incomplete
    }

    fun verdict(portfolioValue: Double, simulatedValue: Double): String {
        val diff = (portfolioValue - simulatedValue) / max(abs(simulatedValue), 1.0)
        if (abs(diff) < 0.01) return "even"
        return if (diff > 0) "better" else "worse"
    }
}

// ---------------------------------------------------------------- Exposure labels

object ExposureKeys {
    val sectorLabels = mapOf(
        "tecnologia" to "Tecnologia", "finanza" to "Finanza", "salute" to "Salute", "industria" to "Industria",
        "consumi_ciclici" to "Consumi ciclici", "consumi_difensivi" to "Consumi di base", "comunicazioni" to "Comunicazioni",
        "energia" to "Energia", "materiali" to "Materiali", "servizi_pubblici" to "Servizi pubblici", "immobiliare" to "Immobiliare",
        "obbligazioni" to "Obbligazioni", "liquidita" to "Liquidità", "materie_prime" to "Materie prime", "crypto" to "Crypto",
        "altro" to "Altro", "non_classificato" to "Non classificato",
    )
    val areaLabels = mapOf(
        "nord_america" to "Nord America", "europa" to "Europa", "italia" to "Italia", "giappone" to "Giappone", "pacifico" to "Pacifico",
        "emergenti" to "Paesi emergenti", "nessuna" to "Senza area", "non_classificato" to "Non classificato",
    )
    val sectorColors = mapOf(
        "tecnologia" to "blue", "finanza" to "indigo", "salute" to "emerald", "industria" to "slate-dark", "consumi_ciclici" to "rose",
        "consumi_difensivi" to "lime", "comunicazioni" to "violet", "energia" to "orange", "materiali" to "amber-dark",
        "servizi_pubblici" to "cyan", "immobiliare" to "pink", "obbligazioni" to "teal", "liquidita" to "green-light",
        "materie_prime" to "yellow", "crypto" to "orange-dark", "altro" to "purple-light", "non_classificato" to "slate-light",
    )
    val areaColors = mapOf(
        "nord_america" to "blue", "europa" to "indigo", "italia" to "emerald", "giappone" to "rose", "pacifico" to "cyan",
        "emergenti" to "amber", "nessuna" to "orange", "non_classificato" to "slate-light",
    )
    val sectorIcons = mapOf(
        "tecnologia" to "cpu", "finanza" to "landmark", "salute" to "heart-pulse", "industria" to "factory", "consumi_ciclici" to "shopping-bag",
        "consumi_difensivi" to "shopping-cart", "comunicazioni" to "radio-tower", "energia" to "zap", "materiali" to "pickaxe",
        "servizi_pubblici" to "droplets", "immobiliare" to "building-2", "obbligazioni" to "scroll-text", "liquidita" to "banknote",
        "materie_prime" to "gem", "crypto" to "bitcoin", "altro" to "shapes", "non_classificato" to "circle-question-mark",
    )
    val sourceLabels = mapOf(
        "manuale" to "Inserita da te", "tipo" to "Dal tipo di strumento", "yahoo" to "Yahoo Finance", "stima_indice" to "Stima dall'indice",
        "isin" to "Dal paese dell'ISIN", "nessuno" to "Nessun dato",
    )
    val currencyColors = listOf("blue", "rose", "emerald", "amber", "violet")
    const val VISIBLE_ROWS = 6
    const val COVERAGE_THRESHOLD = 0.9

    fun share(share: Double, locale: BBLocale): String {
        val d = if (share < 0.1) 1 else 0
        return BBFormat.formatNumber(share * 100, locale, minimumFractionDigits = d, maximumFractionDigits = d) + "%"
    }

    fun driftText(row: InvestmentsView.AllocationRowView): Pair<String, Map<String, String>> {
        if (!row.inTarget && row.status == "in_linea") return "non nell'obiettivo" to emptyMap()
        if (row.status == "in_linea") return "in linea" to emptyMap()
        val points = JSNumber.round(abs(row.drift) * 100).toLong()
        return "{0} punti" to mapOf("0" to "${if (row.drift < 0) BBFormat.MINUS_SIGN else "+"}$points")
    }
}

/** The served allocation as the ported engine's input (INV-054). */
fun InvestmentsView.Allocation.analysis(): AllocationAnalysis = AllocationAnalysis(
    rows = rows.map {
        AllocationRow(it.instrumentId, it.value, it.currentWeight, it.targetWeight, it.drift,
            AllocationStatus.entries.firstOrNull { s -> s.key == it.status } ?: AllocationStatus.IN_LINEA, it.inTarget)
    },
    total = total, unpricedIds = unpricedIds, maxDrift = maxDrift,
)

object PlainLabels {
    fun overlap(share: Double): Pair<String, String> = when {
        share >= 0.8 -> "Quasi lo stesso investimento" to "alta"
        share >= 0.5 -> "In buona parte lo stesso" to "media"
        else -> "Una parte in comune" to "bassa"
    }

    fun correlation(value: Double): Pair<String, String> = when {
        value >= 0.8 -> "Si muovono quasi sempre insieme" to "alta"
        value >= 0.5 -> "Spesso vanno nella stessa direzione" to "media"
        value >= 0.2 -> "Si muovono poco insieme" to "bassa"
        else -> "Indipendenti" to "bassa"
    }

    fun overlapMethodNote(method: String): String = when (method) {
        "stesso_indice" -> "Replicano lo stesso indice."
        "aree_indici" -> "Stima dagli indici che replicano."
        else -> "Almeno così: contando solo i primi 10 titoli."
    }

    fun averageCorrelation(pairs: List<InvestmentsView.CorrelationPair>): Double? = if (pairs.isEmpty()) null else pairs.sumOf { it.value } / pairs.size

    fun decimal2(value: Double, locale: BBLocale): String = BBFormat.formatNumber(value, locale, minimumFractionDigits = 2, maximumFractionDigits = 2)
}

// ---------------------------------------------------------------- Dividendi / Tasse helpers

object IncomeRules {
    fun monthsAgo(today: String, months: Int): String {
        val d = CalendarDate.parse(today) ?: return today
        var y = d.year
        var m = d.month - months
        while (m < 1) { m += 12; y -= 1 }
        return CalendarDate(y, m, min(d.day, 28)).iso
    }

    fun basisLabel(basis: String): String = when (basis) {
        "fonte" -> "come l'anno scorso"
        "cedola" -> "dalla cedola"
        else -> "dai tuoi incassi"
    }
}

object TaxRules {
    fun recentYears(years: List<InvestmentsTaxes.TaxYear>): List<InvestmentsTaxes.TaxYear> = years.sortedByDescending { it.year }.take(5)

    fun lossesByExpiry(losses: List<InvestmentsTaxes.LossEntry>, crypto: Boolean = false): List<Pair<Int, Double>> {
        val byYear = sortedMapOf<Int, Double>()
        for (e in losses) if (e.crypto == crypto) byYear[e.expiresYear] = (byYear[e.expiresYear] ?: 0.0) + e.remaining
        return byYear.map { it.key to it.value }
    }

    fun carryforwardError(year: Int?, amount: Double?, currentYear: Int): String? {
        if (year == null || year < 2000) return "Anno non valido"
        if (year > currentYear) return "L'anno non può essere futuro"
        if (amount == null || amount <= 0 || amount > 100_000_000) return "Importo non valido"
        return null
    }

    fun rateSourceLabel(source: String?): String = when (source) {
        "manuale" -> "impostata da te"
        "titolo_di_stato" -> "titolo di Stato, dal nome"
        else -> "ordinaria"
    }

    fun couponsError(rate: Double?, maturity: String?): String? {
        if (rate == null && maturity.isNullOrEmpty()) return null
        if (rate == null || maturity.isNullOrEmpty()) return "Per le cedole servono tasso e scadenza"
        if (rate <= 0 || rate > 30) return "Tasso non valido"
        return null
    }
}

// ---------------------------------------------------------------- Security page formatting

data class KeyFact(val label: String, val value: String, val note: String? = null, val noteValues: Map<String, String> = emptyMap())

data class IndicatorMeta(val label: String, val hint: String, val formula: String, val format: String)

object TitleFormat {
    val indicatorMeta = mapOf(
        "pe" to IndicatorMeta("P/E (prezzo / utili)", "Anni di utili, ai ritmi di oggi, per ripagare il prezzo.", "Prezzo ÷ utile per azione degli ultimi 12 mesi.", "multiple"),
        "ps" to IndicatorMeta("P/S (prezzo / ricavi)", "Quanto si paga per ogni euro di ricavi.", "Prezzo ÷ ricavi per azione degli ultimi 12 mesi.", "multiple"),
        "pb" to IndicatorMeta("P/B (prezzo / patrimonio)", "Prezzo rispetto al patrimonio contabile.", "Prezzo ÷ patrimonio netto per azione dell'ultimo bilancio.", "multiple"),
        "pfcf" to IndicatorMeta("P/FCF (prezzo / cassa libera)", "Prezzo rispetto alla cassa che resta dopo gli investimenti.", "Prezzo ÷ cassa libera per azione degli ultimi 12 mesi.", "multiple"),
        "evEbitda" to IndicatorMeta("EV / EBITDA", "Valore dell'azienda, debiti compresi, rispetto al margine operativo.", "(Capitalizzazione + debiti − liquidità) ÷ EBITDA degli ultimi 12 mesi.", "multiple"),
        "earningsYield" to IndicatorMeta("Rendimento degli utili", "L'inverso del P/E: utile per ogni 100 di prezzo.", "Utile per azione ÷ prezzo.", "pct"),
        "gross" to IndicatorMeta("Margine lordo", "Ricavi meno il costo di ciò che si vende.", "Utile lordo ÷ ricavi.", "pct"),
        "operating" to IndicatorMeta("Margine operativo", "Quanto resta dopo i costi di gestione.", "Utile operativo ÷ ricavi.", "pct"),
        "net" to IndicatorMeta("Margine netto", "Utile su ogni 100 di ricavi.", "Utile netto ÷ ricavi.", "pct"),
        "roe" to IndicatorMeta("ROE", "Utile sul capitale degli azionisti.", "Utile netto degli ultimi 12 mesi ÷ patrimonio netto.", "pct"),
        "roa" to IndicatorMeta("ROA", "Utile su tutto ciò che l'azienda possiede.", "Utile netto degli ultimi 12 mesi ÷ totale attivo.", "pct"),
        "roic" to IndicatorMeta("ROIC (prima delle tasse)", "Rendimento del capitale investito, debiti compresi.", "Utile operativo ÷ (patrimonio netto + debiti − liquidità).", "pct"),
        "interestCoverage" to IndicatorMeta("Copertura degli interessi", "Quante volte l'utile operativo paga gli interessi.", "Utile operativo ÷ interessi passivi.", "times"),
        "debtToEquity" to IndicatorMeta("Debiti / patrimonio", "Sopra 1 l'azienda usa più debiti che capitale proprio.", "Debiti finanziari ÷ patrimonio netto.", "multiple"),
        "netDebtToEbitda" to IndicatorMeta("Debito netto / EBITDA", "Anni di margine operativo per ripagare il debito netto.", "(Debiti − liquidità) ÷ EBITDA degli ultimi 12 mesi.", "years"),
        "currentRatio" to IndicatorMeta("Liquidità corrente", "Attività a breve rispetto ai debiti a breve.", "Attività correnti ÷ passività correnti.", "multiple"),
        "payout" to IndicatorMeta("Payout", "Parte dell'utile distribuita come dividendo.", "Dividendi pagati ÷ utile netto degli ultimi 12 mesi.", "pct"),
    )
    val valuationOrder = listOf("pe", "ps", "pb", "pfcf", "evEbitda", "earningsYield")
    val marginOrder = listOf("gross", "operating", "net")
    val profitabilityOrder = listOf("roe", "roa", "roic", "interestCoverage")
    val solidityOrder = listOf("debtToEquity", "netDebtToEbitda", "currentRatio", "payout")
    val perShareRows = listOf("revenue" to "Ricavi", "eps" to "Utile", "fcf" to "Cassa libera", "book" to "Patrimonio", "dividend" to "Dividendo")

    fun indicator(value: Double, format: String, locale: BBLocale): String = when (format) {
        "pct" -> BBFormat.formatRatio(value * 100, locale) + "%"
        "years" -> BBFormat.formatRatio(value, locale)
        "times" -> BBFormat.formatRatio(value, locale) + "×"
        else -> BBFormat.formatRatio(value, locale, digits = if (abs(value) < 10) 2 else 1)
    }

    fun perShare(value: Double, currency: String, locale: BBLocale): String {
        val digits = if (abs(value) < 0.1) 4 else 2
        return "${BBFormat.formatNumber(value, locale, minimumFractionDigits = digits, maximumFractionDigits = digits)} $currency"
    }

    fun operand(term: TitleAnalysis.Indicator.Term, currency: String, priceCurrency: String, locale: BBLocale, sharesWord: String = "azioni"): String =
        when (term.unit) {
            "price" -> perShare(term.value, priceCurrency, locale)
            "perShare" -> perShare(term.value, currency, locale)
            "shares" -> "${BBFormat.formatCompactAmount(term.value, locale)} $sharesWord"
            else -> "${BBFormat.formatCompactAmount(term.value, locale)} $currency"
        }

    /** SEC-019. */
    fun keyFacts(a: TitleAnalysis, locale: BBLocale): List<KeyFact> {
        val currency = a.instrument.currency
        val f = a.fundamentals
        val facts = mutableListOf<KeyFact?>()
        when (a.instrument.kind) {
            InstrumentType.Azione -> {
                val pe = a.stock?.valuation?.get("pe")?.value ?: f?.trailingPE
                val revenue = a.stock?.perShare?.get("revenue")?.lastOrNull()
                val yieldToday = a.dividends?.yieldToday ?: f?.dividendYield
                facts += f?.marketCap?.let { KeyFact("Capitalizzazione", "${BBFormat.formatCompactAmount(it, locale)} $currency") }
                facts += pe?.let { KeyFact("P/E", indicator(it, "multiple", locale), "utili ultimi 12 mesi") }
                if (revenue != null && a.stock != null) {
                    facts += KeyFact("Ricavi per azione", perShare(revenue, a.stock.currency, locale), "ultimi 12 mesi")
                } else if (f?.revenuePerShare != null) {
                    facts += KeyFact("Ricavi per azione", perShare(f.revenuePerShare, currency, locale), "ultimi 12 mesi")
                }
                if (yieldToday != null && yieldToday > 0) {
                    val trailing = a.dividends?.trailing?.takeIf { it > 0 }
                    facts += KeyFact("Dividendo", BBFormat.formatPct(yieldToday, locale), trailing?.let { "{0} in 12 mesi" },
                        trailing?.let { mapOf("0" to perShare(it, currency, locale)) } ?: emptyMap())
                }
            }
            InstrumentType.Etf, InstrumentType.Fondo -> {
                val y = f?.fundYield ?: a.dividends?.yieldToday
                facts += f?.expenseRatio?.let {
                    KeyFact("Costo annuo (TER)", BBFormat.formatPct(it, locale, digits = 2), "{0} ogni 10.000",
                        mapOf("0" to "${BBFormat.formatCompactAmount(it * 10_000, locale)} $currency"))
                }
                facts += f?.totalAssets?.let { KeyFact("Patrimonio", "${BBFormat.formatCompactAmount(it, locale)} $currency") }
                facts += f?.fundCategory?.let { KeyFact("Categoria", it) }
                if (y != null && y > 0) facts += KeyFact("Rendimento da dividendo", BBFormat.formatPct(y, locale))
            }
            else -> a.stats?.let { stats ->
                facts += stats.returns["1A"]?.let { KeyFact("1 anno", BBFormat.formatSignedPct(it, locale)) }
                facts += stats.returns["YTD"]?.let { KeyFact("Da inizio anno", BBFormat.formatSignedPct(it, locale)) }
            }
        }
        a.stats?.volatility?.let { facts += KeyFact("Volatilità", BBFormat.formatPct(it, locale, digits = 0), "ultimo anno") }
        a.stats?.fromHigh?.let { facts += KeyFact("Dal massimo", if (it < -0.005) BBFormat.formatSignedPct(it, locale) else "sui massimi", "52 settimane") }
        return facts.filterNotNull().take(6)
    }

    fun rangePosition(last: Double, low: Double, high: Double): Double = if (high > low) min(1.0, max(0.0, (last - low) / (high - low))) else 0.5
}
