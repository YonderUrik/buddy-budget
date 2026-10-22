import BuddyBudgetKit
import SwiftUI

/// Investimenti › Tasse for DE (13-planning-de §3, PLAN-018…026): web `PlanningScreen section="tax"` — the tax profile,
/// the information needed, the server's estimate, realised events, and the fund classification. Twin:
/// GermanTaxScreen in GermanPlanningScreens.kt.
struct GermanTaxScreen: View {
    let model: GermanPlanningModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        GermanPlanningContainer(model: model, title: planningText("German investment taxes · 2026")) { editor, saved in
            let text = GermanPlanningText(locale: locale, masked: hide, translate: planningText)
            let results = model.taxResults ?? saved
            let tax = editor.tax
            if let taxResults = results.tax {
                if debugShows(4) { taxPanel(text: text, tax: tax, report: taxResults.report) }
                fundsPanel(text: text, tax: tax, results: taxResults)
            }
        }
    }

    @ViewBuilder
    private func taxPanel(text: GermanPlanningText, tax: GermanTaxSettings, report: PlanningResults.TaxReport) -> some View {
        PlanningPanel(title: planningText("German investment taxes · 2026")) {
            if debugShows(1) {
            PlanningNote(text: planningText("Annual private-investor estimate in EUR, using FIFO separately for each custody account. This is not a broker withholding calculation. Foreign tax credits, treaty relief, business holdings and favourable-rate assessment require individual review."))
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                PlanningChoice(label: planningText("Assessment"), options: text.assessmentOptions, value: tax.joint ? "joint" : "single") { v in
                    model.updateTax { $0.joint = v == "joint" }
                }
                PlanningChoice(label: planningText("Church tax"), options: text.churchOptions, value: GermanPlanningText.churchValue(tax.churchRate)) { v in
                    model.updateTax { $0.churchRate = GermanPlanningText.churchRate(v) }
                }
                PlanningNumberField(label: planningText("Allowance already used outside this portfolio (€)"), value: tax.allowanceUsedElsewhere) { v in
                    model.updateTax { $0.allowanceUsedElsewhere = v }
                }
                PlanningNumberField(label: planningText("Verified creditable foreign tax after allowances and losses (€)"), value: tax.verifiedForeignCredit) { v in
                    model.updateTax { $0.verifiedForeignCredit = v }
                }
                PlanningNumberField(label: planningText("Share loss carryforward (€)"), value: tax.shareLosses) { v in
                    model.updateTax { $0.shareLosses = v }
                }
                PlanningNumberField(label: planningText("General loss carryforward (€)"), value: tax.generalLosses) { v in
                    model.updateTax { $0.generalLosses = v }
                }
                PlanningNumberField(label: planningText("Additional taxable capital income / advances received (€)"), value: tax.otherCapitalIncome) { v in
                    model.updateTax { $0.otherCapitalIncome = v }
                }
            }
            }
            if debugShows(2) {
            PlanningCheckRow(label: planningText("I have checked the full acquisition history, custody accounts and loss balances. No unrecorded transfers or corporate actions affect these lots."),
                             isOn: tax.historyConfirmed) { on in model.updateTax { $0.historyConfirmed = on } }
            PlanningNote(text: planningText("Use available loss balances only; cross-bank offsets may require a loss certificate and assessment. Do not enter the same external income both as used allowance and additional income."))
            let issues = text.issueLines(report, portfolio: model.portfolio)
            if !issues.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    ForEach(Array(issues.enumerated()), id: \.offset) { _, line in PlanningBullet(text: line) }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel(planningText("Information needed"))
            }
            }
            if debugShows(3) {
            PlanningNote(text: planningText("Enter only foreign tax confirmed as creditable for these taxable earnings after treaty limits, refunds, allowances and losses. Recorded withholding is not automatically treated as creditable."))
            }
            VStack(spacing: 0) {
                ForEach(text.taxRows(report)) { row in
                    PlanningResultRow(row: row, muted: row.id != "recorded" && report.estimate == nil)
                }
            }
            PlanningDisclosure(title: planningText("Realised events included")) {
                VStack(spacing: 0) {
                    ForEach(text.realisedEvents(report, portfolio: model.portfolio)) { PlanningResultRow(row: $0) }
                }
            }
        }
    }

    @ViewBuilder
    private func fundsPanel(text: GermanPlanningText, tax: GermanTaxSettings, results: PlanningResults.Tax) -> some View {
        PlanningPanel(title: planningText("Funds and ETFs")) {
            PlanningNote(text: planningText("Classification must come from the fund tax documents, not its name. Enter gross prior advances attributable to each sale before partial exemption. Enter this year's taxable advances above as additional capital income."))
            if debugShows(5) {
                ForEach(text.fundRows(results, portfolio: model.portfolio)) { fund in
                    PlanningChoice(label: fund.name, options: text.fundOptions, value: tax.fundKind(fund.id)) { v in
                        model.updateTax { $0.fundKinds[fund.id] = v }
                    }
                }
            }
            ForEach(text.fundSaleRows(results, portfolio: model.portfolio)) { sale in
                PlanningNumberField(label: sale.label, value: tax.priorAdvances(sale.id)) { v in
                    model.updateTax { $0.priorAdvancesBySale[sale.id] = v }
                }
            }
            PlanningCheckRow(label: planningText("I checked prior advances and current-year advance income against broker records. The fund classification did not change during the holding period."),
                             isOn: tax.fundHistoryConfirmed) { on in model.updateTax { $0.fundHistoryConfirmed = on } }
        }
    }
}

/// Investimenti › Dividendi for DE (13-planning-de §4, PLAN-027…031): web `PlanningScreen section="income"` — recorded
/// income per year and the 12-month forecast with gross and estimated net per payment (cards on phone). Always the
/// saved plan's results: Tax changes must be saved to affect Income. Twin: GermanIncomeScreen in GermanPlanningScreens.kt.
struct GermanIncomeScreen: View {
    let model: GermanPlanningModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        GermanPlanningContainer(model: model, title: planningText("Income")) { _, saved in
            let text = GermanPlanningText(locale: locale, masked: hide, translate: planningText)
            if let income = saved.income {
                if debugShows(1) {
                PlanningPanel(title: planningText("Recorded income")) {
                    let years = text.incomeYears(income)
                    if years.isEmpty {
                        BBText(planningText("No recorded income yet."), style: BBTypography.body)
                    } else {
                        ForEach(years) { year in
                            VStack(alignment: .leading, spacing: 0) {
                                BBText(String(year.year), style: BBTypography.bodyStrong).accessibilityAddTraits(.isHeader)
                                ForEach(year.rows) { PlanningResultRow(row: $0) }
                            }
                        }
                    }
                }
                }
                PlanningPanel(title: planningText("Income forecast · next 12 months")) {
                    if debugShows(2) {
                    PlanningNote(text: planningText("Gross forecasts repeat historical dividends for current holdings or use recorded bond terms. Payments and exchange rates can change. Missing history is not a forecast of zero income."))
                    PlanningResultRow(row: GermanPlanningRow(id: "total", label: planningText("Forecast gross income"), value: text.amount(income.totalGross)))
                    PlanningNote(text: planningText("Net forecasts use the Tax section's annual allowances and losses. They are unavailable for unvalidated tax years or incomplete tax history. Foreign withholding and treaty credits are not estimated."))
                    }
                    if !income.bondsWithoutTerms.isEmpty {
                        BBText(planningText("Some bonds have no complete coupon terms."), style: BBTypography.body)
                    }
                    let cards = text.forecastCards(income, portfolio: model.portfolio)
                    if cards.isEmpty {
                        BBText(planningText("No payments can currently be forecast."), style: BBTypography.body)
                    } else {
                        VStack(spacing: BBSpacing.space3) {
                            ForEach(cards) { ForecastCardView(card: $0) }
                        }
                    }
                }
            }
        }
    }
}

/// One forecast payment (the web table row as a card): date and instrument, then gross and estimated net.
private struct ForecastCardView: View {
    let card: GermanForecastCard

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                BBText(card.instrument, style: BBTypography.bodyStrong, lineLimit: 2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BBText(card.date, style: BBTypography.caption, color: .bbMutedForeground)
            }
            HStack(alignment: .firstTextBaseline) {
                BBText(planningText("Gross income"), style: BBTypography.body, color: .bbMutedForeground)
                Spacer(minLength: BBSpacing.space3)
                BBText(card.gross, style: BBTypography.body).monospacedDigit()
            }
            HStack(alignment: .firstTextBaseline) {
                BBText(planningText("Estimated net income"), style: BBTypography.body, color: .bbMutedForeground)
                Spacer(minLength: BBSpacing.space3)
                VStack(alignment: .trailing, spacing: 0) {
                    BBText(card.net, style: BBTypography.body, color: card.netUnavailable ? .bbMutedForeground : .bbForeground)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                    if card.benchmark {
                        BBText(planningText("2026 rules scenario"), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                }
            }
        }
        .padding(BBSpacing.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}
