package io.buddybudget.core.domain.debts

import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate

// Port of the web's `lib/calc/amortization.ts` (domain/debts.md). Same names as the Swift `DebtCalc`.

/** Web `AmortizationError`; [message] is the Italian source string (a catalog key). */
class DebtAmortizationError(override val message: String) : Exception(message)

/** One row of an amortization schedule (`ScheduleRow`). */
data class DebtScheduleRow(
    val number: Int,
    val dueDate: CalendarDate,
    val installment: Double,
    val interest: Double,
    val capital: Double,
    /** Residual principal after this installment. */
    val residual: Double,
)

/** Input of `buildSegmentSchedule`. */
data class DebtSegmentScheduleInput(
    val firstDueDate: CalendarDate,
    val anchorDay: Int? = null,
    val principal: Double,
    val annualRate: Double,
    val installments: Int,
    val installment: Double? = null,
    val firstNumber: Int? = null,
)

/** The four loan figures of the add form (`LoanInputs`); `installments` is a Double as in the web. */
data class DebtLoanInputs(val principal: Double, val installment: Double, val installments: Double, val annualRate: Double)

/** `Partial<LoanInputs>`: null = missing. */
data class DebtPartialLoanInputs(
    val principal: Double? = null,
    val installment: Double? = null,
    val installments: Double? = null,
    val annualRate: Double? = null,
)

/** `LoanInputKey`. */
enum class DebtLoanInputKey(val key: String) { PRINCIPAL("principal"), INSTALLMENT("installment"), INSTALLMENTS("installments"), ANNUAL_RATE("annualRate") }

/** `ResolvedLoanInputs`. */
data class DebtResolvedLoanInputs(val inputs: DebtLoanInputs, val calculated: DebtLoanInputKey?)

/** `AprInput`. */
data class DebtAprInput(
    val principal: Double,
    val upfrontCosts: Double,
    val installment: Double,
    val recurringCosts: Double,
    val installments: Double,
)

/** Pure debt calculations ported 1:1 from the web (same function names as the Swift `DebtCalc`). */
object DebtCalc {
    const val MAX_SOLVER_ANNUAL_RATE = 100.0
    private const val SOLVER_TOLERANCE = 1e-12
    private const val SOLVER_MAX_ITERATIONS = 200
    private const val LAST_INSTALLMENT_TOLERANCE = 0.01
    private const val MAX_SOLVER_INSTALLMENTS = 1200
    const val MAX_PAYOFF_MONTHS = 600
    const val PLAN_VISIBLE_PAST = 2
    const val PLAN_VISIBLE_FUTURE = 8

    /** `Math.round((x + Number.EPSILON) * 100) / 100`. */
    fun round2(value: Double): Double = JSNumber.round2Epsilon(value)

    private fun monthlyRate(annualRate: Double) = annualRate / 1200

    private fun pmtExact(principal: Double, annualRate: Double, installments: Double): Double {
        val i = monthlyRate(annualRate)
        if (i == 0.0) return principal / installments
        return (principal * i) / (1 - StrictMath.pow(1 + i, -installments))
    }

    /** Constant installment rounded to the cent; with rate 0 it is principal / installments. */
    fun installmentAmount(principal: Double, annualRate: Double, installments: Double): Double {
        if (!(principal > 0) || !(installments > 0)) throw DebtAmortizationError("Capitale e numero di rate devono essere positivi")
        return round2(pmtExact(principal, annualRate, installments))
    }

    /** Schedule of one segment; the last installment closes the residual to zero. */
    fun buildSegmentSchedule(input: DebtSegmentScheduleInput): List<DebtScheduleRow> {
        val installments = input.installments
        if (installments < 1) throw DebtAmortizationError("Il numero di rate deve essere un intero positivo")
        if (!(input.principal > 0)) throw DebtAmortizationError("Il capitale deve essere positivo")
        val anchorDay = input.anchorDay ?: input.firstDueDate.day
        val firstNumber = input.firstNumber ?: 1
        val installment = input.installment ?: installmentAmount(input.principal, input.annualRate, installments.toDouble())
        val rows = ArrayList<DebtScheduleRow>(installments)
        var residual = round2(input.principal)
        for (k in 0 until installments) {
            val interest = round2((residual * input.annualRate) / 1200)
            val isLast = k == installments - 1
            val capital = if (isLast) residual else round2(Math.min(installment - interest, residual))
            val paid = if (isLast) round2(residual + interest) else installment
            residual = round2(residual - capital)
            rows.add(DebtScheduleRow(firstNumber + k, input.firstDueDate.plusMonthsClamped(k, anchorDay), paid, interest, capital, residual))
        }
        return rows
    }

    private fun bisect(f: (Double) -> Double, lo0: Double, hi0: Double): Double? {
        var lo = lo0
        var hi = hi0
        if (f(lo) > 0 || f(hi) < 0) return null
        var i = 0
        while (i < SOLVER_MAX_ITERATIONS && hi - lo > SOLVER_TOLERANCE) {
            val mid = (lo + hi) / 2
            if (f(mid) < 0) lo = mid else hi = mid
            i++
        }
        return (lo + hi) / 2
    }

    /** Annual rate (%) that closes the loan given principal, installment and number of installments. */
    fun solveAnnualRate(principal: Double, installment: Double, installments: Double): Double {
        if (!(principal > 0) || !(installment > 0) || !(installments > 0)) {
            throw DebtAmortizationError("Capitale, rata e numero di rate devono essere positivi")
        }
        if (installment * installments < principal - 0.005) {
            throw DebtAmortizationError("La rata per il numero di rate non copre nemmeno il capitale: controlla i dati")
        }
        return bisect({ r -> pmtExact(principal, r, installments) - installment }, 0.0, MAX_SOLVER_ANNUAL_RATE)
            ?: throw DebtAmortizationError("Nessun tasso compatibile con questi dati")
    }

    /** Number of installments that closes the loan (cent-rounded simulation, 1% margin on the last one). */
    fun solveInstallments(principal: Double, annualRate: Double, installment: Double): Int {
        if (!(principal > 0) || !(installment > 0)) throw DebtAmortizationError("Capitale e rata devono essere positivi")
        if (annualRate > 0 && installment <= (principal * annualRate) / 1200) {
            throw DebtAmortizationError("La rata non supera gli interessi del primo mese: il debito non si ridurrebbe mai")
        }
        var residual = round2(principal)
        for (n in 1..MAX_SOLVER_INSTALLMENTS) {
            val interest = round2((residual * annualRate) / 1200)
            if (residual + interest <= installment * (1 + LAST_INSTALLMENT_TOLERANCE)) return n
            residual = round2(residual + interest - installment)
        }
        throw DebtAmortizationError("Con questi dati il debito non si chiude in un tempo ragionevole")
    }

    /** Principal compatible with installment, rate and number of installments. */
    fun solvePrincipal(annualRate: Double, installment: Double, installments: Double): Double {
        if (!(installment > 0) || !(installments > 0)) throw DebtAmortizationError("Rata e numero di rate devono essere positivi")
        val i = monthlyRate(annualRate)
        if (i == 0.0) return round2(installment * installments)
        return round2((installment * (1 - StrictMath.pow(1 + i, -installments))) / i)
    }

    /** TAEG: effective annual rate (%) of the real cash flows, costs included. */
    fun computeApr(input: DebtAprInput): Double {
        val payment = input.installment + input.recurringCosts
        val net = input.principal - input.upfrontCosts
        val n = input.installments
        if (!(net > 0) || !(payment > 0) || !(n > 0)) throw DebtAmortizationError("Dati non validi per il calcolo del TAEG")
        if (payment * n < net) throw DebtAmortizationError("I pagamenti totali sono inferiori al netto ricevuto: controlla i dati")
        val presentValue = { i: Double -> if (i == 0.0) payment * n else (payment * (1 - StrictMath.pow(1 + i, -n))) / i }
        val monthly = bisect({ i -> net - presentValue(i) }, 0.0, 1.0) ?: throw DebtAmortizationError("Nessun TAEG compatibile con questi dati")
        return (StrictMath.pow(1 + monthly, 12.0) - 1) * 100
    }

    /** With exactly one figure missing, computes it from the other three; all four → unchanged. */
    fun resolveMissingLoanInput(partial: DebtPartialLoanInputs): DebtResolvedLoanInputs {
        fun missing(v: Double?) = v == null || v.isNaN()
        val keys = buildList {
            if (missing(partial.principal)) add(DebtLoanInputKey.PRINCIPAL)
            if (missing(partial.installment)) add(DebtLoanInputKey.INSTALLMENT)
            if (missing(partial.installments)) add(DebtLoanInputKey.INSTALLMENTS)
            if (missing(partial.annualRate)) add(DebtLoanInputKey.ANNUAL_RATE)
        }
        if (keys.size > 1) throw DebtAmortizationError("Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso")
        val p = DebtLoanInputs(
            partial.principal ?: Double.NaN, partial.installment ?: Double.NaN,
            partial.installments ?: Double.NaN, partial.annualRate ?: Double.NaN,
        )
        val key = keys.firstOrNull() ?: return DebtResolvedLoanInputs(p, null)
        val resolved = when (key) {
            DebtLoanInputKey.ANNUAL_RATE -> p.copy(annualRate = solveAnnualRate(p.principal, p.installment, p.installments))
            DebtLoanInputKey.INSTALLMENT -> p.copy(installment = installmentAmount(p.principal, p.annualRate, p.installments))
            DebtLoanInputKey.INSTALLMENTS -> p.copy(installments = solveInstallments(p.principal, p.annualRate, p.installment).toDouble())
            DebtLoanInputKey.PRINCIPAL -> p.copy(principal = solvePrincipal(p.annualRate, p.installment, p.installments))
        }
        return DebtResolvedLoanInputs(resolved, key)
    }

    /** Whole calendar months between two dates (days ignored). */
    internal fun monthsBetween(from: CalendarDate, to: CalendarDate): Int = (to.year - from.year) * 12 + (to.month - from.month)

    /** JS stable sort with a numeric comparator (negative = a first). Kotlin's sortedWith is stable. */
    private fun <T> stableSorted(items: List<T>, compare: (T, T) -> Double): List<T> =
        items.sortedWith { a, b -> compare(a, b).let { if (it < 0) -1 else if (it > 0) 1 else 0 } }

    // region Plan (lib/calc/debt-plan.ts)

    private class TheoreticalPlan(val rows: List<DebtScheduleRow>, val closedOn: CalendarDate?, val repayments: List<DebtAppliedEarlyRepayment>)

    private fun buildTheoreticalRows(terms: DebtTerms, anchors: List<DebtPlanEvent>, warnings: MutableList<String>): TheoreticalPlan {
        val anchorDay = terms.firstInstallmentDate.day
        var rows = buildSegmentSchedule(
            DebtSegmentScheduleInput(
                firstDueDate = terms.firstInstallmentDate, principal = terms.principal, annualRate = terms.annualRate,
                installments = terms.installments, installment = terms.installment,
            ),
        )
        var currentRate = terms.annualRate
        var closedOn: CalendarDate? = null
        val repayments = mutableListOf<DebtAppliedEarlyRepayment>()
        for (event in anchors) {
            val date = event.date
            val frozen = rows.filter { it.dueDate <= date }
            val remaining = rows.size - frozen.size
            if (remaining == 0) {
                warnings.add("Evento del ${date.iso} oltre l'ultima rata: ignorato")
                continue
            }
            val residualBefore = if (frozen.isNotEmpty()) frozen[frozen.size - 1].residual else terms.principal
            if (event is DebtPlanEvent.RateChange) currentRate = event.rate
            if (event is DebtPlanEvent.EarlyRepayment) {
                val principal = round2(residualBefore - event.amount)
                if (principal <= 0) {
                    repayments.add(DebtAppliedEarlyRepayment(date, round2(residualBefore), event.penalty, event.effect, 0.0))
                    closedOn = date
                    rows = frozen
                    break
                }
                val current = rows[frozen.size].installment
                var installments = remaining
                var installment: Double? = null
                if (event.effect == DebtEarlyRepaymentEffect.REDUCE_DURATION) {
                    installment = current
                    try {
                        installments = Math.min(remaining, solveInstallments(principal, currentRate, current))
                    } catch (e: DebtAmortizationError) {
                        installment = null
                    }
                }
                val tail = buildSegmentSchedule(
                    DebtSegmentScheduleInput(
                        firstDueDate = rows[frozen.size].dueDate, anchorDay = anchorDay, principal = principal, annualRate = currentRate,
                        installments = installments, installment = installment, firstNumber = frozen.size + 1,
                    ),
                )
                rows = frozen + tail
                repayments.add(DebtAppliedEarlyRepayment(date, event.amount, event.penalty, event.effect, principal))
                continue
            }
            val principal = if (event is DebtPlanEvent.BalanceCorrection) event.amount else residualBefore
            if (!(principal > 0)) {
                warnings.add("Correzione del ${date.iso} con residuo non positivo: ignorata")
                continue
            }
            val tail = buildSegmentSchedule(
                DebtSegmentScheduleInput(
                    firstDueDate = rows[frozen.size].dueDate, anchorDay = anchorDay, principal = principal, annualRate = currentRate,
                    installments = remaining, firstNumber = frozen.size + 1,
                ),
            )
            rows = frozen + tail
        }
        return TheoreticalPlan(rows, closedOn, repayments)
    }

    /** Builds the loan plan at [today] (UTC date) from terms and events. */
    fun buildLoanPlan(terms: DebtTerms, events: List<DebtPlanEvent>, today: CalendarDate): DebtLoanPlan {
        val warnings = mutableListOf<String>()
        val anchors = stableSorted(events.filter { it !is DebtPlanEvent.Payment }) { a, b -> a.date.compareTo(b.date).toDouble() }
        val theoretical = buildTheoreticalRows(terms, anchors, warnings)

        val payments = LinkedHashMap<Int, DebtPlanEvent.Payment>()
        for (event in events) {
            if (event !is DebtPlanEvent.Payment) continue
            if (theoretical.rows.none { it.number == event.installmentNumber }) {
                warnings.add("Pagamento della rata ${event.installmentNumber}, che non esiste: ignorato")
            } else if (payments.containsKey(event.installmentNumber)) {
                warnings.add("Rata ${event.installmentNumber} già pagata: secondo pagamento ignorato")
            } else {
                payments[event.installmentNumber] = event
            }
        }

        val rows = theoretical.rows.map { row ->
            val payment = payments[row.number]
            val status = when {
                payment != null -> DebtInstallmentStatus.PAGATA
                row.dueDate >= today -> DebtInstallmentStatus.DA_PAGARE
                else -> if (terms.startMode == DebtStartMode.ORIGINE) DebtInstallmentStatus.DA_CONFERMARE else DebtInstallmentStatus.SCADUTA
            }
            DebtLoanPlanRow(
                row.number, row.dueDate, row.installment, row.interest, row.capital, row.residual, status,
                payment?.let { DebtRowPayment(it.date, it.amount, it.transactionId) },
            )
        }

        val past = rows.filter { it.dueDate <= today }
        val future = rows.filter { it.dueDate > today }
        val closedOn = theoretical.closedOn
        val repayments = theoretical.repayments
        val closed = closedOn != null && closedOn <= today
        val lastPast = past.lastOrNull()
        val lastRepayment = repayments.filter { it.date <= today }.lastOrNull()
        val settledResidual = when {
            closed -> 0.0
            lastRepayment != null && (lastPast == null || lastRepayment.date >= lastPast.dueDate) -> lastRepayment.residualAfter
            else -> lastPast?.residual ?: terms.principal
        }
        val nextUnsettled = rows.firstOrNull { it.status == DebtInstallmentStatus.DA_PAGARE || it.status == DebtInstallmentStatus.SCADUTA }
        fun sum(list: List<DebtLoanPlanRow>, pick: (DebtLoanPlanRow) -> Double) = round2(list.fold(0.0) { s, r -> s + pick(r) })

        val anchorDay = terms.firstInstallmentDate.day
        val startDate = if (rows.isNotEmpty()) rows[0].dueDate.plusMonthsClamped(-1, anchorDay) else closedOn!!
        val series = listOf(DebtResidualPoint(startDate, round2(terms.principal))) +
            rows.map { DebtResidualPoint(it.dueDate, it.residual) } +
            repayments.map { DebtResidualPoint(it.date, it.residualAfter) }
        val residualSeries = stableSorted(series) { x, y -> x.date.compareTo(y.date).toDouble() }

        val totals = DebtLoanPlanTotals(
            residual = settledResidual,
            currentInstallment = future.firstOrNull()?.installment ?: 0.0,
            interestToDate = sum(past) { it.interest },
            interestRemaining = sum(future) { it.interest },
            paidTotal = round2(payments.values.fold(0.0) { s, p -> s + p.amount }),
            remainingInstallments = future.size,
            endDate = closedOn ?: rows[rows.size - 1].dueDate,
            nextDueDate = nextUnsettled?.dueDate,
            overdueCount = rows.count { it.status == DebtInstallmentStatus.SCADUTA },
            unconfirmedCount = rows.count { it.status == DebtInstallmentStatus.DA_CONFERMARE },
            finished = future.isEmpty(),
            penaltiesPaid = round2(repayments.filter { it.date <= today }.fold(0.0) { s, r -> s + r.penalty }),
            closedOn = closedOn,
        )
        return DebtLoanPlan(rows, totals, residualSeries, repayments, warnings)
    }

    /** `visibleRowRange`: rows shown by default (last 2 past, first 8 future). */
    fun visibleRowRange(rows: List<DebtLoanPlanRow>, today: CalendarDate): DebtRowRange {
        val firstFuture = rows.indexOfFirst { it.dueDate >= today }
        val pivot = if (firstFuture == -1) rows.size else firstFuture
        return DebtRowRange(Math.max(0, pivot - PLAN_VISIBLE_PAST), Math.min(rows.size, pivot + PLAN_VISIBLE_FUTURE))
    }

    // endregion

    // region Early repayment (lib/calc/early-repayment.ts)

    private fun interestAfter(plan: DebtLoanPlan, date: CalendarDate): Double =
        round2(plan.rows.filter { it.dueDate > date }.fold(0.0) { s, r -> s + r.interest })

    private fun outcome(
        terms: DebtTerms,
        events: List<DebtPlanEvent>,
        today: CalendarDate,
        input: DebtEarlyRepaymentInput,
        effect: DebtEarlyRepaymentEffect,
        baseline: DebtLoanPlan,
        baselineInterest: Double,
    ): DebtEarlyRepaymentOutcome {
        val plan = buildLoanPlan(terms, events + DebtPlanEvent.EarlyRepayment(input.date, input.amount, input.penalty, effect), today)
        val after = interestAfter(plan, input.date)
        val next = plan.rows.firstOrNull { it.dueDate > input.date }
        return DebtEarlyRepaymentOutcome(
            effect = effect,
            nextInstallment = next?.installment ?: 0.0,
            endDate = plan.totals.endDate,
            remainingInstallments = plan.rows.count { it.dueDate > input.date },
            interestAfter = after,
            interestSaved = round2(baselineInterest - after),
            netBenefit = round2(baselineInterest - after - input.penalty),
            monthsSaved = Math.max(0, monthsBetween(plan.totals.endDate, baseline.totals.endDate)),
            closesDebt = plan.totals.closedOn != null,
            plan = plan,
        )
    }

    /** The two alternatives of an early repayment side by side. */
    fun compareEarlyRepayment(terms: DebtTerms, events: List<DebtPlanEvent>, today: CalendarDate, input: DebtEarlyRepaymentInput): DebtEarlyRepaymentComparison {
        val baseline = buildLoanPlan(terms, events, today)
        val baselineInterest = interestAfter(baseline, input.date)
        val next = baseline.rows.firstOrNull { it.dueDate > input.date }
        return DebtEarlyRepaymentComparison(
            baselineInterest = baselineInterest,
            baselineEndDate = baseline.totals.endDate,
            baselineInstallment = next?.installment ?: 0.0,
            reduceInstallment = outcome(terms, events, today, input, DebtEarlyRepaymentEffect.REDUCE_INSTALLMENT, baseline, baselineInterest),
            reduceDuration = outcome(terms, events, today, input, DebtEarlyRepaymentEffect.REDUCE_DURATION, baseline, baselineInterest),
        )
    }

    /** "If I paid an extra every month": reduce-duration repayment at every future due date (simulation only). */
    fun simulateRecurringExtra(terms: DebtTerms, events: List<DebtPlanEvent>, today: CalendarDate, monthlyExtra: Double): DebtRecurringExtraResult {
        val baseline = buildLoanPlan(terms, events, today)
        val extras = baseline.rows.filter { it.dueDate > today }
            .map { DebtPlanEvent.EarlyRepayment(it.dueDate, monthlyExtra, 0.0, DebtEarlyRepaymentEffect.REDUCE_DURATION) }
        val plan = buildLoanPlan(terms, events + extras, today)
        fun future(p: DebtLoanPlan) = round2(p.rows.filter { it.dueDate > today }.fold(0.0) { s, r -> s + r.interest })
        val extraPaid = round2(plan.earlyRepayments.fold(0.0) { s, r -> s + r.amount })
        return DebtRecurringExtraResult(
            interestWith = future(plan),
            interestWithout = future(baseline),
            interestSaved = round2(future(baseline) - future(plan)),
            extraPaid = extraPaid,
            endDate = plan.totals.endDate,
            baselineEndDate = baseline.totals.endDate,
            monthsSaved = Math.max(0, monthsBetween(plan.totals.endDate, baseline.totals.endDate)),
        )
    }

    // endregion

    // region Simulator (lib/calc/debt-simulator.ts)

    /** Compares what is left to pay today with a new offer on the same residual (surroga). */
    fun compareRefinance(current: DebtRefinanceCurrent, today: CalendarDate, offer: DebtRefinanceOffer): DebtRefinanceResult {
        val newInstallment = installmentAmount(current.residual, offer.annualRate, offer.installments.toDouble())
        val newInterest = round2(newInstallment * offer.installments - current.residual)
        val switchCosts = round2(offer.upfrontCosts + offer.penalty)
        val monthlySaving = current.currentInstallment - newInstallment
        return DebtRefinanceResult(
            residual = current.residual,
            currentInstallment = current.currentInstallment,
            currentInterestRemaining = current.interestRemaining,
            currentEndDate = current.endDate,
            newInstallment = newInstallment,
            newInterest = newInterest,
            newEndDate = today.plusMonthsClamped(offer.installments),
            switchCosts = switchCosts,
            netSaving = round2(current.interestRemaining - newInterest - switchCosts),
            breakEvenMonths = if (switchCosts > 0 && monthlySaving > 0) Math.ceil(switchCosts / monthlySaving).toInt() else null,
        )
    }

    private class PayoffState(val loan: DebtPayoffLoan, var balance: Double)

    /** Whole-month payoff estimate with avalanche / snowball rollover. */
    fun simulatePayoff(loans: List<DebtPayoffLoan>, monthlyExtra: Double, strategy: DebtPayoffStrategy, today: CalendarDate): DebtPayoffResult {
        val state = loans.filter { it.residual > 0 }.map { PayoffState(it, it.residual) }
        val closeOrder = mutableListOf<String>()
        val closings = mutableListOf<DebtPayoffClosing>()
        var totalInterest = 0.0
        var freed = 0.0
        var months = 0
        val rollover = strategy != DebtPayoffStrategy.NONE

        while (state.any { it.balance > 0.005 } && months < MAX_PAYOFF_MONTHS) {
            months += 1
            for (loan in state) {
                if (loan.balance <= 0.005) continue
                val interest = (loan.balance * loan.loan.annualRate) / 1200
                totalInterest += interest
                loan.balance += interest - Math.min(loan.loan.installment, loan.balance + interest)
            }
            var pool = if (rollover) monthlyExtra + freed else 0.0
            val order = stableSorted(state.filter { it.balance > 0.005 }) { a, b ->
                if (strategy == DebtPayoffStrategy.SNOWBALL) a.balance - b.balance else b.loan.annualRate - a.loan.annualRate
            }
            for (loan in order) {
                if (pool <= 0) break
                val pay = Math.min(pool, loan.balance)
                loan.balance -= pay
                pool -= pay
            }
            for (loan in state) {
                if (loan.balance <= 0.005 && loan.loan.name !in closeOrder) {
                    closeOrder.add(loan.loan.name)
                    closings.add(DebtPayoffClosing(loan.loan.id, loan.loan.name, months, today.plusMonthsClamped(months)))
                    loan.balance = 0.0
                    freed += loan.loan.installment
                }
            }
        }
        return DebtPayoffResult(strategy, months, round2(totalInterest), today.plusMonthsClamped(months), closeOrder, closings)
    }

    /** The three simulations side by side: no extra, avalanche and snowball. */
    fun comparePayoffStrategies(loans: List<DebtPayoffLoan>, monthlyExtra: Double, today: CalendarDate): DebtPayoffComparison =
        DebtPayoffComparison(
            none = simulatePayoff(loans, 0.0, DebtPayoffStrategy.NONE, today),
            avalanche = simulatePayoff(loans, monthlyExtra, DebtPayoffStrategy.AVALANCHE, today),
            snowball = simulatePayoff(loans, monthlyExtra, DebtPayoffStrategy.SNOWBALL, today),
        )

    // endregion

    // region Forms (lib/debts/add-form.ts, early-repayment-form.ts)

    private const val MIN_FILLED_FIELDS = 3
    private val isoDateText = Regex("^\\d{4}-\\d{2}-\\d{2}$")

    /** `emptyAddDebtForm`. */
    fun emptyAddDebtForm(startMode: DebtStartMode) = DebtAddFormState(startMode = startMode)

    /** Italian-style number; empty or invalid → null. Same as `BBFormat.parseAmount`. */
    fun parseAmount(text: String): Double? = BBFormat.parseAmount(text)

    /** Resolves the four loan figures: < 3 → `Failure(null)`; 3 → computes the fourth; 4 → as typed. */
    fun resolveAddForm(state: DebtAddFormState): DebtAddFormResolution {
        val partial = DebtPartialLoanInputs(
            parseAmount(state.principal), parseAmount(state.installment), parseAmount(state.installments), parseAmount(state.annualRate),
        )
        val filled = listOf(partial.principal, partial.installment, partial.installments, partial.annualRate).count { it != null }
        if (filled < MIN_FILLED_FIELDS) return DebtAddFormResolution.Failure(null)
        val n = partial.installments
        if (n != null && Math.floor(n) != n) return DebtAddFormResolution.Failure("Il numero di rate deve essere intero")
        return try {
            val resolved = resolveMissingLoanInput(partial)
            DebtAddFormResolution.Ok(DebtResolvedAddForm(resolved.inputs, resolved.calculated, computeFormApr(state, resolved.inputs)))
        } catch (e: DebtAmortizationError) {
            DebtAddFormResolution.Failure(e.message)
        }
    }

    private fun sumCosts(costs: List<DebtAddCostField>, kind: DebtCostKind): Double =
        round2(costs.filter { it.kind == kind }.fold(0.0) { s, c -> s + (parseAmount(c.amount) ?: 0.0) })

    private fun computeFormApr(state: DebtAddFormState, inputs: DebtLoanInputs): Double? {
        if (state.startMode == DebtStartMode.FOTOGRAFIA) return null
        return try {
            computeApr(DebtAprInput(inputs.principal, sumCosts(state.costs, DebtCostKind.UNA_TANTUM), inputs.installment, sumCosts(state.costs, DebtCostKind.PER_RATA), inputs.installments))
        } catch (e: DebtAmortizationError) {
            null
        }
    }

    /** Input for `POST /api/debts`; the installment is declared only if the user typed it. [today] is the UTC date. */
    fun buildCreateDebtInput(state: DebtAddFormState, resolved: DebtResolvedAddForm, today: String): DebtCreateInput {
        val inputs = resolved.inputs
        return DebtCreateInput(
            name = JSNumber.trim(state.name),
            startMode = state.startMode,
            principal = round2(inputs.principal),
            annualRate = JSNumber.round(inputs.annualRate * 10000) / 10000,
            installments = inputs.installments.toInt(),
            firstInstallmentDate = state.firstInstallmentDate,
            installment = if (resolved.calculated == DebtLoanInputKey.INSTALLMENT) null else round2(inputs.installment),
            anchorDate = if (state.startMode == DebtStartMode.FOTOGRAFIA) today else null,
            costs = state.costs
                .filter { JSNumber.trim(it.label) != "" && parseAmount(it.amount) != null }
                .map { DebtCreateCost(JSNumber.trim(it.label), parseAmount(it.amount)!!, it.kind) },
        )
    }

    /** Checks independent of the calculation (name, date): first message or null. */
    fun validateAddFormBasics(state: DebtAddFormState): String? {
        if (JSNumber.trim(state.name) == "") return "Dai un nome al debito"
        if (!isoDateText.matches(state.firstInstallmentDate)) return "Indica la data della prima rata"
        return null
    }

    /** Plan preview (installment, total interest, last due date); null without a valid date. */
    fun previewAddForm(state: DebtAddFormState, resolved: DebtResolvedAddForm): DebtAddFormPreview? {
        if (!isoDateText.matches(state.firstInstallmentDate)) return null
        val first = CalendarDate.parse(state.firstInstallmentDate) ?: return null
        val inputs = resolved.inputs
        val rows = buildSegmentSchedule(
            DebtSegmentScheduleInput(
                firstDueDate = first, principal = inputs.principal, annualRate = inputs.annualRate, installments = inputs.installments.toInt(),
                installment = if (resolved.calculated == DebtLoanInputKey.INSTALLMENT) null else inputs.installment,
            ),
        )
        return DebtAddFormPreview(rows[0].installment, round2(rows.fold(0.0) { s, r -> s + r.interest }), rows[rows.size - 1].dueDate)
    }

    /** Penalty in euro: fixed amount or percentage of the repaid sum; empty → 0; invalid or negative → null. */
    fun resolvePenalty(amount: Double, text: String, unit: DebtPenaltyUnit): Double? {
        if (JSNumber.trim(text) == "") return 0.0
        val value = parseAmount(text) ?: return null
        if (value < 0) return null
        return if (unit == DebtPenaltyUnit.PERCENT) round2((amount * value) / 100) else round2(value)
    }

    /** `previewEarlyRepayment`: the web takes a `DebtView`; here its plan terms/events (`toPlanTerms`/`toPlanEvent`) and plan. */
    fun previewEarlyRepayment(
        terms: DebtTerms,
        events: List<DebtPlanEvent>,
        plan: DebtLoanPlan,
        today: CalendarDate,
        values: DebtEarlyRepaymentFormValues,
    ): DebtEarlyRepaymentPreview {
        val amount = parseAmount(values.amount)
        if (JSNumber.trim(values.amount) == "") return DebtEarlyRepaymentPreview.Empty
        if (amount == null || amount <= 0) return DebtEarlyRepaymentPreview.Error("Inserisci un importo valido")
        if (values.mode == DebtEarlyRepaymentMode.MONTHLY) {
            if (plan.totals.finished) return DebtEarlyRepaymentPreview.Error("Il debito è già concluso")
            return DebtEarlyRepaymentPreview.Monthly(amount, simulateRecurringExtra(terms, events, today, amount))
        }
        if (values.date.isEmpty()) return DebtEarlyRepaymentPreview.Error("Indica la data")
        // The web compares ISO strings; an unparsable date has no row after it.
        val date = CalendarDate.parse(values.date)
        if (date == null || plan.rows.none { it.dueDate > date }) return DebtEarlyRepaymentPreview.Error("La data è dopo l'ultima rata del piano")
        val penalty = resolvePenalty(amount, values.penalty, values.penaltyUnit) ?: return DebtEarlyRepaymentPreview.Error("La penale non è valida")
        return DebtEarlyRepaymentPreview.Once(amount, penalty, date, compareEarlyRepayment(terms, events, today, DebtEarlyRepaymentInput(date, amount, penalty)))
    }

    // endregion
}
