package io.buddybudget.core.domain

import io.buddybudget.core.domain.debts.DebtAddCostField
import io.buddybudget.core.domain.debts.DebtAddFormResolution
import io.buddybudget.core.domain.debts.DebtAddFormState
import io.buddybudget.core.domain.debts.DebtAmortizationError
import io.buddybudget.core.domain.debts.DebtAprInput
import io.buddybudget.core.domain.debts.DebtCalc
import io.buddybudget.core.domain.debts.DebtCostKind
import io.buddybudget.core.domain.debts.DebtCreateInput
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentEffect
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentInput
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentOutcome
import io.buddybudget.core.domain.debts.DebtLoanInputs
import io.buddybudget.core.domain.debts.DebtLoanPlan
import io.buddybudget.core.domain.debts.DebtPartialLoanInputs
import io.buddybudget.core.domain.debts.DebtPayoffLoan
import io.buddybudget.core.domain.debts.DebtPayoffResult
import io.buddybudget.core.domain.debts.DebtPayoffStrategy
import io.buddybudget.core.domain.debts.DebtPenaltyUnit
import io.buddybudget.core.domain.debts.DebtPlanEvent
import io.buddybudget.core.domain.debts.DebtRefinanceCurrent
import io.buddybudget.core.domain.debts.DebtRefinanceOffer
import io.buddybudget.core.domain.debts.DebtScheduleRow
import io.buddybudget.core.domain.debts.DebtSegmentScheduleInput
import io.buddybudget.core.domain.debts.DebtStartMode
import io.buddybudget.core.domain.debts.DebtTerms
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

/** Adapters for the debts domain ports (DebtCalc). Errors serialize as {"error": "AmortizationError", "message": key}. Mirrors the Swift file. */
internal object DebtsVectorAdapters {
    private fun iso(d: CalendarDate) = s(d.iso)
    private fun optIso(d: CalendarDate?): JsonElement = d?.let { iso(it) } ?: JsonNull
    private fun optInt(e: JsonElement): Int? = e.optNum?.toInt()

    private fun amortizationError(body: () -> JsonElement): JsonElement = try {
        body()
    } catch (e: DebtAmortizationError) {
        obj("error" to s("AmortizationError"), "message" to s(e.message))
    }

    private fun row(r: DebtScheduleRow) = obj(
        "number" to n(r.number), "dueDate" to iso(r.dueDate), "installment" to n(r.installment), "interest" to n(r.interest),
        "capital" to n(r.capital), "residual" to n(r.residual),
    )

    private fun segmentInput(x: JsonElement) = DebtSegmentScheduleInput(
        firstDueDate = x["firstDueDate"].date, anchorDay = optInt(x["anchorDay"]), principal = x["principal"].num,
        annualRate = x["annualRate"].num, installments = x["installments"].int, installment = x["installment"].optNum,
        firstNumber = optInt(x["firstNumber"]),
    )

    private fun terms(x: JsonElement) = DebtTerms(
        startMode = DebtStartMode.fromKey(x["startMode"].str) ?: error("startMode"), principal = x["principal"].num,
        annualRate = x["annualRate"].num, installments = x["installments"].int, firstInstallmentDate = x["firstInstallmentDate"].date,
        installment = x["installment"].optNum,
    )

    private fun events(x: JsonElement): List<DebtPlanEvent> = x.list.map { e ->
        val date = e["date"].date
        when (e["type"].str) {
            "payment" -> DebtPlanEvent.Payment(e["installmentNumber"].int, date, e["amount"].num, e["transactionId"].optStr)
            "balance_correction" -> DebtPlanEvent.BalanceCorrection(date, e["amount"].num)
            "rate_change" -> DebtPlanEvent.RateChange(date, e["rate"].num)
            "early_repayment" -> DebtPlanEvent.EarlyRepayment(
                date, e["amount"].num, e["penalty"].num, DebtEarlyRepaymentEffect.fromKey(e["effect"].str) ?: error("effect"),
            )
            else -> error("event type ${e["type"]}")
        }
    }

    private fun plan(p: DebtLoanPlan): JsonElement {
        val t = p.totals
        return obj(
            "rows" to arr(
                p.rows.map { r ->
                    obj(
                        "n" to n(r.number), "d" to iso(r.dueDate), "i" to n(r.installment), "int" to n(r.interest), "c" to n(r.capital),
                        "res" to n(r.residual), "s" to s(r.status.key), "paid" to (r.payment?.let { n(it.amount) } ?: JsonNull),
                    )
                },
            ),
            "totals" to obj(
                "residual" to n(t.residual), "currentInstallment" to n(t.currentInstallment), "interestToDate" to n(t.interestToDate),
                "interestRemaining" to n(t.interestRemaining), "paidTotal" to n(t.paidTotal), "remainingInstallments" to n(t.remainingInstallments),
                "endDate" to iso(t.endDate), "nextDueDate" to optIso(t.nextDueDate), "overdueCount" to n(t.overdueCount),
                "unconfirmedCount" to n(t.unconfirmedCount), "finished" to b(t.finished), "penaltiesPaid" to n(t.penaltiesPaid),
                "closedOn" to optIso(t.closedOn),
            ),
            "residualSeries" to arr(p.residualSeries.map { obj("date" to iso(it.date), "residual" to n(it.residual)) }),
            "earlyRepayments" to arr(
                p.earlyRepayments.map {
                    obj(
                        "date" to iso(it.date), "amount" to n(it.amount), "penalty" to n(it.penalty), "effect" to s(it.effect.key),
                        "residualAfter" to n(it.residualAfter),
                    )
                },
            ),
            "warnings" to arr(p.warnings.map { s(it) }),
        )
    }

    /** `plan` is omitted from the vectors (re-derivable via buildLoanPlan). */
    private fun outcome(o: DebtEarlyRepaymentOutcome) = obj(
        "effect" to s(o.effect.key), "nextInstallment" to n(o.nextInstallment), "endDate" to iso(o.endDate),
        "remainingInstallments" to n(o.remainingInstallments), "interestAfter" to n(o.interestAfter), "interestSaved" to n(o.interestSaved),
        "netBenefit" to n(o.netBenefit), "monthsSaved" to n(o.monthsSaved), "closesDebt" to b(o.closesDebt),
    )

    private fun payoffLoans(x: JsonElement) = x.list.map {
        DebtPayoffLoan(it["id"].str, it["name"].str, it["residual"].num, it["annualRate"].num, it["installment"].num)
    }

    private fun payoff(r: DebtPayoffResult) = obj(
        "strategy" to s(r.strategy.key), "months" to n(r.months), "totalInterest" to n(r.totalInterest), "endDate" to iso(r.endDate),
        "closeOrder" to arr(r.closeOrder.map { s(it) }),
        "closings" to arr(r.closings.map { obj("id" to s(it.id), "name" to s(it.name), "months" to n(it.months), "endDate" to iso(it.endDate)) }),
    )

    private fun addFormState(x: JsonElement) = DebtAddFormState(
        name = x["name"].str, startMode = DebtStartMode.fromKey(x["startMode"].str) ?: error("startMode"), principal = x["principal"].str,
        installment = x["installment"].str, installments = x["installments"].str, annualRate = x["annualRate"].str,
        firstInstallmentDate = x["firstInstallmentDate"].str,
        costs = x["costs"].list.map { DebtAddCostField(it["label"].str, it["amount"].str, DebtCostKind.fromKey(it["kind"].str) ?: error("kind")) },
    )

    private fun loanInputs(l: DebtLoanInputs) = mapOf(
        "principal" to n(l.principal), "installment" to n(l.installment), "installments" to n(l.installments), "annualRate" to n(l.annualRate),
    )

    private fun resolution(r: DebtAddFormResolution): JsonElement = when (r) {
        is DebtAddFormResolution.Failure -> obj("ok" to b(false), "message" to (r.message?.let { s(it) } ?: JsonNull))
        is DebtAddFormResolution.Ok -> {
            val value = mutableMapOf<String, JsonElement>("inputs" to JsonObject(loanInputs(r.value.inputs)), "apr" to (r.value.apr?.let { n(it) } ?: JsonNull))
            r.value.calculated?.let { value["calculated"] = s(it.key) }
            obj("ok" to b(true), "value" to JsonObject(value))
        }
    }

    private fun createInput(c: DebtCreateInput): JsonElement {
        val o = mutableMapOf<String, JsonElement>(
            "name" to s(c.name), "startMode" to s(c.startMode.key), "principal" to n(c.principal), "annualRate" to n(c.annualRate),
            "installments" to n(c.installments), "firstInstallmentDate" to s(c.firstInstallmentDate),
            "costs" to arr(c.costs.map { obj("label" to s(it.label), "amount" to n(it.amount), "kind" to s(it.kind.key)) }),
        )
        c.installment?.let { o["installment"] = n(it) }
        c.anchorDate?.let { o["anchorDate"] = s(it) }
        return JsonObject(o)
    }

    val handlers: Map<String, Handler> = mapOf(
        "installmentAmount" to { x -> amortizationError { n(DebtCalc.installmentAmount(x["principal"].num, x["annualRate"].num, x["installments"].num)) } },
        "buildSegmentSchedule" to { x -> amortizationError { arr(DebtCalc.buildSegmentSchedule(segmentInput(x)).map { row(it) }) } },
        "buildSegmentSchedule(summary)" to { x ->
            val r = DebtCalc.buildSegmentSchedule(segmentInput(x))
            obj(
                "first" to row(r[0]), "second" to row(r[1]), "last" to row(r[r.size - 1]),
                "totalInterest" to n(DebtCalc.round2(r.fold(0.0) { acc, it -> acc + it.interest })), "rows" to n(r.size),
            )
        },
        "solveAnnualRate" to { x -> amortizationError { n(DebtCalc.solveAnnualRate(x["principal"].num, x["installment"].num, x["installments"].num)) } },
        "solveInstallments" to { x -> amortizationError { n(DebtCalc.solveInstallments(x["principal"].num, x["annualRate"].num, x["installment"].num)) } },
        "solvePrincipal" to { x -> amortizationError { n(DebtCalc.solvePrincipal(x["annualRate"].num, x["installment"].num, x["installments"].num)) } },
        "computeApr" to { x ->
            amortizationError {
                n(DebtCalc.computeApr(DebtAprInput(x["principal"].num, x["upfrontCosts"].num, x["installment"].num, x["recurringCosts"].num, x["installments"].num)))
            }
        },
        "resolveMissingLoanInput" to { x ->
            amortizationError {
                val r = DebtCalc.resolveMissingLoanInput(
                    DebtPartialLoanInputs(x["principal"].optNum, x["installment"].optNum, x["installments"].optNum, x["annualRate"].optNum),
                )
                val o = loanInputs(r.inputs).toMutableMap()
                r.calculated?.let { o["calculated"] = s(it.key) }
                JsonObject(o)
            }
        },
        "resolvePenalty" to { x ->
            DebtCalc.resolvePenalty(x["amount"].num, x["text"].str, DebtPenaltyUnit.fromKey(x["unit"].str) ?: error("unit"))?.let { n(it) } ?: JsonNull
        },
        "resolveAddForm" to { x -> resolution(DebtCalc.resolveAddForm(addFormState(x))) },
        "resolveAddForm+previewAddForm" to { x ->
            val state = addFormState(x)
            when (val r = DebtCalc.resolveAddForm(state)) {
                is DebtAddFormResolution.Failure -> obj("resolution" to resolution(r), "preview" to JsonNull, "createInput" to JsonNull)
                is DebtAddFormResolution.Ok -> {
                    val preview = DebtCalc.previewAddForm(state, r.value)?.let {
                        obj("installment" to n(it.installment), "totalInterest" to n(it.totalInterest), "endDate" to iso(it.endDate))
                    } ?: JsonNull
                    // The vector input has no `today`: the generator used 2025-01-10 for the fotografia case (anchorDate) and
                    // 2025-01-01 otherwise, where `today` does not reach the output.
                    val today = if (state.startMode == DebtStartMode.FOTOGRAFIA) "2025-01-10" else "2025-01-01"
                    obj("resolution" to resolution(r), "preview" to preview, "createInput" to createInput(DebtCalc.buildCreateDebtInput(state, r.value, today)))
                }
            }
        },
        "buildLoanPlan" to { x -> plan(DebtCalc.buildLoanPlan(terms(x["terms"]), events(x["events"]), x["today"].date)) },
        "compareEarlyRepayment" to { x ->
            val inp = x["input"]
            val c = DebtCalc.compareEarlyRepayment(
                terms(x["terms"]), events(x["events"]), x["today"].date, DebtEarlyRepaymentInput(inp["date"].date, inp["amount"].num, inp["penalty"].num),
            )
            obj(
                "baselineInterest" to n(c.baselineInterest), "baselineEndDate" to iso(c.baselineEndDate), "baselineInstallment" to n(c.baselineInstallment),
                "reduceInstallment" to outcome(c.reduceInstallment), "reduceDuration" to outcome(c.reduceDuration),
            )
        },
        "simulateRecurringExtra" to { x ->
            val r = DebtCalc.simulateRecurringExtra(terms(x["terms"]), events(x["events"]), x["today"].date, x["monthlyExtra"].num)
            obj(
                "interestWith" to n(r.interestWith), "interestWithout" to n(r.interestWithout), "interestSaved" to n(r.interestSaved),
                "extraPaid" to n(r.extraPaid), "endDate" to iso(r.endDate), "baselineEndDate" to iso(r.baselineEndDate), "monthsSaved" to n(r.monthsSaved),
            )
        },
        "compareRefinance" to { x ->
            val c = x["current"]
            val o = x["offer"]
            val r = DebtCalc.compareRefinance(
                DebtRefinanceCurrent(c["residual"].num, c["currentInstallment"].num, c["interestRemaining"].num, c["endDate"].date),
                x["today"].date,
                DebtRefinanceOffer(o["annualRate"].num, o["installments"].int, o["upfrontCosts"].num, o["penalty"].num),
            )
            obj(
                "residual" to n(r.residual), "currentInstallment" to n(r.currentInstallment), "currentInterestRemaining" to n(r.currentInterestRemaining),
                "currentEndDate" to iso(r.currentEndDate), "newInstallment" to n(r.newInstallment), "newInterest" to n(r.newInterest),
                "newEndDate" to iso(r.newEndDate), "switchCosts" to n(r.switchCosts), "netSaving" to n(r.netSaving),
                "breakEvenMonths" to (r.breakEvenMonths?.let { n(it) } ?: JsonNull),
            )
        },
        "simulatePayoff" to { x ->
            payoff(
                DebtCalc.simulatePayoff(
                    payoffLoans(x["loans"]), x["monthlyExtra"].num, DebtPayoffStrategy.fromKey(x["strategy"].str) ?: error("strategy"), x["today"].date,
                ),
            )
        },
        "comparePayoffStrategies" to { x ->
            val r = DebtCalc.comparePayoffStrategies(payoffLoans(x["loans"]), x["monthlyExtra"].num, x["today"].date)
            obj("none" to payoff(r.none), "avalanche" to payoff(r.avalanche), "snowball" to payoff(r.snowball))
        },
    )
}
