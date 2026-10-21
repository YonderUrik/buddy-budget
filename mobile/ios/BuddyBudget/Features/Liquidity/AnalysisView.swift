import BuddyBudgetKit
import SwiftUI

/// Analisi as a Liquidità segment screen (same chrome as `MovementsScreen`). Android: AnalysisScreen in AnalysisView.kt.
struct AnalysisScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.liquidity
        BBScreen(title: nil, onBack: back, onRefresh: { await model.loadAnalysis() }) {
            LiquiditySegmentBar()
            AnalysisView(model: model)
        }
        .task {
            Task { [env = model.env] in try? await env.transactions.markSeen() }
            if model.categories.isEmpty { await model.loadMeta() }
            await model.loadAnalysis()
        }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.loadAnalysis() } }
    }
}

/// Liquidità · Analisi (TX-052…061): period stepper, spend of the period with the cumulative curve and the dashed
/// «Di solito» line, «Dove vanno i soldi» (donut + expandable groups), «Da dove arrivano», «Risparmio accumulato».
/// Data: `GET /api/liquidity/analysis`. Android: AnalysisView.kt.
struct AnalysisView: View {
    let model: LiquidityModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.liquiditySegment) private var segment

    var body: some View {
        if LiquidityNoAccounts.applies(model.accounts?.count) {
            LiquidityNoAccountsState(segment: .analysis)
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                stepper
                SegmentedControl(options: [(ExpensePeriod.mese, L10n.month_b333e2), (ExpensePeriod.treMesi, L10n.s3Months),
                                           (ExpensePeriod.anno, L10n.year_191852)],
                                 selection: Binding(get: { model.period }, set: { model.setPeriod($0) }),
                                 accessibilityLabel: L10n.periodLength)
            }
            switch model.analysis {
            case .loading:
                VStack(spacing: BBSpacing.space4) {
                    BBSkeleton(height: 280, radius: BBRadius.xl)
                    BBSkeleton(height: 240, radius: BBRadius.xl)
                }
                .accessibilityLabel(L10n.loading)
            case .failed:
                LoadError(message: L10n.unableToLoadAnalysisData) { Task { await model.loadAnalysis() } }
            case .loaded(let analysis):
                if debugShows(0) { SpendCard(analysis: analysis, currency: model.currency) }
                if debugShows(1) { SpendByGroup(analysis: analysis, currency: model.currency) { category in
                    model.showCategory(id: category.id, name: category.name)
                    segment?.wrappedValue = .movements
                } }
                IncomeSources(analysis: analysis, currency: model.currency)
                SavingsRow(analysis: analysis, currency: model.currency)
            }
        }
    }

    private var stepper: some View {
        // Web `PeriodStepper`: arrows around the label (font-heading text-lg medium, min width 144).
        HStack(spacing: BBSpacing.space1) {
            BBIconButton(icon: .chevronLeft, accessibilityLabel: L10n.previousPeriod, color: .bbText2) { model.shiftPeriod(-1) }
            BBText(Periods.formatPeriodLabel(model.period, model.periodRange, locale: locale), style: .titleSmall, lineLimit: 1)
                .frame(minWidth: 144)
            BBIconButton(icon: .chevronRight, accessibilityLabel: L10n.nextPeriod, color: .bbText2) { model.shiftPeriod(1) }
                .bbDisabled(!model.canGoForward)
                .disabled(!model.canGoForward)
        }
        .padding(.leading, -BBSpacing.space3)
    }
}

/// «Spese del periodo» (TX-053/054).
private struct SpendCard: View {
    let analysis: LiquidityAnalysis
    let currency: String
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        // No card around it (#417): the sentence, the figure as a hero and the chart edge to edge.
        VStack(alignment: .leading, spacing: 0) {
            BBText(analysis.spent <= 0 ? L10n.thereAreNoExpensesInThisPeriodYet
                       : (hideAmounts ? VoiceText.masked(analysis.sentence) : analysis.sentence),
                   style: MonthSentence.voice, color: .bbText2)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(L10n.periodExpenses, style: BBTypography.bodyLarge, color: .bbText2)
                MoneyHero(value: analysis.spent, currency: currency)
                if analysis.spentBefore > 0 {
                    HStack(spacing: BBSpacing.space1) {
                        let up = analysis.delta > 0
                        BBText(up ? "▲" : "▼", style: BBTypography.bodyStrong, color: up ? .bbNeg : .bbPos)
                        AmountText(value: analysis.delta, currency: currency, tone: up ? .neg : .pos, signed: true, maximumFractionDigits: 0,
                                   style: BBTypography.bodyStrong.with(weight: 600))
                        BBText(L10n.comparedWithThePreviousPeriod, style: BBTypography.body, color: .bbText2, lineLimit: 1)
                    }
                    .padding(.top, BBSpacing.space2)
                }
            }
            .padding(.top, BBSpacing.space6)
            let values = analysis.curve.map(\.value)
            let typical = analysis.isCurrentMonth ? analysis.typical : nil
            BBTrendChart(values: values, reference: typical,
                         labels: analysis.curve.map { CalendarDate(iso: $0.date).map { BBFormat.formatLongDate($0, locale: locale) } ?? $0.date },
                         height: 220, referenceLabel: L10n.usually_53a865,
                         formatValue: { BBFormat.formatCurrency($0, currency: currency, locale: locale, maximumFractionDigits: 0) },
                         accessibilitySummary: L10n.periodExpenses)
                .padding(.horizontal, -BBSpacing.space4)
                .padding(.top, BBSpacing.space2)
            if typical != nil {
                BBText(L10n.theDashedLineIsYourAverageSpending, style: BBTypography.body, color: .bbText2).padding(.top, BBSpacing.space2)
            }
        }
    }
}

/// «Dove vanno i soldi» (TX-055…057): donut by group, blocks sorted by amount with the top 5 categories.
private struct SpendByGroup: View {
    let analysis: LiquidityAnalysis
    let currency: String
    let onCategory: (LiquidityAnalysis.GroupCategory) -> Void

    @State private var selected: Int?
    @State private var expanded: Set<String> = []
    @State private var showAll: Set<String> = []
    @Environment(\.bbLocale) private var locale
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let groups = analysis.groups.filter { $0.amount > 0 }
        let total = groups.reduce(0) { $0 + $1.amount }
        // TX-074: link to Categorie, where the monthly budgets are set.
        BBSection(title: L10n.whereTheMoneyGoes, actionLabel: analysis.hasBudgets ? L10n.editBudgets : L10n.setABudget,
                  onAction: { shell.push(.destination(.categories)) }) {
            if groups.isEmpty {
                BBText(L10n.noExpensesToDisplayForThisPeriod, style: BBTypography.body, color: .bbMutedForeground)
            } else {
                VStack(spacing: BBSpacing.space4) {
                    BBDonut(slices: groups.enumerated().map { BBDonutSlice(id: $0.offset, label: $0.element.label, value: $0.element.amount,
                                                                            color: .bbGroup($0.element.key)) },
                            currency: currency, centerLabel: L10n.inExpenses,
                            selection: Binding(get: { selected }, set: { next in
                                selected = next
                                if let next, groups.indices.contains(next) { expanded.insert(groups[next].key) }
                            }),
                            accessibilitySummary: L10n.whereTheMoneyGoes)
                        .frame(maxWidth: .infinity)
                    VStack(spacing: BBSpacing.space1_5) {
                        ForEach(Array(groups.enumerated()), id: \.element.key) { index, group in
                            block(group, index: index, total: total)
                        }
                    }
                }
            }
        }
    }

    private func block(_ group: LiquidityAnalysis.Group, index: Int, total: Double) -> some View {
        let isOpen = expanded.contains(group.key)
        let share = total > 0 ? group.amount / total : 0
        let count = group.categories.count
        let countLabel = count == 1 ? L10n.s1Category : L10n.s0Categories(String(count))
        let visible = showAll.contains(group.key) ? group.categories : Array(group.categories.prefix(5))
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                if isOpen { expanded.remove(group.key) } else { expanded.insert(group.key) }
            } label: {
                HStack(spacing: BBSpacing.space3) {
                    Circle().fill(Color.bbGroup(group.key)).frame(width: 10, height: 10)
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(group.label, style: BBTypography.bodyLarge.with(weight: 600), lineLimit: 1)
                        BBText(L10n.s0OfSpending1(BBFormat.formatNumber(JSNumber.round(share * 100), maximumFractionDigits: 0, locale: locale), countLabel),
                               style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    AmountText(value: group.amount, currency: currency, style: .rowAmount)
                    BBIconView(isOpen ? .chevronUp : .chevronDown, size: .md, color: .bbText3)
                }
                .padding(.vertical, BBSpacing.space3)
                .padding(.horizontal, BBSpacing.space4)
                .frame(minHeight: 56)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .opacity(selected == nil || selected == index ? 1 : 0.35)
            if isOpen {
                VStack(spacing: 0) {
                    ForEach(visible) { category in
                        Button { onCategory(category) } label: {
                            HStack(spacing: BBSpacing.space3) {
                                BBIconBadge(icon: BBIcon.category(category.icon), color: .bbSwatch(category.color), diameter: 28, iconSize: 14)
                                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                                    BBText(category.name, style: BBTypography.body, lineLimit: 1)
                                    CategoryBar(category: category, group: group, currency: currency)
                                }
                                AmountText(value: category.amount, currency: currency, style: BBTypography.bodyStrong)
                            }
                            .padding(.vertical, BBSpacing.space2)
                            .padding(.horizontal, BBSpacing.space3)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                    }
                    if group.categories.count > 5 {
                        BBButton(showAll.contains(group.key) ? L10n.showLess : L10n.showAll0_b99f52(String(group.categories.count)),
                                 variant: .link, size: .sm) {
                            if showAll.contains(group.key) { showAll.remove(group.key) } else { showAll.insert(group.key) }
                        }
                        .padding(.horizontal, BBSpacing.space1)
                    }
                }
                .padding(.bottom, BBSpacing.space2)
            }
        }
        .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbForeground.opacity(0.04)))
    }
}

/// TX-074 (web #432): with a budget the bar fills up to the budget (primary, negative once over) and says what is left;
/// without one it shows the category's share of its group.
private struct CategoryBar: View {
    let category: LiquidityAnalysis.GroupCategory
    let group: LiquidityAnalysis.Group
    let currency: String
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        if let budget = category.budget, budget > 0 {
            let over = category.amount > budget
            let used = L10n.budgetUsed0Of1(BBFormat.formatNumber(JSNumber.round(category.amount / budget * 100), maximumFractionDigits: 0, locale: locale),
                                           money(budget))
            ProgressBar(state: .determinate(value: min(category.amount, budget), max: budget), label: used, color: over ? .bbNeg : .bbPrimary)
            BBText(over ? L10n.s0OverThe1Budget(money(category.amount - budget), money(budget))
                        : L10n.s0LeftOfThe1Budget(money(budget - category.amount), money(budget)),
                   style: BBTypography.caption, color: over ? .bbNeg : .bbText2)
        } else {
            ProgressBar(state: .determinate(value: category.amount, max: group.amount), label: category.name, color: .bbSwatch(category.color))
        }
    }

    private func money(_ value: Double) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts)
    }
}

/// «Da dove arrivano» (TX-058).
private struct IncomeSources: View {
    let analysis: LiquidityAnalysis
    let currency: String
    @Environment(\.bbLocale) private var locale

    var body: some View {
        BBSection(title: L10n.whereItComesFrom_f0ecc5) {
            if analysis.incomeSources.isEmpty {
                BBText(L10n.noIncomeInThisPeriod, style: BBTypography.body, color: .bbMutedForeground)
            } else {
                VStack(spacing: BBSpacing.space1_5) {
                    ForEach(analysis.incomeSources) { source in
                        BBSoftRow(title: source.name,
                                  hint: source.quotaPct.map { L10n.s0OfIncome(BBFormat.formatNumber(JSNumber.round($0), maximumFractionDigits: 0, locale: locale)) },
                                  leading: AnyView(BBIconBadge(icon: BBIcon.category(source.icon), color: .bbSwatch(source.color), diameter: 36, iconSize: 16))) {
                            AmountText(value: source.amount, currency: currency, tone: .pos, signed: true, style: .rowAmount)
                        }
                    }
                }
            }
        }
    }
}

/// «Risparmio accumulato» (TX-059).
private struct SavingsRow: View {
    let analysis: LiquidityAnalysis
    let currency: String

    var body: some View {
        BBSection(title: L10n.accumulatedSavings) {
            BBSoftRow(title: analysis.saved >= 0 ? L10n.saved : L10n.less_f85735, hint: L10n.incomeMinusSpendingMonthByMonthOve) {
                AmountText(value: analysis.saved, currency: currency, tone: .signed, signed: true, style: .rowAmount)
            }
        }
    }
}
