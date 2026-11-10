package io.buddybudget.core.domain.debts

import io.buddybudget.core.data.DebtEventInput
import io.buddybudget.core.data.DebtEventView
import io.buddybudget.core.data.DebtPlanRow
import io.buddybudget.core.data.DebtView
import io.buddybudget.core.data.DebtsInsights
import io.buddybudget.core.data.DebtsViewData
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.investments.InvestmentsTextRun
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.transactions.AmountInputText

// Debiti screens state and rules (spec: features/10-debts.md). The server computes plans, totals and the overview
// readings (`GET /api/debts?include=insights`); the per-loan «E se…» simulators run on the device with the ported
// `DebtCalc`. Same names on iOS (`DebtsUiState.swift`).

/** What the overview and the detail show (shared "view gate", DEBT-008). */
enum class DebtsGate {
    Loading, Failed, Empty, Content;

    companion object {
        fun of(loaded: Boolean, failed: Boolean, count: Int): DebtsGate = when {
            !loaded -> if (failed) Failed else Loading
            count == 0 -> Empty
            else -> Content
        }
    }
}

/** Simulation hypotheses of «E se…» (DEBT-030/031). */
enum class DebtSimulationKind(val label: String) { Extra("Più ogni mese"), Estinzione("Una tantum"), Surroga("Surroga") }

/** An Italian catalog key (translate in the UI). */
data class DebtsMessage(val source: String)

/** Simple event dialogs (DEBT-025/026). */
enum class DebtEventDialogKind(val key: String) {
    RateChange("rate_change"), BalanceCorrection("balance_correction");

    val title: String get() = if (this == RateChange) "Cambio di tasso" else "Correggi il residuo"
    val description: String
        get() = if (this == RateChange) "Dalla data indicata le rate si ricalcolano al nuovo tasso, con lo stesso numero di rate."
        else "Se il residuo reale è diverso da quello del piano (rate saltate, sospensioni, estinzioni parziali), indicalo: il piano riparte da lì."
    val label: String get() = if (this == RateChange) "Nuovo tasso annuo (TAN, %)" else "Capitale residuo reale"
    val hint: String get() = if (this == RateChange) "Quello scritto dalla banca" else "Lo trovi sull'estratto o nell'area clienti della banca"
    val submit: String get() = if (this == RateChange) "Registra cambio tasso" else "Correggi il residuo"

    /** `parseAmount` then: rate ≥ 0; residual > 0 («Inserisci un valore valido»); left = message. */
    fun input(date: String, value: String): Pair<DebtEventInput?, DebtsMessage?> {
        val v = BBFormat.parseAmount(value)
        if (v == null || v < 0 || (v == 0.0 && this != RateChange)) return null to DebtsMessage("Inserisci un valore valido")
        return (if (this == RateChange) DebtEventInput.RateChange(date, v) else DebtEventInput.BalanceCorrection(date, v)) to null
    }
}

/** Labels of the add-debt fields by start mode (`FIELD_COPY`). */
data class DebtFieldCopy(val principal: String, val installments: String, val firstDate: String) {
    companion object {
        fun of(mode: DebtStartMode): DebtFieldCopy = when (mode) {
            DebtStartMode.NUOVO -> DebtFieldCopy("Capitale", "Numero di rate", "Prima rata")
            DebtStartMode.ORIGINE -> DebtFieldCopy("Capitale erogato", "Numero di rate totali", "Data della prima rata")
            DebtStartMode.FOTOGRAFIA -> DebtFieldCopy("Residuo di oggi", "Rate rimanenti", "Prossima rata")
        }
    }
}

/** The three start modes of the add flow (DEBT-009, `START_OPTIONS`). */
data class DebtStartOption(val mode: DebtStartMode, val title: String, val description: String) {
    companion object {
        val all = listOf(
            DebtStartOption(DebtStartMode.NUOVO, "Inizia da oggi", "Il finanziamento parte adesso o l'hai appena firmato. Il piano è tutto da pagare."),
            DebtStartOption(DebtStartMode.ORIGINE, "Già in corso: ho i dati del contratto",
                "Inserisci capitale, tasso e rate di quando l'hai preso. Ricostruiamo il piano e vedi quante rate sono già passate: poi confermi quelle che hai pagato. Adatto se hai il contratto sotto mano."),
            DebtStartOption(DebtStartMode.FOTOGRAFIA, "Già in corso: parto da com'è oggi",
                "Inserisci quanto devi ancora restituire, la rata e le rate rimaste. Il piano parte da oggi, senza storico. Adatto se non hai più il contratto o è stato rinegoziato."),
        )
    }
}

/** Result of the per-loan extra slider (DEBT-030). */
/** The three lines of a simulator answer (`SimulationResult`): label, big figure, caption; `positive` picks the tone. */
data class SimulationText(val label: String, val value: String, val caption: String, val positive: Boolean)

data class DebtExtraSimulation(val monthsSaved: Int, val interestSaved: Double, val endDate: String, val baselineEndDate: String) {
    fun showsGain(extra: Double): Boolean = extra > 0 && monthsSaved > 0
}

/** Pure rules of the Debiti screens. Same names on iOS (`DebtsRules`). */
object DebtsRules {
    const val EXTRA_DEFAULT = 200.0
    const val EXTRA_MAX = 1000.0
    const val EXTRA_STEP = 50.0
    const val PLAN_VISIBLE_PAST = 2
    const val PLAN_VISIBLE_FUTURE = 8
    const val CANDIDATE_WINDOW_DAYS = 20
    const val MAX_COSTS = 10
    const val NAME_MAX_LENGTH = 80
    const val ADD_STEPS = 4

    fun daysBetween(today: String, date: String): Int {
        val a = CalendarDate.parse(today) ?: return 0
        val b = CalendarDate.parse(date) ?: return 0
        return b.epochDay - a.epochDay
    }

    /** DEBT-003 relative text: (catalog key, values). */
    fun dueText(days: Int): Pair<String, Map<String, String>> = when {
        days == 0 -> "oggi" to emptyMap()
        days == 1 -> "domani" to emptyMap()
        days > 1 -> "tra {0} giorni" to mapOf("0" to days.toString())
        days == -1 -> "scaduta ieri" to emptyMap()
        else -> "scaduta da {0} giorni" to mapOf("0" to (-days).toString())
    }

    fun repaidShare(debt: DebtView, insights: DebtsInsights?): Double {
        insights?.repaid?.firstOrNull { it.debtId == debt.id }?.let { return it.share.coerceIn(0.0, 1.0) }
        val first = debt.plan.rows.firstOrNull() ?: return 0.0
        val total = first.residual + first.capital
        return if (total > 0) (1 - debt.plan.totals.residual / total).coerceIn(0.0, 1.0) else 0.0
    }

    fun freeDate(debts: List<DebtView>): String? = debts.filter { !it.finished }.map { it.plan.totals.endDate }.maxOrNull()

    fun openCount(debts: List<DebtView>): Int = debts.count { !it.finished }

    fun dueRow(debt: DebtView?, date: String): DebtPlanRow? = debt?.plan?.rows?.firstOrNull { it.dueDate == date && it.status != DebtInstallmentStatus.PAGATA }

    fun unsettled(debt: DebtView): List<DebtPlanRow> =
        debt.plan.rows.filter { it.status == DebtInstallmentStatus.DA_CONFERMARE || it.status == DebtInstallmentStatus.SCADUTA }

    /** DEBT-021: half-open range of the rows shown by default. */
    fun visibleRange(rows: List<DebtPlanRow>, today: String): IntRange {
        val firstFuture = rows.indexOfFirst { it.dueDate >= today }.let { if (it == -1) rows.size else it }
        return maxOf(0, firstFuture - PLAN_VISIBLE_PAST) until minOf(rows.size, firstFuture + PLAN_VISIBLE_FUTURE)
    }

    fun orderedEvents(debt: DebtView): List<DebtEventView> =
        debt.events.withIndex().sortedWith(compareByDescending<IndexedValue<DebtEventView>> { it.value.date }.thenBy { it.index }).map { it.value }

    fun defaultPaymentDate(row: DebtPlanRow, today: String): String = if (row.dueDate < today) row.dueDate else today

    /** DEBT-023: paid amount > 0 («Inserisci l'importo pagato»). */
    fun paymentInput(row: DebtPlanRow, date: String, amount: String, transactionId: String?): Pair<DebtEventInput?, DebtsMessage?> {
        val value = BBFormat.parseAmount(amount)
        if (value == null || value <= 0) return null to DebtsMessage("Inserisci l'importo pagato")
        return DebtEventInput.Payment(row.number, date, value, transactionId) to null
    }

    /** `toPlanTerms`. */
    fun terms(debt: DebtView): DebtTerms? {
        val first = CalendarDate.parse(debt.firstInstallmentDate) ?: return null
        return DebtTerms(debt.startMode, debt.principal, debt.annualRate, debt.installments, first, debt.declaredInstallment)
    }

    /** `toPlanEvent` (events missing their figures are skipped, as on the web). */
    fun planEvents(debt: DebtView): List<DebtPlanEvent> = debt.events.mapNotNull { e ->
        val date = CalendarDate.parse(e.date) ?: return@mapNotNull null
        when (e.type) {
            "payment" -> if (e.installmentNumber != null && e.amount != null) DebtPlanEvent.Payment(e.installmentNumber, date, e.amount, e.transactionId) else null
            "rate_change" -> e.rate?.let { DebtPlanEvent.RateChange(date, it) }
            "balance_correction" -> e.amount?.let { DebtPlanEvent.BalanceCorrection(date, it) }
            "early_repayment" -> {
                val effect = e.effect?.let { DebtEarlyRepaymentEffect.fromKey(it) }
                if (e.amount != null && effect != null) DebtPlanEvent.EarlyRepayment(date, e.amount, e.penalty ?: 0.0, effect) else null
            }
            else -> null
        }
    }

    /** DEBT-006: the server's exit plan for a slider value (nearest step). */
    fun exitPlan(insights: DebtsInsights?, extra: Double): DebtsInsights.ExitPlan? {
        val exit = insights?.exit ?: return null
        if (exit.extras.isEmpty()) return null
        val index = exit.extras.indices.minByOrNull { Math.abs(exit.extras[it] - extra) } ?: 0
        return exit.plans.getOrNull(index)
    }

    /** DEBT-030. */
    fun extraSimulation(debt: DebtView, extra: Double, today: String): DebtExtraSimulation? {
        val day = CalendarDate.parse(today) ?: return null
        val loan = listOf(DebtPayoffLoan(debt.id, debt.name, debt.totals.residual, debt.annualRate, debt.totals.currentInstallment))
        val base = DebtCalc.simulatePayoff(loan, 0.0, DebtPayoffStrategy.NONE, day)
        val faster = DebtCalc.simulatePayoff(loan, extra, DebtPayoffStrategy.AVALANCHE, day)
        return DebtExtraSimulation(base.months - faster.months, base.totalInterest - faster.totalInterest, faster.endDate.iso, base.endDate.iso)
    }

    /** DEBT-031: null until a valid rate (≥ 0) and a whole number of installments (≥ 1) are typed. */
    fun refinance(debt: DebtView, rate: String, installments: String, costs: String, penalty: String, today: String): DebtRefinanceResult? {
        val annualRate = if (JSNumber.trim(rate).isEmpty()) null else BBFormat.parseAmount(rate)
        val count = BBFormat.parseAmount(installments)
        if (annualRate == null || annualRate < 0 || count == null || count < 1 || count != Math.floor(count)) return null
        val day = CalendarDate.parse(today) ?: return null
        val end = CalendarDate.parse(debt.totals.endDate) ?: return null
        val current = DebtRefinanceCurrent(debt.totals.residual, debt.totals.currentInstallment, debt.totals.interestRemaining, end)
        val offer = DebtRefinanceOffer(annualRate, count.toInt(), BBFormat.parseAmount(costs) ?: 0.0, BBFormat.parseAmount(penalty) ?: 0.0)
        return runCatching { DebtCalc.compareRefinance(current, day, offer) }.getOrNull()
    }

    /** DEBT-032…035: preview of the early-repayment dialog. */
    fun earlyRepayment(debt: DebtView, today: String, values: DebtEarlyRepaymentFormValues): DebtEarlyRepaymentPreview {
        val terms = terms(debt) ?: return DebtEarlyRepaymentPreview.Empty
        val day = CalendarDate.parse(today) ?: return DebtEarlyRepaymentPreview.Empty
        val events = planEvents(debt)
        return try {
            val plan = DebtCalc.buildLoanPlan(terms, events, day)
            DebtCalc.previewEarlyRepayment(terms, events, plan, day, values)
        } catch (e: DebtAmortizationError) {
            DebtEarlyRepaymentPreview.Error(e.message)
        } catch (e: Exception) {
            DebtEarlyRepaymentPreview.Error("Qualcosa è andato storto. Riprova.")
        }
    }
}

/** Deep links into Debiti (DEBT-038). */
object DebtsRoutes {
    /** `/debiti/finanziamenti?id=X` → "X"; without id (or `/debiti/simulatore`) → ""; `/debiti` → null. */
    fun detailId(path: String): String? {
        val parts = path.split("?", limit = 2)
        if (parts[0] != "/debiti/finanziamenti" && parts[0] != "/debiti/simulatore") return null
        if (parts.size < 2) return ""
        return parts[1].split("&").map { it.split("=", limit = 2) }.firstOrNull { it.size == 2 && it[0] == "id" }?.get(1) ?: ""
    }
}

/** Everything the Debiti screens render. Same fields as `DebtsUiState` on iOS. */
data class DebtsUiState(
    val data: DebtsViewData? = null,
    val failed: Boolean = false,
    val selectedId: String? = null,
    val exitExtra: Double = DebtsRules.EXTRA_DEFAULT,
    val today: String,
) {
    val gate: DebtsGate get() = DebtsGate.of(data != null, failed, data?.debts?.size ?: 0)
    val debts get() = data?.debts ?: emptyList()
    val selected: DebtView? get() = debts.firstOrNull { it.id == selectedId } ?: debts.firstOrNull()
    val exitPlan: DebtsInsights.ExitPlan? get() = DebtsRules.exitPlan(data?.insights, exitExtra)
    val interest: DebtsInsights.InterestShares? get() = data?.insights?.interestShares?.takeIf { it.items.isNotEmpty() }
}

/** Debiti phrasing, bound to one language. Same API as `DebtsText` on iOS. */
class DebtsText(val locale: BBLocale, private val translate: (String) -> String) {
    fun tr(key: String, values: Map<String, String> = emptyMap()): String {
        val template = translate(key)
        return if (values.isEmpty()) template else BBFormat.interpolate(template, values)
    }

    fun money(value: Double, currency: String, digits: Int = 2, masked: Boolean = false): String =
        BBFormat.formatCurrency(value, currency, locale, maximumFractionDigits = digits, masked = masked)

    fun monthYear(iso: String): String = CalendarDate.parse(iso)?.let { BBFormat.formatMonthYear(it, locale) } ?: "—"

    fun duration(months: Int): String = BBFormat.formatDuration(months, locale.language) { translate(it) }

    fun percent(value: Double): String = BBFormat.formatNumber(value, locale, minimumFractionDigits = 2, maximumFractionDigits = 2) + "%"

    fun heroSubtitle(openCount: Int, freeDate: String?): String {
        if (openCount == 0) return tr("Nessun finanziamento aperto")
        val count = if (openCount == 1) tr("un finanziamento") else tr("{0} finanziamenti", mapOf("0" to openCount.toString()))
        return tr("{0} · liberi da debiti a {1}", mapOf("0" to count, "1" to (freeDate?.let(::monthYear) ?: "—")))
    }

    fun dueText(days: Int): String = DebtsRules.dueText(days).let { tr(it.first, it.second) }

    fun listDetail(debt: DebtView): String {
        if (debt.finished) return tr("Estinto")
        val apr = debt.apr?.let { " · ${BBFormat.formatPct(it / 100, locale, 2)} ${tr("TAEG")}" } ?: ""
        return tr("finisce a {0}{1}", mapOf("0" to monthYear(debt.totals.endDate), "1" to apr))
    }

    fun startMode(mode: DebtStartMode): String = when (mode) {
        DebtStartMode.NUOVO -> tr("Nuovo")
        DebtStartMode.ORIGINE -> tr("In corso · dall'origine")
        DebtStartMode.FOTOGRAFIA -> tr("In corso · fotografia di oggi")
    }

    fun status(status: DebtInstallmentStatus): String = when (status) {
        DebtInstallmentStatus.PAGATA -> tr("Pagata")
        DebtInstallmentStatus.DA_PAGARE -> tr("Da pagare")
        DebtInstallmentStatus.SCADUTA -> tr("Scaduta")
        DebtInstallmentStatus.DA_CONFERMARE -> tr("Da confermare")
    }

    fun rates(debt: DebtView): String = "${percent(debt.annualRate)} · ${debt.apr?.let(::percent) ?: "—"}"

    fun residualCaption(debt: DebtView): String =
        if (debt.finished) tr("Estinto") else tr("ancora da restituire · finisce a {0}", mapOf("0" to monthYear(debt.totals.endDate)))

    fun pending(debt: DebtView): String? {
        val unsettled = DebtsRules.unsettled(debt)
        if (unsettled.isEmpty()) return null
        val overdue = debt.totals.overdueCount
        if (overdue > 0) {
            val head = if (overdue == 1) tr("Una rata è scaduta") else tr("{0} rate sono scadute", mapOf("0" to overdue.toString()))
            return tr("{0} e non l'hai segnata come pagata.", mapOf("0" to head))
        }
        val count = if (unsettled.size == 1) tr("una rata già passata") else tr("{0} rate già passate", mapOf("0" to unsettled.size.toString()))
        return tr("Il piano conta {0}: se le hai pagate, confermale.", mapOf("0" to count))
    }

    fun bulkDone(count: Int): String =
        if (count == 1) tr("Una rata segnata come pagata") else tr("{0} rate segnate come pagate", mapOf("0" to count.toString()))

    fun event(event: DebtEventView, currency: String, masked: Boolean = false): String = when (event.type) {
        "payment" -> {
            val amount = if ((event.amount ?: 0.0) != 0.0) " · ${money(event.amount ?: 0.0, currency, masked = masked)}" else ""
            tr("Rata {0} pagata{1}", mapOf("0" to (event.installmentNumber?.toString() ?: ""), "1" to amount))
        }
        "rate_change" -> tr("Tasso portato al {0}%", mapOf("0" to BBFormat.formatNumber(event.rate ?: 0.0, locale, maximumFractionDigits = 4)))
        "early_repayment" -> {
            val how = if (event.effect == DebtEarlyRepaymentEffect.REDUCE_INSTALLMENT.key) tr("rata ridotta") else tr("durata ridotta")
            val penalty = if ((event.penalty ?: 0.0) != 0.0) tr(" · penale {0}", mapOf("0" to money(event.penalty ?: 0.0, currency, masked = masked))) else ""
            tr("Estinzione anticipata di {0} · {1}{2}", mapOf("0" to money(event.amount ?: 0.0, currency, masked = masked), "1" to how, "2" to penalty))
        }
        else -> tr("Residuo corretto a {0}", mapOf("0" to money(event.amount ?: 0.0, currency, masked = masked)))
    }

    fun planToggle(showAll: Boolean, total: Int, hidden: Int): String =
        if (showAll) tr("Mostra meno") else tr("Mostra tutte le {0} rate (altre {1})", mapOf("0" to total.toString(), "1" to hidden.toString()))

    fun rowBreakdown(row: DebtPlanRow, currency: String, masked: Boolean = false): String =
        "${tr("Capitale")} ${money(row.capital, currency, masked = masked)} ${tr("· interessi")} ${money(row.interest, currency, masked = masked)} " +
            "${tr("· residuo")} ${money(row.residual, currency, masked = masked)}"

    fun exitStep(step: DebtsInsights.ExitStep): String =
        "${tr("Chiuso a")} ${monthYear(step.endDate)}" + (if (step.monthsSaved > 0) tr(" invece di {0}", mapOf("0" to monthYear(step.baselineEndDate))) else "")

    fun extraSentence(sim: DebtExtraSimulation, extra: Double, currency: String, masked: Boolean = false): List<InvestmentsTextRun> {
        if (!sim.showsGain(extra)) {
            return listOf(InvestmentsTextRun(tr("Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi."), InvestmentsTextRun.Style.Muted))
        }
        return listOf(
            InvestmentsTextRun("${tr("Finisci")} "),
            InvestmentsTextRun("${duration(sim.monthsSaved)} ${tr("prima")}", InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun(" (${monthYear(sim.endDate)} ${tr("invece di")} ${monthYear(sim.baselineEndDate)}${tr(") e risparmi")} "),
            InvestmentsTextRun(money(sim.interestSaved, currency, 0, masked), InvestmentsTextRun.Style.Pos),
            InvestmentsTextRun(" ${tr("di interessi.")}"),
        )
    }

    /** DEBT-031 verdict and whether it is a saving. */
    fun refinanceVerdict(result: DebtRefinanceResult, currency: String, masked: Boolean = false): Pair<String, Boolean> {
        val saving = result.netSaving
        if (saving > 0) {
            val breakEven = result.breakEvenMonths?.let { ", " + tr("e le spese rientrano in {0} mesi", mapOf("0" to it.toString())) } ?: ""
            return tr("Conviene: risparmi {0} al netto delle spese{1}.", mapOf("0" to money(saving, currency, masked = masked), "1" to breakEven)) to true
        }
        return tr("Non conviene: spenderesti {0} in più tra interessi e spese.", mapOf("0" to money(Math.abs(saving), currency, masked = masked))) to false
    }

    /** DEBT-030 as a `SimulationResult` (#411): «Finisci prima di» + the duration + the dates and interest saved; null = hint. */
    fun extraResult(sim: DebtExtraSimulation, extra: Double, currency: String, masked: Boolean = false): SimulationText? {
        if (!sim.showsGain(extra)) return null
        return SimulationText(
            tr("Finisci prima di"), duration(sim.monthsSaved),
            tr("{0} invece di {1}, e risparmi {2} di interessi.", mapOf("0" to monthYear(sim.endDate), "1" to monthYear(sim.baselineEndDate),
                "2" to money(sim.interestSaved, currency, 0, masked))),
            positive = true,
        )
    }

    /** DEBT-031 as a `SimulationResult` (#411): the net saving (pos) or extra cost (neg) as the figure. */
    fun refinanceResult(result: DebtRefinanceResult, currency: String, masked: Boolean = false): SimulationText {
        val saving = result.netSaving
        if (saving > 0) {
            val caption = result.breakEvenMonths?.let { tr("Al netto delle spese, che rientrano in {0} mesi.", mapOf("0" to it.toString())) }
                ?: tr("Al netto delle spese.")
            return SimulationText(tr("Conviene: risparmi"), money(saving, currency, 0, masked), caption, positive = true)
        }
        return SimulationText(tr("Non conviene: spenderesti in più"), money(Math.abs(saving), currency, 0, masked), tr("Tra interessi e spese."), positive = false)
    }

    fun calculated(key: DebtLoanInputKey, value: Double, currency: String): List<InvestmentsTextRun> {
        val (label, formatted) = when (key) {
            DebtLoanInputKey.PRINCIPAL -> "il capitale" to money(value, currency)
            DebtLoanInputKey.INSTALLMENT -> "la rata" to money(value, currency)
            DebtLoanInputKey.INSTALLMENTS -> "il numero di rate" to value.toInt().toString()
            DebtLoanInputKey.ANNUAL_RATE -> "il tasso" to percent(value)
        }
        return listOf(
            InvestmentsTextRun("${tr("Abbiamo calcolato")} ${tr(label)}: "),
            InvestmentsTextRun(formatted, InvestmentsTextRun.Style.Strong),
            InvestmentsTextRun(tr(". Può differire di poco da quello della banca, per gli arrotondamenti.")),
        )
    }

    fun calculatedPlaceholder(key: DebtLoanInputKey, resolved: DebtResolvedAddForm?): String {
        if (resolved == null || resolved.calculated != key) return ""
        val value = when (key) {
            DebtLoanInputKey.PRINCIPAL -> resolved.inputs.principal
            DebtLoanInputKey.INSTALLMENT -> resolved.inputs.installment
            DebtLoanInputKey.INSTALLMENTS -> resolved.inputs.installments
            DebtLoanInputKey.ANNUAL_RATE -> resolved.inputs.annualRate
        }
        return AmountInputText.input(value, locale)
    }

    fun baseline(comparison: DebtEarlyRepaymentComparison, currency: String, masked: Boolean = false): String =
        "${tr("Senza estinzione: rata")} ${money(comparison.baselineInstallment, currency, masked = masked)}${tr(", fine")} " +
            "${BBFormat.formatMonthYear(comparison.baselineEndDate, locale)}${tr(", ancora")} ${money(comparison.baselineInterest, currency, masked = masked)} ${tr("di interessi.")}"

    fun monthsEarlier(months: Int): String = when {
        months <= 0 -> tr("stessa scadenza")
        months == 1 -> tr("1 mese prima")
        else -> tr("{0} mesi prima", mapOf("0" to months.toString()))
    }

    fun finish(date: CalendarDate, monthsSaved: Int): String = "${BBFormat.formatMonthYear(date, locale)} · ${monthsEarlier(monthsSaved)}"
}
