package io.buddybudget.app.features.planningde

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.liquidity.debugShows
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.data.PlanningResults
import io.buddybudget.core.domain.planningde.GermanForecastCard
import io.buddybudget.core.domain.planningde.GermanPlanningRow
import io.buddybudget.core.domain.planningde.GermanPlanningText
import io.buddybudget.core.domain.planningde.GermanTaxSettings

@Composable
private fun planningText(): GermanPlanningText {
    val strings = LocalStrings.current
    return GermanPlanningText(LocalBBLocale.current, LocalHideAmounts.current) { strings.lookup(it) }
}

/**
 * Investimenti › Tasse for DE (13-planning-de §3, PLAN-018…026): web `PlanningScreen section="tax"` — the tax profile,
 * the information needed, the server's estimate, realised events, and the fund classification. Twin: GermanTaxScreen
 * in GermanPlanningScreens.swift.
 */
@Composable
fun GermanTaxScreen(model: GermanPlanningModel) {
    val text = planningText()
    GermanPlanningContainer(model, tr("German investment taxes · 2026")) { editor, saved ->
        val results = model.taxResults ?: saved
        val tax = editor.tax
        val taxResults = results.tax
        if (taxResults != null) {
            if (debugShows(4)) TaxPanel(model, text, tax, taxResults.report)
            FundsPanel(model, text, tax, taxResults)
        }
    }
}

@Composable
private fun TaxPanel(model: GermanPlanningModel, text: GermanPlanningText, tax: GermanTaxSettings, report: PlanningResults.TaxReport) {
    PlanningPanel(tr("German investment taxes · 2026")) {
        if (debugShows(1)) {
            PlanningNote(tr("Annual private-investor estimate in EUR, using FIFO separately for each custody account. This is not a broker withholding calculation. Foreign tax credits, treaty relief, business holdings and favourable-rate assessment require individual review."))
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                PlanningChoice(tr("Assessment"), text.assessmentOptions, if (tax.joint) "joint" else "single") { v ->
                    model.updateTax { it.copy(joint = v == "joint") }
                }
                PlanningChoice(tr("Church tax"), text.churchOptions, GermanPlanningText.churchValue(tax.churchRate)) { v ->
                    model.updateTax { it.copy(churchRate = GermanPlanningText.churchRate(v)) }
                }
                PlanningNumberField(tr("Allowance already used outside this portfolio (€)"), tax.allowanceUsedElsewhere) { v ->
                    model.updateTax { it.copy(allowanceUsedElsewhere = v) }
                }
                PlanningNumberField(tr("Verified creditable foreign tax after allowances and losses (€)"), tax.verifiedForeignCredit) { v ->
                    model.updateTax { it.copy(verifiedForeignCredit = v) }
                }
                PlanningNumberField(tr("Share loss carryforward (€)"), tax.shareLosses) { v -> model.updateTax { it.copy(shareLosses = v) } }
                PlanningNumberField(tr("General loss carryforward (€)"), tax.generalLosses) { v -> model.updateTax { it.copy(generalLosses = v) } }
                PlanningNumberField(tr("Additional taxable capital income / advances received (€)"), tax.otherCapitalIncome) { v ->
                    model.updateTax { it.copy(otherCapitalIncome = v) }
                }
            }
        }
        if (debugShows(2)) {
            PlanningCheckRow(tr("I have checked the full acquisition history, custody accounts and loss balances. No unrecorded transfers or corporate actions affect these lots."),
                tax.historyConfirmed) { on -> model.updateTax { it.copy(historyConfirmed = on) } }
            PlanningNote(tr("Use available loss balances only; cross-bank offsets may require a loss certificate and assessment. Do not enter the same external income both as used allowance and additional income."))
            val issues = text.issueLines(report, model.portfolio)
            if (issues.isNotEmpty()) {
                val label = tr("Information needed")
                Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    issues.forEach { PlanningBullet(it) }
                }
            }
        }
        if (debugShows(3)) {
            PlanningNote(tr("Enter only foreign tax confirmed as creditable for these taxable earnings after treaty limits, refunds, allowances and losses. Recorded withholding is not automatically treated as creditable."))
        }
        Column {
            text.taxRows(report).forEach { row -> PlanningResultRow(row, muted = row.id != "recorded" && report.estimate == null) }
        }
        PlanningDisclosure(tr("Realised events included")) {
            text.realisedEvents(report, model.portfolio).forEach { PlanningResultRow(it) }
        }
    }
}

@Composable
private fun FundsPanel(model: GermanPlanningModel, text: GermanPlanningText, tax: GermanTaxSettings, results: PlanningResults.Tax) {
    PlanningPanel(tr("Funds and ETFs")) {
        PlanningNote(tr("Classification must come from the fund tax documents, not its name. Enter gross prior advances attributable to each sale before partial exemption. Enter this year's taxable advances above as additional capital income."))
        if (debugShows(5)) {
            text.fundRows(results, model.portfolio).forEach { fund ->
                PlanningChoice(fund.name, text.fundOptions, tax.fundKind(fund.id)) { v ->
                    model.updateTax { it.copy(fundKinds = it.fundKinds + (fund.id to v)) }
                }
            }
        }
        text.fundSaleRows(results, model.portfolio).forEach { sale ->
            PlanningNumberField(sale.label, tax.priorAdvances(sale.id)) { v ->
                model.updateTax { it.copy(priorAdvancesBySale = it.priorAdvancesBySale + (sale.id to v)) }
            }
        }
        PlanningCheckRow(tr("I checked prior advances and current-year advance income against broker records. The fund classification did not change during the holding period."),
            tax.fundHistoryConfirmed) { on -> model.updateTax { it.copy(fundHistoryConfirmed = on) } }
    }
}

/**
 * Investimenti › Dividendi for DE (13-planning-de §4, PLAN-027…031): web `PlanningScreen section="income"` — recorded
 * income per year and the 12-month forecast with gross and estimated net per payment (cards on phone). Always the saved
 * plan's results: Tax changes must be saved to affect Income. Twin: GermanIncomeScreen in GermanPlanningScreens.swift.
 */
@Composable
fun GermanIncomeScreen(model: GermanPlanningModel) {
    val text = planningText()
    GermanPlanningContainer(model, tr("Income")) { _, saved ->
        val income = saved.income ?: return@GermanPlanningContainer
        if (debugShows(1)) {
            PlanningPanel(tr("Recorded income")) {
                val years = text.incomeYears(income)
                if (years.isEmpty()) {
                    BBText(tr("No recorded income yet."), BBTextStyle.Body)
                } else {
                    years.forEach { year ->
                        Column {
                            BBText(year.year.toString(), BBTextStyle.BodyStrong, Modifier.semantics { heading() })
                            year.rows.forEach { PlanningResultRow(it) }
                        }
                    }
                }
            }
        }
        PlanningPanel(tr("Income forecast · next 12 months")) {
            if (debugShows(2)) {
            PlanningNote(tr("Gross forecasts repeat historical dividends for current holdings or use recorded bond terms. Payments and exchange rates can change. Missing history is not a forecast of zero income."))
            PlanningResultRow(GermanPlanningRow("total", tr("Forecast gross income"), text.amount(income.totalGross)))
            PlanningNote(tr("Net forecasts use the Tax section's annual allowances and losses. They are unavailable for unvalidated tax years or incomplete tax history. Foreign withholding and treaty credits are not estimated."))
            }
            if (income.bondsWithoutTerms.isNotEmpty()) BBText(tr("Some bonds have no complete coupon terms."), BBTextStyle.Body)
            val cards = text.forecastCards(income, model.portfolio)
            if (cards.isEmpty()) {
                BBText(tr("No payments can currently be forecast."), BBTextStyle.Body)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) { cards.forEach { ForecastCardView(it) } }
            }
        }
    }
}

/** One forecast payment (the web table row as a card): date and instrument, then gross and estimated net. */
@Composable
private fun ForecastCardView(card: GermanForecastCard) {
    val c = BuddyBudgetTheme.colors
    val amount = BBTextStyle.Body.style.copy(fontFeatureSettings = "tnum", textAlign = TextAlign.End)
    Column(
        Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3)
            .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3), verticalAlignment = Alignment.CenterVertically) {
            BBText(card.instrument, BBTextStyle.BodyStrong, Modifier.weight(1f), maxLines = 2)
            BBText(card.date, BBTextStyle.Caption, color = c.mutedForeground)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(tr("Gross income"), BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground)
            BBText(card.gross, Modifier, amount)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(tr("Estimated net income"), BBTextStyle.Body, Modifier.weight(1f), color = c.mutedForeground)
            Column(horizontalAlignment = Alignment.End) {
                BBText(card.net, Modifier, amount, color = if (card.netUnavailable) c.mutedForeground else c.foreground)
                if (card.benchmark) BBText(tr("2026 rules scenario"), BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
    }
}
