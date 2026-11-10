import BuddyBudgetKit
import SwiftUI

// Panoramica blocks under the chart: composition (OV-022…025), month pace (OV-026), upcoming dues (OV-027),
// goals (OV-030…032) and the investments pulse (OV-028). Twins of OverviewSections.kt on Android.

// MARK: - «Dove sta il patrimonio»

struct CompositionSection: View {
    let model: OverviewModel
    let view: OverviewView
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let items = view.composition
        if !items.isEmpty {
            let slices = CompositionDisplay.donutItems(items)
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: "Dove sta il patrimonio"), style: .sectionHeading).accessibilityAddTraits(.isHeader)
                    if let sentence = CompositionDisplay.sentence(items) {
                        BBText(L10n.lookup(italian: sentence.source, sentence.values), style: BBTypography.body)
                    }
                }
                if CompositionDisplay.showsDonut(items) {
                    HStack {
                        Spacer(minLength: 0)
                        BBDonut(slices: slices.enumerated().map { i, item in
                                    BBDonutSlice(id: i, label: item.label, value: item.share, color: .bbOverviewToken(AssetClass.colorToken(item.key)))
                                },
                                currency: view.currency, size: 192,
                                selection: Binding(get: { model.selectedSlice }, set: { model.selectedSlice = $0 }),
                                accessibilitySummary: L10n.lookup(italian: "Composizione del patrimonio: {0}.", [
                                    "0": slices.map { "\($0.label) \(CompositionDisplay.percent($0.share))" }.joined(separator: ", "),
                                ]),
                                centerContent: { focused in AnyView(center(focused.flatMap { slices.indices.contains($0) ? slices[$0] : nil }, items)) },
                                innerRadius: 62, outerRadius: 90)
                        Spacer(minLength: 0)
                    }
                }
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.key) { index, item in
                        row(item, items: items, focused: model.selectedSlice.flatMap { slices.indices.contains($0) ? slices[$0].key : nil } == item.key)
                    }
                }
            }
        }
    }

    @ViewBuilder private func center(_ item: OverviewView.CompositionItem?, _ items: [OverviewView.CompositionItem]) -> some View {
        VStack(spacing: 0) {
            if let item {
                BBText(item.label, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                AmountText(value: item.amount, currency: view.currency, maximumFractionDigits: 0,
                           style: BBTextStyle.titleSmall.with(size: 18, lineHeight: 28))
                BBText("\(CompositionDisplay.percent(item.share)) \(L10n.lookup(italian: "del totale"))", style: BBTypography.caption,
                       color: .bbMutedForeground)
            } else if let share = CompositionDisplay.investedShare(items) {
                BBText(CompositionDisplay.percent(share), style: BBTypography.amountLarge)
                BBText(L10n.lookup(italian: "investito"), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
        .multilineTextAlignment(.center)
    }

    /// OV-022 row → its area; first tap on the row navigates (the donut slice highlights, mobile adaptation).
    private func row(_ item: OverviewView.CompositionItem, items: [OverviewView.CompositionItem], focused: Bool) -> some View {
        Button { shell.open(path: AssetClass.path(item.key)) } label: {
            HStack(spacing: BBSpacing.space3) {
                Circle().fill(Color.bbOverviewToken(AssetClass.colorToken(item.key))).frame(width: 8, height: 8)
                VStack(alignment: .leading, spacing: 0) {
                    BBText(item.label, style: BBTypography.bodyStrong)
                    BBText(item.detail + (CompositionDisplay.showsShare(item, in: items) ? " · \(CompositionDisplay.percent(item.share))" : ""),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 0) {
                    AmountText(value: item.amount, currency: view.currency, maximumFractionDigits: 0,
                               style: BBTypography.bodyStrong.with(weight: 500))
                    if let highlight = item.highlight {
                        let negative = highlight.amount < 0
                        let pct = highlight.ratio.map { " (\(BBFormat.formatSignedPct($0, locale: locale)))" } ?? ""
                        BBText((negative ? "−" : "+") + BBFormat.formatCurrency(abs(highlight.amount), currency: view.currency, locale: locale,
                                                                                maximumFractionDigits: 0, masked: hideAmounts) + pct,
                               style: BBTypography.caption.with(lineHeight: 16), color: negative ? .bbNeg : .bbPos, lineLimit: 1)
                    }
                }
                BBIconView(.chevronRight, size: .md, color: Color.bbMutedForeground.opacity(0.5))
            }
            .padding(.horizontal, BBSpacing.space2)
            .padding(.vertical, BBSpacing.space2_5)
            .frame(minHeight: 48)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(focused ? Color.bbAlphaMuted60 : .clear))
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(focused ? Color.bbRing : .clear, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
    }
}

// MARK: - «Il mese di …»

struct MonthPaceSection: View {
    let view: OverviewView
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let pace = view.monthPace
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            OverviewSectionHeading(icon: .wallet, title: L10n.lookup(italian: "Il mese di {0}", ["0": view.monthLabel]), color: .bbSwatchTeal,
                                   linkLabel: L10n.lookup(italian: "Movimenti")) { shell.open(path: "/liquidita/analisi") }
            MonthPaceChart(pace: pace, currency: view.currency)
            HStack(alignment: .top, spacing: BBSpacing.space6) {
                VStack(alignment: .leading, spacing: 0) {
                    BBText(L10n.lookup(italian: "Entrate ricevute"), style: BBTypography.body, color: .bbMutedForeground)
                    AmountText(value: pace.income, currency: view.currency, tone: .pos, maximumFractionDigits: 0,
                               style: BBTextStyle.titleSmall.with(size: 18, lineHeight: 28))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let budget = MonthPaceDisplay.budgetText(pace), let used = MonthPaceDisplay.budgetUsed(pace) {
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(L10n.lookup(italian: "Budget"), style: BBTypography.body, color: .bbMutedForeground)
                        BBText(L10n.lookup(italian: budget.source, ["0": money(budget.amount)]),
                               style: BBTextStyle(role: .sans, size: 18, lineHeight: 28, weight: 500, letterSpacingEm: 0, tabularNums: true,
                                                  uppercase: false, anchor: .title3))
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.bbMuted)
                                Capsule().fill(MonthPaceDisplay.isOverBudget(pace) ? Color.bbNeg : .bbPrimary).frame(width: geo.size.width * used)
                            }
                        }
                        .frame(height: 8)
                        .padding(.top, BBSpacing.space1_5)
                        .accessibilityElement()
                        .accessibilityLabel(L10n.lookup(italian: "Budget usato: {0}% di {1}",
                                                        ["0": String(Int((used * 100).rounded())), "1": money(pace.budgetTotal ?? 0)]))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.top, BBSpacing.space2)
        }
    }

    private func money(_ value: Double) -> String {
        BBFormat.formatCurrency(value, currency: view.currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts)
    }
}

/// Hand-drawn cumulative spending (charts.md §3 `MonthPaceChart`): dashed usual curve with end labels, solid «you»
/// line drawn once on open (900 ms, skipped with Reduce Motion), today's dot and value, ticks 1 / mid / last.
struct MonthPaceChart: View {
    let pace: OverviewView.MonthPace
    let currency: String
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let g = MonthPaceGeometry(pace: pace, width: geo.size.width)
            ZStack(alignment: .topLeading) {
                Path { p in
                    p.move(to: CGPoint(x: MonthPaceGeometry.padLeft, y: g.baselineY))
                    p.addLine(to: CGPoint(x: g.width - MonthPaceGeometry.padRight, y: g.baselineY))
                }
                .stroke(Color.bbBorder, lineWidth: 1)
                if let typical = pace.typical, let end = typical.last {
                    Path(ChartPaths.line(g.points(typical), curve: .linear))
                        .stroke(Color.bbText3, style: StrokeStyle(lineWidth: 2, dash: [5, 5]))
                    label(money(end), style: BBTypography.body.with(size: 13, lineHeight: 16), color: .bbText2)
                        .chartAnchored(x: g.x(day: pace.daysInMonth) + 6, y: g.y(end) + 4 - 12, anchor: 0)
                    label(L10n.lookup(italian: "di solito"), style: BBTypography.caption, color: .bbText3)
                        .chartAnchored(x: g.x(day: pace.daysInMonth) + 6, y: g.y(end) + 19 - 12, anchor: 0)
                }
                Path(ChartPaths.line(g.points(pace.current), curve: .linear))
                    .trim(from: 0, to: drawn)
                    .stroke(Color.bbPrimary, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                let todayX = g.x(day: pace.dayOfMonth), todayY = g.y(pace.spentSoFar)
                Circle().fill(Color.bbPrimary)
                    .overlay(Circle().stroke(Color.bbCard, lineWidth: 2))
                    .frame(width: 10, height: 10)
                    .offset(x: todayX - 5, y: todayY - 5)
                label(money(pace.spentSoFar), style: BBTextStyle(role: .sans, size: 14, lineHeight: 16, weight: 600, letterSpacingEm: 0,
                                                                   tabularNums: true, uppercase: false, anchor: .subheadline), color: .bbForeground)
                    .chartAnchored(x: todayX, y: todayY - 12 - 12, anchor: 0.5)
                ForEach(Array(g.ticks.enumerated()), id: \.offset) { i, day in
                    label(String(day), style: BBTypography.caption, color: .bbText3)
                        .chartAnchored(x: g.x(day: day), y: MonthPaceGeometry.height - 8 - 12, anchor: i == 0 ? 0 : (i == 1 ? 0.5 : 1))
                }
            }
            .blur(radius: hideAmounts ? 10 : 0)
        }
        .frame(height: MonthPaceGeometry.height)
        .accessibilityElement()
        .accessibilityLabel(summary)
        .onAppear {
            guard drawn == 0 else { return }
            if reduceMotion { drawn = 1 } else {
                withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.9).delay(0.15)) { drawn = 1 }
            }
        }
    }

    private func label(_ text: String, style: BBTextStyle, color: Color) -> some View {
        BBText(text, style: style, color: color, lineLimit: 1).fixedSize()
    }

    private func money(_ value: Double) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts)
    }

    private var summary: String {
        if let typical = pace.typical, let end = typical.last {
            let today = typical.indices.contains(pace.dayOfMonth - 1) ? typical[pace.dayOfMonth - 1] : 0
            return L10n.lookup(italian: "Spesa cumulata del mese: {0} al giorno {1}, contro {2} di solito; a fine mese il solito arriva a {3}.",
                               ["0": money(pace.spentSoFar), "1": String(pace.dayOfMonth), "2": money(today), "3": money(end)])
        }
        return L10n.lookup(italian: "Spesa cumulata del mese: {0} al giorno {1}.", ["0": money(pace.spentSoFar), "1": String(pace.dayOfMonth)])
    }
}

// MARK: - «Prossime rate»

struct UpcomingDuesSection: View {
    let view: OverviewView
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let dues = UpcomingDues.shown(view.debts)
        if !dues.isEmpty {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                OverviewSectionHeading(icon: .calendarClock, title: L10n.lookup(italian: "Prossime rate"), color: .bbNeg,
                                       linkLabel: L10n.lookup(italian: "Debiti")) { shell.open(.debts) }
                // #427: rows separated by space, not rules.
                VStack(spacing: BBSpacing.space1) {
                    ForEach(Array(dues.enumerated()), id: \.offset) { _, due in dueRow(due) }
                }
                if let debts = view.debts {
                    BBText(footnote(debts), style: BBTypography.body, color: .bbMutedForeground)
                }
            }
        }
    }

    private func dueRow(_ due: OverviewView.NextDue) -> some View {
        let date = CalendarDate(iso: due.date)
        return HStack(spacing: BBSpacing.space3) {
            VStack(spacing: 0) {
                BBText(date.map { String($0.day) } ?? "", style: BBTextStyle.titleSmall.with(size: 18, lineHeight: 22))
                BBText((date.map { BBFormat.monthNameShort($0.month, locale: locale) } ?? "").replacingOccurrences(of: ".", with: ""),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            .frame(width: 44)
            .padding(.vertical, BBSpacing.space1)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted))
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                BBText(due.name, style: BBTypography.bodyStrong, lineLimit: 1)
                if due.overdue { BBText(L10n.lookup(italian: "Scaduta"), style: BBTypography.body, color: .bbNeg) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            AmountText(value: due.amount, currency: view.currency, maximumFractionDigits: 0,
                       style: BBTextStyle(role: .sans, size: 16, lineHeight: 24, weight: 500, letterSpacingEm: 0, tabularNums: true,
                                          uppercase: false, anchor: .body))
        }
        .padding(.vertical, BBSpacing.space2_5)
        .accessibilityElement(children: .combine)
    }

    private func footnote(_ debts: OverviewView.Debts) -> String {
        let total = BBFormat.formatCurrency(debts.total, currency: view.currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts)
        let last = debts.debtFreeDate.map { L10n.lookup(italian: ", ultima rata il {0}", ["0": BBFormat.formatDateWithYear($0, locale: locale)]) } ?? ""
        return L10n.lookup(italian: "Residuo dei debiti: {0}{1}", ["0": total, "1": last])
    }
}

// MARK: - Goals

struct GoalsSection: View {
    let model: OverviewModel
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        switch model.goalsMode {
        case .hidden:
            EmptyView()
        case .invite:
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                HStack(alignment: .top, spacing: BBSpacing.space3) {
                    OverviewSectionHeading(icon: .target, title: L10n.lookup(italian: "Novità: obiettivi di risparmio"), color: .bbSwatchAmber)
                    BBIconButton(icon: .x, accessibilityLabel: L10n.lookup(italian: "Non ora")) { model.dismissGoalsInvite() }
                        .padding(.trailing, -BBSpacing.space2)
                }
                BBText(L10n.lookup(italian: "Dai un nome ai tuoi risparmi: un viaggio, la casa, un fondo per gli imprevisti. Scegli da quali conti o investimenti arrivano i soldi e vedi quando ci arrivi e cosa cambia per il giorno in cui smetti di lavorare."),
                       style: BBTypography.body, color: .bbText2)
                BBButton(L10n.lookup(italian: "Crea il primo obiettivo"), variant: .outline, size: .touch) {
                    shell.open(path: "/analitiche/obiettivi?nuovo=1&da=panoramica")
                }
            }
        case .list(let goals):
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                OverviewSectionHeading(icon: .target, title: L10n.lookup(italian: "I tuoi obiettivi"), color: .bbSwatchAmber,
                                       linkLabel: L10n.lookup(italian: "Tutti")) { shell.open(path: "/analitiche/obiettivi") }
                VStack(spacing: BBSpacing.space2) {
                    ForEach(goals, id: \.id) { goal in goalRow(goal) }
                }
            }
        }
    }

    private func goalRow(_ goal: GoalView) -> some View {
        let currency = model.goals?.currency ?? "EUR"
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts) }
        let month = { (key: String) in BBFormat.formatMonthLabel(String(key.prefix(7)), locale: locale) }
        let sentence = GoalsTile.statusSentence(goal, money: money, month: month)
        var text = sentence.parts.map { L10n.lookup(italian: $0.source, $0.values) }
        if sentence.capitalizeFirst, let first = text.first { text[0] = BBFormat.capitalize(first) }
        let label = GoalsTile.statusLabel(goal.status).map { L10n.lookup(italian: $0) }
        let labelColor: Color = goal.status == "in_ritardo" ? .bbSwatchAmberDark : .bbPos
        return Button { shell.open(path: "/analitiche/obiettivi/\(goal.id)") } label: {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBIconBadge(icon: BBIcon.forKey(GoalsTile.iconKey(goal.kind)) ?? .sparkles, color: .bbOverviewToken(GoalsTile.colorToken(goal.kind)),
                            diameter: 32, iconSize: 16)
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                        BBText(goal.name, style: BBTypography.bodyLarge.with(weight: 500), lineLimit: 1)
                        Spacer(minLength: 0)
                        (Text(verbatim: money(goal.current)).font(BBTextStyle(role: .sans, size: 16, lineHeight: 24, weight: 500, letterSpacingEm: 0,
                                                                              tabularNums: true, uppercase: false, anchor: .body).font)
                            .foregroundColor(.bbForeground)
                            + Text(verbatim: " " + L10n.lookup(italian: "di {0}", ["0": money(goal.target)])).font(BBTypography.body.font)
                            .foregroundColor(.bbText3))
                            .lineLimit(1)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.bbMuted)
                            Capsule().fill(Color.bbOverviewToken(GoalsTile.progressToken(goal.status)))
                                .frame(width: geo.size.width * min(1, max(0, goal.progress)))
                        }
                    }
                    .frame(height: 6)
                    .accessibilityLabel(L10n.lookup(italian: "Avanzamento di {0}", ["0": goal.name]))
                    ((label.map { Text(verbatim: "\($0) · ").font(BBTypography.bodyStrong.font).foregroundColor(labelColor) } ?? Text(verbatim: ""))
                        + Text(verbatim: text.joined()).font(BBTypography.body.font).foregroundColor(.bbText2))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.vertical, BBSpacing.space3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - «Investimenti» pulse

struct InvestmentsPulseSection: View {
    let pulse: InvestmentsPulse
    let currency: String
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            OverviewSectionHeading(icon: pulse.isLoss ? .trendingDown : .trendingUp, title: L10n.lookup(italian: "Investimenti"), color: .bbPrimary,
                                   linkLabel: L10n.lookup(italian: "Portafoglio")) { shell.open(.investments) }
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                BBText(pulse.sign + money(abs(pulse.marketGain)), style: BBTypography.statValue, color: pulse.isLoss ? .bbNeg : .bbPos)
                let ratio = pulse.ratioText(locale: locale)
                BBText(L10n.lookup(italian: ratio.source, ratio.values), style: BBTypography.body, color: .bbMutedForeground)
            }
            GeometryReader { geo in
                HStack(spacing: 0) {
                    Rectangle().fill(Color.bbPrimary).frame(width: geo.size.width * pulse.paidShare)
                    if !pulse.isLoss { Rectangle().fill(Color.bbPos).frame(width: geo.size.width * (1 - pulse.paidShare)) }
                    Spacer(minLength: 0)
                }
                .background(Color.bbMuted)
                .clipShape(Capsule())
            }
            .frame(height: 12)
            .blur(radius: hideAmounts ? 10 : 0)
            .accessibilityElement()
            .accessibilityLabel(L10n.lookup(italian: "Portafoglio da {0}: {1} versati e {2} {3} dal mercato", [
                "0": money(pulse.value), "1": money(min(pulse.paid, pulse.value)), "2": money(abs(pulse.marketGain)),
                "3": L10n.lookup(italian: pulse.isLoss ? "persi" : "guadagnati"),
            ]))
            HStack {
                let positions = pulse.positionsText
                BBText("\(L10n.lookup(italian: positions.source, positions.values)) \(L10n.lookup(italian: "· versati")) \(money(pulse.paid))",
                       style: BBTypography.body, color: .bbMutedForeground)
                Spacer(minLength: BBSpacing.space2)
                BBText(money(pulse.value), style: BBTypography.bodyStrong)
            }
        }
    }

    private func money(_ value: Double) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hideAmounts)
    }
}
