import BuddyBudgetKit
import SwiftUI

/// Debiti overview «Priorità e azioni» (10-debts §1): hero, «Prossime rate», «I tuoi debiti», «Come uscirne prima»,
/// «Dove paghi di più» — phone order of the web. `Aggiungi` opens the add flow from every Debiti screen.
/// Twin of `DebtsScreen` on Android.
struct DebtsScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.debts
        BBScreen(title: L10n.lookup(italian: "Debiti"), onBack: back, onRefresh: { await model.load() }) {
            BBButton(L10n.lookup(italian: "Aggiungi"), icon: .plus, variant: .sun, size: .lg) { model.addOpen = true }
                .padding(.trailing, BBSpacing.space2)
        } content: {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                BBText(L10n.lookup(italian: "Cosa pagare, cosa pesa, come uscirne"), style: BBTypography.body, color: .bbMutedForeground)
                    .padding(.top, -BBSpacing.space3)
                DebtsGateView(model: model) {
                    DebtsOverviewContent(model: model)
                }
            }
        }
        .task { await model.start() }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.load() } }
        .debtsDialogs(model)
    }
}

/// DEBT-008: loading, error with retry, empty state with «Aggiungi un finanziamento».
struct DebtsGateView<Content: View>: View {
    let model: DebtsModel
    @ViewBuilder let content: () -> Content

    var body: some View {
        switch model.state.gate {
        case .loading:
            VStack(spacing: BBSpacing.space8) {
                BBSkeleton(height: 176, radius: BBRadius.xl)
                BBSkeleton(height: 256, radius: BBRadius.xl)
            }
            .accessibilityLabel(L10n.loading)
        case .failed:
            LoadError(message: L10n.lookup(italian: "Impossibile caricare i debiti."), onRetry: { Task { await model.retry() } })
        case .empty:
            EmptyState(icon: .landmark, title: L10n.lookup(italian: "Tieni d'occhio i tuoi debiti"),
                       description: L10n.lookup(italian: "Aggiungi un finanziamento, nuovo o già in corso: vedrai il piano rata per rata, quanto paghi di interessi e quando finisci."),
                       primary: BBStateAction(label: L10n.lookup(italian: "Aggiungi un finanziamento")) { model.addOpen = true })
        case .content:
            content()
        }
    }
}

private struct DebtsOverviewContent: View {
    let model: DebtsModel
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let text = DebtsText(locale: locale, translate: { L10n.lookup(italian: $0) })
        let state = model.state
        if let data = state.data {
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                if debugShows(0) { DebtsHero(total: data.overview.totalDebt, currency: model.currency,
                          subtitle: text.heroSubtitle(openCount: DebtsRules.openCount(data.debts), freeDate: DebtsRules.freeDate(data.debts))) }
                if debugShows(1), !data.overview.nextDue.isEmpty {
                    DebtsUpcomingSection(model: model, data: data, text: text)
                }
                if debugShows(2) { DebtsListSection(model: model, data: data, text: text) }
                if debugShows(3), let plan = state.exitPlan {
                    DebtsExitSection(model: model, plan: plan, text: text)
                }
                if let interest = state.interest {
                    DebtsInterestSection(model: model, interest: interest, text: text)
                }
            }
        }
    }
}

/// DEBT-002.
private struct DebtsHero: View {
    let total: Double
    let currency: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(L10n.lookup(italian: "Ancora da restituire"), style: BBTypography.body, color: .bbMutedForeground)
            MoneyHero(value: total, currency: currency)
            BBText(subtitle, style: BBTypography.body, color: .bbMutedForeground)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(L10n.lookup(italian: "Debito totale"))
    }
}

/// DEBT-003/004: next installments with the round check that opens the pay dialog.
private struct DebtsUpcomingSection: View {
    let model: DebtsModel
    let data: DebtsViewData
    let text: DebtsText
    @Environment(\.bbLocale) private var locale

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Prossime rate"), icon: .calendarClock, color: .bbNeg) {
            VStack(spacing: 0) {
                ForEach(Array(data.overview.nextDue.enumerated()), id: \.offset) { index, item in
                    let days = DebtsRules.daysBetween(model.state.today, item.date)
                    let row = DebtsRules.dueRow(data.debt(item.debtId), date: item.date)
                    HStack(spacing: BBSpacing.space3) {
                        DateTile(date: item.date, highlight: index == 0 && !item.overdue, overdue: item.overdue)
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(item.name, style: BBTypography.bodyStrong, lineLimit: 1)
                            BBText(text.dueText(days), style: BBTypography.caption, color: item.overdue ? .bbNeg : .bbMutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        AmountText(value: item.amount, currency: model.currency, style: .rowAmount.with(weight: 500))
                        Button {
                            if let row { model.paying = (item.debtId, row) }
                        } label: {
                            Circle().strokeBorder(Color.bbBorder, lineWidth: 2)
                                .frame(width: 36, height: 36)

                                .bbHitArea(height: 36, width: 36)
                        }
                        .buttonStyle(.plain)
                        .bbDisabled(row == nil)
                        .accessibilityLabel(L10n.lookup(italian: "Segna pagata la rata di {0}", ["0": item.name]))
                    }
                    .padding(.vertical, BBSpacing.space3)
                }
            }
        }
    }
}

/// Day + abbreviated month tile.
struct DateTile: View {
    let date: String
    var highlight = false
    var overdue = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let d = CalendarDate(iso: date)
        let fg: Color = overdue ? .bbNeg : highlight ? .bbPrimary : .bbMutedForeground
        let bg: Color = overdue ? .bbNegSoft : highlight ? .bbAlphaPrimary10 : .clear
        VStack(spacing: 0) {
            BBText(d.map { String($0.day) } ?? "", style: BBTypography.cardTitle.with(lineHeight: 18), color: fg)
            BBText(d.map { BBFormat.shortMonthLabel($0.month, locale: locale) } ?? "", style: BBTypography.micro.with(weight: 600), color: fg)
        }
        .frame(width: 44, height: 44)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(bg))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(highlight || overdue ? Color.clear : Color.bbBorder, lineWidth: 1))
    }
}

/// DEBT-005: one row per loan → detail.
private struct DebtsListSection: View {
    let model: DebtsModel
    let data: DebtsViewData
    let text: DebtsText
    @Environment(ShellModel.self) private var shell

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "I tuoi debiti"), icon: .landmark, color: .bbPrimary) {
            VStack(spacing: 0) {
                ForEach(Array(data.debts.enumerated()), id: \.element.id) { index, debt in
                    Button {
                        model.select(debt.id)
                        shell.push(.debt(debt.id))
                    } label: {
                        HStack(spacing: BBSpacing.space3) {
                            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                                BBText(debt.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                ShareBar(fraction: DebtsRules.repaidShare(debt, insights: data.insights))
                                BBText(text.listDetail(debt), style: BBTypography.caption, color: .bbMutedForeground)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            AmountText(value: debt.totals.residual, currency: model.currency, maximumFractionDigits: 0,
                                       style: .rowAmount.with(weight: 500))
                            BBIconView(.chevronRight, size: .md, color: .bbMutedForeground)
                        }
                        .padding(.vertical, BBSpacing.space3_5)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbAlphaMuted50, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                }
            }
        }
    }
}

/// 6 pt progress bar (`--border` track, `--primary` fill).
struct ShareBar: View {
    let fraction: Double
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.bbBorder)
                Capsule().fill(Color.bbPrimary).frame(width: proxy.size.width * min(1, max(0, fraction)))
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

/// DEBT-006: extra slider indexing the server's avalanche plans.
private struct DebtsExitSection: View {
    let model: DebtsModel
    let plan: DebtsInsights.ExitPlan
    let text: DebtsText

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Come uscirne prima"), icon: .route, color: .bbPos,
                     description: L10n.lookup(italian: "Quanto potresti mettere in più ogni mese? Quell'extra e le rate dei debiti che chiudi vanno prima al tasso più alto.")) {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                ExtraSlider(value: Binding(get: { model.state.exitExtra }, set: { model.setExitExtra($0) }), currency: model.currency)
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(plan.steps.enumerated()), id: \.element.id) { index, step in
                        HStack(spacing: BBSpacing.space3) {
                            Circle().fill(Color.bbPrimary).frame(width: 12, height: 12)
                                .overlay(Circle().stroke(Color.bbBackground, lineWidth: 3))
                                .overlay(Circle().stroke(Color.bbBorder, lineWidth: 2).padding(-3))
                                .frame(width: 18, height: 18)
                            VStack(alignment: .leading, spacing: 0) {
                                BBText(step.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                BBText(text.exitStep(step), style: BBTypography.caption, color: .bbMutedForeground)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            if step.monthsSaved > 0 {
                                BBText("\(BBFormat.minusSign)\(text.duration(step.monthsSaved))", style: BBTypography.badge.with(weight: 600), color: .bbPrimary)
                                    .padding(.horizontal, BBSpacing.space2_5)
                                    .padding(.vertical, BBSpacing.space0_5)
                                    .background(Capsule().fill(Color.bbAlphaPrimary10))
                            }
                        }
                        .padding(.vertical, BBSpacing.space2_5)
                        .background(alignment: .topLeading) {
                            if index < plan.steps.count - 1 {
                                Rectangle().fill(Color.bbBorder).frame(width: 2)
                                    .padding(.top, 32).padding(.bottom, -10).padding(.leading, 8)
                            }
                        }
                    }
                }
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(L10n.lookup(italian: "Libero da debiti"), style: BBTypography.body.with(weight: 500), color: .bbMutedForeground)
                        BBText(text.monthYear(plan.endDate), style: BBTextStyle.figure)
                    }
                    Spacer(minLength: BBSpacing.space3)
                    VStack(alignment: .trailing, spacing: 0) {
                        BBText(L10n.lookup(italian: "Interessi risparmiati"), style: BBTypography.body.with(weight: 500), color: .bbMutedForeground)
                        AmountText(value: plan.interestSaved, currency: model.currency, tone: .auto, maximumFractionDigits: 0,
                                   style: BBTextStyle.figure)
                    }
                }
                .padding(.top, BBSpacing.space2)
                BBText(L10n.lookup(italian: "Stima semplificata (rate e tassi costanti, nessuna penale): serve a confrontare, non a prevedere gli importi esatti."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }
}

/// «Extra al mese» label + amount + slider 0–1000 step 50 (DEBT-006, DEBT-030).
struct ExtraSlider: View {
    @Binding var value: Double
    let currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(alignment: .firstTextBaseline) {
                BBText(L10n.lookup(italian: "Extra al mese"), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
                Spacer(minLength: BBSpacing.space3)
                AmountText(value: value, currency: currency, maximumFractionDigits: 0, style: BBTextStyle.figure)
            }
            BBSlider(value: $value, range: 0...DebtsRules.extraMax, step: DebtsRules.extraStep,
                     accessibilityLabel: L10n.lookup(italian: "Extra al mese"))
        }
    }
}

/// DEBT-007: yearly interest per loan.
private struct DebtsInterestSection: View {
    let model: DebtsModel
    let interest: DebtsInsights.InterestShares
    let text: DebtsText
    @Environment(ShellModel.self) private var shell

    private static let tones: [Double] = [1, 0.7, 0.45, 0.25]
    private func tone(_ index: Int) -> Color { Color.bbPrimary.opacity(Self.tones[min(index, Self.tones.count - 1)]) }

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Dove paghi di più"), icon: .coins, color: .bbSwatchAmber) {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                VStack(alignment: .leading, spacing: 0) {
                    AmountText(value: interest.total, currency: model.currency, style: BBTextStyle.hero.with(size: 30, lineHeight: 36), hero: true)
                    BBText(L10n.lookup(italian: "di interessi in un anno, ai saldi e ai tassi di oggi"), style: BBTypography.body, color: .bbMutedForeground)
                }
                GeometryReader { proxy in
                    HStack(spacing: 0) {
                        ForEach(Array(interest.items.enumerated()), id: \.offset) { index, item in
                            Rectangle().fill(tone(index)).frame(width: proxy.size.width * item.share)
                        }
                    }
                }
                .frame(height: 12)
                .background(Color.bbBorder)
                .clipShape(Capsule())
                .accessibilityElement()
                .accessibilityLabel(interest.items.map { "\($0.name) \(Int(($0.share * 100).rounded()))%" }.joined(separator: ", "))
                VStack(spacing: 0) {
                    ForEach(Array(interest.items.enumerated()), id: \.offset) { index, item in
                        Button {
                            model.select(item.id)
                            shell.push(.debt(item.id))
                        } label: {
                            HStack(spacing: BBSpacing.space3) {
                                RoundedRectangle.bb(BBRadius.sm).fill(tone(index)).frame(width: 12, height: 12)
                                BBText(item.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                AmountText(value: item.yearly, currency: model.currency, maximumFractionDigits: 0,
                                           style: .rowAmount.with(size: 14, lineHeight: 20, weight: 500))
                                BBText("\(Int((item.share * 100).rounded()))%", style: BBTypography.caption, color: .bbMutedForeground)
                                    .monospacedDigit()
                                    .frame(width: 40, alignment: .trailing)
                            }
                            .padding(.vertical, BBSpacing.space2_5)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

extension View {
    /// The dialogs every Debiti screen can open: add flow, pay installment, simple events, early repayment.
    func debtsDialogs(_ model: DebtsModel) -> some View {
        self
            .formDialog(isPresented: Binding(get: { model.addOpen }, set: { model.addOpen = $0 })) {
                AddDebtFlow(model: model)
            }
            .formDialog(isPresented: Binding(get: { model.paying != nil }, set: { if !$0 { model.paying = nil } })) {
                if let paying = model.paying {
                    PayInstallmentView(model: model, debtId: paying.debtId, row: paying.row)
                }
            }
    }
}
