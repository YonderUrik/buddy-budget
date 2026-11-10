package io.buddybudget.core.domain.debts

import io.buddybudget.core.domain.periods.CalendarDate

// Plan, simulator and form types of the debts port (web `lib/calc/debt-plan.ts`, `early-repayment.ts`,
// `debt-simulator.ts`, `lib/debts/add-form.ts`, `early-repayment-form.ts`). Same names as the Swift types.

/** `DebtStartMode`. */
enum class DebtStartMode(val key: String) {
    NUOVO("nuovo"), ORIGINE("origine"), FOTOGRAFIA("fotografia");

    companion object {
        fun fromKey(key: String): DebtStartMode? = entries.firstOrNull { it.key == key }
    }
}

/** `EarlyRepaymentEffect`. */
enum class DebtEarlyRepaymentEffect(val key: String) {
    REDUCE_INSTALLMENT("reduce_installment"), REDUCE_DURATION("reduce_duration");

    companion object {
        fun fromKey(key: String): DebtEarlyRepaymentEffect? = entries.firstOrNull { it.key == key }
    }
}

/** `DebtTerms`. */
data class DebtTerms(
    val startMode: DebtStartMode,
    /** Disbursed principal (nuovo/origine) or today's residual (fotografia). */
    val principal: Double,
    /** Annual TAN in %. */
    val annualRate: Double,
    val installments: Int,
    val firstInstallmentDate: CalendarDate,
    /** Declared installment; null → computed. */
    val installment: Double? = null,
)

/** `DebtPlanEvent`. */
sealed interface DebtPlanEvent {
    val date: CalendarDate

    data class Payment(val installmentNumber: Int, override val date: CalendarDate, val amount: Double, val transactionId: String? = null) : DebtPlanEvent
    data class BalanceCorrection(override val date: CalendarDate, val amount: Double) : DebtPlanEvent
    data class RateChange(override val date: CalendarDate, val rate: Double) : DebtPlanEvent
    data class EarlyRepayment(override val date: CalendarDate, val amount: Double, val penalty: Double, val effect: DebtEarlyRepaymentEffect) : DebtPlanEvent
}

/** `AppliedEarlyRepayment`. */
data class DebtAppliedEarlyRepayment(
    val date: CalendarDate,
    val amount: Double,
    val penalty: Double,
    val effect: DebtEarlyRepaymentEffect,
    val residualAfter: Double,
)

/** `InstallmentStatus`. */
enum class DebtInstallmentStatus(val key: String) { PAGATA("pagata"), DA_PAGARE("da_pagare"), SCADUTA("scaduta"), DA_CONFERMARE("da_confermare") }

/** Payment recorded for an installment. */
data class DebtRowPayment(val date: CalendarDate, val amount: Double, val transactionId: String?)

/** `LoanPlanRow`. */
data class DebtLoanPlanRow(
    val number: Int,
    val dueDate: CalendarDate,
    val installment: Double,
    val interest: Double,
    val capital: Double,
    val residual: Double,
    val status: DebtInstallmentStatus,
    val payment: DebtRowPayment?,
)

/** `LoanPlanTotals`. */
data class DebtLoanPlanTotals(
    val residual: Double,
    val currentInstallment: Double,
    val interestToDate: Double,
    val interestRemaining: Double,
    val paidTotal: Double,
    val remainingInstallments: Int,
    val endDate: CalendarDate,
    val nextDueDate: CalendarDate?,
    val overdueCount: Int,
    val unconfirmedCount: Int,
    val finished: Boolean,
    val penaltiesPaid: Double,
    val closedOn: CalendarDate?,
)

/** One point of the residual chart. */
data class DebtResidualPoint(val date: CalendarDate, val residual: Double)

/** `LoanPlan`; [warnings] are Italian catalog keys. */
data class DebtLoanPlan(
    val rows: List<DebtLoanPlanRow>,
    val totals: DebtLoanPlanTotals,
    val residualSeries: List<DebtResidualPoint>,
    val earlyRepayments: List<DebtAppliedEarlyRepayment>,
    val warnings: List<String>,
)

/** `EarlyRepaymentInput`. */
data class DebtEarlyRepaymentInput(val date: CalendarDate, val amount: Double, val penalty: Double)

/** `EarlyRepaymentOutcome`. */
data class DebtEarlyRepaymentOutcome(
    val effect: DebtEarlyRepaymentEffect,
    val nextInstallment: Double,
    val endDate: CalendarDate,
    val remainingInstallments: Int,
    val interestAfter: Double,
    val interestSaved: Double,
    val netBenefit: Double,
    val monthsSaved: Int,
    val closesDebt: Boolean,
    val plan: DebtLoanPlan,
)

/** `EarlyRepaymentComparison`. */
data class DebtEarlyRepaymentComparison(
    val baselineInterest: Double,
    val baselineEndDate: CalendarDate,
    val baselineInstallment: Double,
    val reduceInstallment: DebtEarlyRepaymentOutcome,
    val reduceDuration: DebtEarlyRepaymentOutcome,
)

/** `RecurringExtraResult`. */
data class DebtRecurringExtraResult(
    val interestWith: Double,
    val interestWithout: Double,
    val interestSaved: Double,
    val extraPaid: Double,
    val endDate: CalendarDate,
    val baselineEndDate: CalendarDate,
    val monthsSaved: Int,
)

/** Current-loan figures for `compareRefinance`. */
data class DebtRefinanceCurrent(val residual: Double, val currentInstallment: Double, val interestRemaining: Double, val endDate: CalendarDate)

/** `RefinanceOffer` (surroga). */
data class DebtRefinanceOffer(val annualRate: Double, val installments: Int, val upfrontCosts: Double, val penalty: Double)

/** `RefinanceResult`. */
data class DebtRefinanceResult(
    val residual: Double,
    val currentInstallment: Double,
    val currentInterestRemaining: Double,
    val currentEndDate: CalendarDate,
    val newInstallment: Double,
    val newInterest: Double,
    val newEndDate: CalendarDate,
    val switchCosts: Double,
    val netSaving: Double,
    val breakEvenMonths: Int?,
)

/** `PayoffStrategy | "none"`. */
enum class DebtPayoffStrategy(val key: String) {
    NONE("none"), AVALANCHE("avalanche"), SNOWBALL("snowball");

    companion object {
        fun fromKey(key: String): DebtPayoffStrategy? = entries.firstOrNull { it.key == key }
    }
}

/** `PayoffLoan`. */
data class DebtPayoffLoan(val id: String, val name: String, val residual: Double, val annualRate: Double, val installment: Double)

/** `PayoffClosing`. */
data class DebtPayoffClosing(val id: String, val name: String, val months: Int, val endDate: CalendarDate)

/** `PayoffResult`. */
data class DebtPayoffResult(
    val strategy: DebtPayoffStrategy,
    val months: Int,
    val totalInterest: Double,
    val endDate: CalendarDate,
    val closeOrder: List<String>,
    val closings: List<DebtPayoffClosing>,
)

/** Result of `comparePayoffStrategies`. */
data class DebtPayoffComparison(val none: DebtPayoffResult, val avalanche: DebtPayoffResult, val snowball: DebtPayoffResult)

/** Kind of an extra cost of the add form. */
enum class DebtCostKind(val key: String) {
    UNA_TANTUM("una_tantum"), PER_RATA("per_rata");

    companion object {
        fun fromKey(key: String): DebtCostKind? = entries.firstOrNull { it.key == key }
    }
}

/** `AddDebtCostField` (text as typed). */
data class DebtAddCostField(val label: String, val amount: String, val kind: DebtCostKind)

/** `AddDebtFormState`: every field as typed text. */
data class DebtAddFormState(
    val name: String = "",
    val startMode: DebtStartMode,
    val principal: String = "",
    val installment: String = "",
    val installments: String = "",
    val annualRate: String = "",
    /** `YYYY-MM-DD` or empty. */
    val firstInstallmentDate: String = "",
    val costs: List<DebtAddCostField> = emptyList(),
)

/** `ResolvedAddForm`. */
data class DebtResolvedAddForm(val inputs: DebtLoanInputs, val calculated: DebtLoanInputKey?, val apr: Double?)

/** `AddFormResolution`: `Failure(null)` = still typing, not an error. */
sealed interface DebtAddFormResolution {
    data class Ok(val value: DebtResolvedAddForm) : DebtAddFormResolution
    data class Failure(val message: String?) : DebtAddFormResolution
}

/** `AddFormPreview`. */
data class DebtAddFormPreview(val installment: Double, val totalInterest: Double, val endDate: CalendarDate)

/** One cost of the create payload. */
data class DebtCreateCost(val label: String, val amount: Double, val kind: DebtCostKind)

/** Body of `POST /api/debts` (null fields are omitted). */
data class DebtCreateInput(
    val name: String,
    val startMode: DebtStartMode,
    val principal: Double,
    val annualRate: Double,
    val installments: Int,
    val firstInstallmentDate: String,
    val installment: Double?,
    val anchorDate: String?,
    val costs: List<DebtCreateCost>,
)

/** `PenaltyUnit`. */
enum class DebtPenaltyUnit(val key: String) {
    EUR("eur"), PERCENT("percent");

    companion object {
        fun fromKey(key: String): DebtPenaltyUnit? = entries.firstOrNull { it.key == key }
    }
}

/** `EarlyRepaymentMode`. */
enum class DebtEarlyRepaymentMode(val key: String) { ONCE("once"), MONTHLY("monthly") }

/** `EarlyRepaymentFormValues`. */
data class DebtEarlyRepaymentFormValues(
    val mode: DebtEarlyRepaymentMode,
    val date: String,
    val amount: String,
    val penalty: String,
    val penaltyUnit: DebtPenaltyUnit,
)

/** `EarlyRepaymentPreview`. */
sealed interface DebtEarlyRepaymentPreview {
    data object Empty : DebtEarlyRepaymentPreview
    data class Error(val message: String) : DebtEarlyRepaymentPreview
    data class Once(val amount: Double, val penalty: Double, val date: CalendarDate, val comparison: DebtEarlyRepaymentComparison) : DebtEarlyRepaymentPreview
    data class Monthly(val amount: Double, val result: DebtRecurringExtraResult) : DebtEarlyRepaymentPreview
}

/** Half-open index range of the plan rows shown by default. */
data class DebtRowRange(val start: Int, val end: Int)
