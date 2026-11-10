import BuddyBudgetKit
import SwiftUI

// Obiettivi (12-goals): list with capacity header, priority list with arrows, FIRE row, «La strada», «Raggiunti»;
// empty state with the emergency-fund suggestion. Android: GoalsViews.kt.

extension Color {
    /// Goal colours: swatches, `muted-foreground`, `neg`, `pos`.
    static func bbGoalToken(_ token: String) -> Color {
        switch token {
        case "muted-foreground": .bbMutedForeground
        default: .bbOverviewToken(token)
        }
    }
}

/// Round tinted icon (`GoalIcon`): sm 32/16, md 40/20, lg 56/28.
struct GoalIcon: View {
    let iconKey: String
    let colorToken: String
    var diameter: CGFloat = 40

    var body: some View {
        BBIconBadge(icon: BBIcon.forKey(iconKey) ?? .sparkles, color: .bbGoalToken(colorToken), diameter: diameter, iconSize: diameter / 2)
    }
}

/// Section heading of the goals screens: the display face with no icon (#427). `icon`/`color` are kept for the call
/// sites and not drawn.
struct GoalSectionHeading: View {
    let icon: BBIcon
    let title: String
    let color: Color

    var body: some View {
        BBText(title, style: .sectionHeading).accessibilityAddTraits(.isHeader)
    }
}

/// Progress of a goal: amber when late, green when reached, else primary.
struct GoalProgressBar: View {
    let progress: Double
    let status: String
    var height: CGFloat = 6

    var body: some View {
        AnalyticsProgress(value: progress, height: height,
                          color: status == "in_ritardo" ? .bbSwatchAmber : status == "raggiunto" ? .bbPos : .bbPrimary)
    }
}

struct GoalsListView: View {
    let model: AnalyticsModel

    var body: some View {
        Group {
            switch model.goals.gate {
            case .loading:
                VStack(spacing: BBSpacing.space4) {
                    BBSkeleton(height: 112, radius: BBRadius.xl)
                    BBSkeleton(height: 288, radius: BBRadius.xl)
                }
                .accessibilityLabel(L10n.loading)
            case .failed:
                LoadError(message: L10n.lookup(italian: "Impossibile caricare gli obiettivi."), onRetry: { Task { await model.retryGoals() } })
            case .unavailable:
                EmptyState(icon: .triangleAlert, title: L10n.thisFeatureIsNotAvailableForGerman, description: L10n.forGermanyTaxEstimatesPensionsDivid,
                           color: .bbSwatchAmber)
            case .empty:
                if let view = model.goals.view {
                    VStack(alignment: .leading, spacing: BBSpacing.space8) {
                        GoalsEmptyView(model: model, view: view)
                        AnalyticsDisclaimer()
                    }
                }
            case .content:
                if let view = model.goals.view {
                    VStack(alignment: .leading, spacing: BBSpacing.space8) {
                        GoalsOverviewView(model: model, view: view)
                        AnalyticsDisclaimer()
                    }
                }
            }
        }
        .task { await model.loadGoals() }
    }
}

/// GOAL-005 / GOAL-006.
private struct GoalsEmptyView: View {
    let model: AnalyticsModel
    let view: GoalsView
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let text = GoalsText(locale: locale, currency: view.currency, masked: hidden, translate: { L10n.lookup(italian: $0) })
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            EmptyState(icon: .target, title: L10n.lookup(italian: "Dai un nome ai tuoi risparmi"),
                       description: L10n.lookup(italian: "Un viaggio, l'anticipo di casa, un fondo per gli imprevisti: scegli quanto ti serve e da dove arrivano i soldi (conti o investimenti). Ti diciamo quando ci arrivi, se il risparmio basta per tutto e di quanto ogni obiettivo sposta il giorno in cui puoi smettere di lavorare."),
                       primary: BBStateAction(label: L10n.lookup(italian: "Nuovo obiettivo")) { model.openGoalForm(GoalFormRequest()) }, color: .bbSwatchAmber)
            if let suggestion = GoalsRules.emergencySuggestion(view) {
                HStack(alignment: .top, spacing: BBSpacing.space3) {
                    GoalIcon(iconKey: "shield-check", colorToken: "swatch-teal")
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        BBText(L10n.lookup(italian: "Da dove partire: un fondo di emergenza"), style: BBTypography.bodyLarge.with(weight: 500))
                        BBText(L10n.lookup(italian: GoalsRules.emergencySuggestionSource(view),
                                           ["0": String(GoalConstants.defaultEmergencyMonths), "1": text.money(suggestion.target), "2": text.money(suggestion.free)]),
                               style: BBTypography.body, color: .bbText2)
                        BBButton(L10n.lookup(italian: "Crea il fondo di emergenza"), variant: .outline, size: .touch) {
                            model.openGoalForm(GoalFormRequest(presetKind: .emergenza))
                        }
                    }
                }
                .padding(.top, BBSpacing.space6)
            }
        }
    }
}

private struct GoalsOverviewView: View {
    let model: AnalyticsModel
    let view: GoalsView
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden
    @Environment(ShellModel.self) private var shell
    @State private var barSheet = false
    /// GOAL-036: the «⋯» menu of a row (the detail's actions).
    @State private var menuGoal: GoalView?

    var body: some View {
        let text = GoalsText(locale: locale, currency: view.currency, masked: hidden, translate: { L10n.lookup(italian: $0) })
        let open = GoalsRules.openGoals(view)
        let done = GoalsRules.doneGoals(view)
        let header = text.capacityHeader(view)
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            if debugShows(0) { capacity(header, text: text) }
            if debugShows(1) {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    GoalSectionHeading(icon: .listOrdered, title: L10n.lookup(italian: "In ordine di priorità"), color: .bbSwatchAmber)
                    VStack(spacing: 0) {
                        ForEach(Array(open.enumerated()), id: \.element.id) { i, goal in
                            GoalRow(goal: goal, text: text, compact: false,
                                    onOpen: { shell.push(.goal(goal.id)) }, onMenu: { menuGoal = goal },
                                    onUp: i > 0 && !model.goals.reordering ? { () -> Void in Task { await model.moveGoal(openIndex: i, delta: -1) } } : nil,
                                    onDown: i < open.count - 1 && !model.goals.reordering ? { () -> Void in Task { await model.moveGoal(openIndex: i, delta: 1) } } : nil)
                        }
                        if let fire = view.fire { FireGoalRow(fire: fire, text: text) { model.tab = .risposte } }
                    }
                }
            }
            let stops = text.road(view)
            if !stops.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space4) {
                    GoalSectionHeading(icon: .flag, title: L10n.lookup(italian: "La strada"), color: .bbSwatchBlue)
                    ScrollView(.horizontal) {
                        HStack(alignment: .top, spacing: BBSpacing.space4) {
                            ForEach(stops, id: \.key) { s in
                                VStack(spacing: BBSpacing.space1) {
                                    GoalIcon(iconKey: s.iconKey, colorToken: s.colorToken, diameter: 32)
                                        .background(Circle().fill(Color.bbBackground))
                                    BBText(s.when, style: BBTypography.bodyStrong).multilineTextAlignment(.center)
                                    BBText(s.label, style: BBTypography.caption, color: .bbText3, lineLimit: 2).multilineTextAlignment(.center)
                                }
                                .frame(minWidth: 96, maxWidth: 120)
                            }
                        }
                        .background(alignment: .top) {
                            Rectangle().fill(Color.bbBorder).frame(height: 1).padding(.top, 16)
                        }
                        .padding(.bottom, BBSpacing.space2)
                    }
                    .scrollIndicators(.hidden)
                    BBText(L10n.lookup(italian: "Date al ritmo di oggi, senza contare la crescita degli investimenti assegnati."),
                           style: BBTypography.caption, color: .bbText3)
                }
            }
            if !done.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    GoalSectionHeading(icon: .trophy, title: L10n.lookup(italian: "Raggiunti"), color: .bbPos)
                    VStack(spacing: 0) {
                        ForEach(Array(done.enumerated()), id: \.element.id) { i, goal in
                            GoalRow(goal: goal, text: text, compact: true, onOpen: { shell.push(.goal(goal.id)) }, onMenu: { menuGoal = goal },
                                    onUp: nil, onDown: nil)
                        }
                    }
                }
            }
        }
        .modifier(GoalActionsSheet(model: model, goal: $menuGoal, text: text))
        .bbSheet(isPresented: $barSheet, title: header.title) {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                ForEach(header.segments, id: \.key) { s in
                    HStack(spacing: BBSpacing.space2) {
                        Circle().fill(Color.bbGoalToken(s.colorToken)).frame(width: 10, height: 10)
                        BBText(s.label, style: BBTypography.body)
                        Spacer(minLength: BBSpacing.space2)
                        BBText((s.dashed ? "−" : "") + text.money(s.value), style: BBTypography.bodyStrong).monospacedDigit()
                    }
                    .frame(minHeight: 32)
                }
            }
        }
    }

    /// GOAL-007: capacity header and the stacked bar (tap = segment list).
    @ViewBuilder
    private func capacity(_ header: GoalsCapacityHeader, text: GoalsText) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            (Text(header.title).foregroundColor(.bbForeground)
                + Text(header.requested.map { "\n" + $0 } ?? "").foregroundColor(.bbText2))
                // Web `PAGE_TITLE_FACE` text-[2rem]: the condensed display face, light.
                .bbTextStyle(BBTextStyle.sectionHeading.with(size: 32, lineHeight: 36))
                .fixedSize(horizontal: false, vertical: true)
            BBText(header.explanation, style: BBTypography.body, color: .bbText2)
            let total = header.segments.reduce(0) { $0 + $1.value }
            if total > 0 {
                VStack(spacing: BBSpacing.space1_5) {
                    GeometryReader { geo in
                        let gaps = CGFloat(max(0, header.segments.count - 1)) * 2
                        HStack(spacing: 2) {
                            ForEach(header.segments, id: \.key) { s in
                                let color = Color.bbGoalToken(s.colorToken)
                                let width = max(0, (geo.size.width - gaps) * CGFloat(s.value / total))
                                BBText(text.segmentText(s), style: BBTypography.caption.with(weight: 600), color: s.dashed ? color : .bbBackground, lineLimit: 1)
                                    .padding(.horizontal, BBSpacing.space2)
                                    .frame(width: width, height: 32, alignment: .leading)
                                    .clipped()
                                    .background(s.dashed ? Color.clear : color)
                                    .overlay(s.dashed ? RoundedRectangle(cornerRadius: 0).strokeBorder(color, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])) : nil)
                            }
                        }
                        .clipShape(RoundedRectangle.bb(BBRadius.lg))
                    }
                    .frame(height: 32)
                    .contentShape(Rectangle())
                    .onTapGesture { barSheet = true }
                    .accessibilityElement()
                    .accessibilityLabel(header.segments.map { "\($0.label) \(text.money($0.value))" }.joined(separator: ", "))
                    HStack {
                        BBText("0", style: BBTypography.caption, color: .bbText3)
                        Spacer()
                        BBText(text.money(header.scaleMax), style: BBTypography.caption, color: .bbText3).monospacedDigit()
                    }
                }
            }
        }
    }
}

/// GOAL-008: one goal of the priority list (compact in «Raggiunti»).
private struct GoalRow: View {
    let goal: GoalView
    let text: GoalsText
    let compact: Bool
    let onOpen: () -> Void
    var onMenu: (() -> Void)?
    let onUp: (() -> Void)?
    let onDown: (() -> Void)?

    var body: some View {
        let kind = GoalKind(rawValue: goal.kind) ?? .altro
        let label = text.statusLabel(goal)
        let shift = compact ? nil : text.fireShift(goal)
        let labelColor: Color = goal.status == "in_ritardo" ? .bbSwatchAmberDark : .bbPos
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            Button(action: onOpen) {
                HStack(alignment: .top, spacing: BBSpacing.space3) {
                    GoalIcon(iconKey: kind.iconKey, colorToken: kind.colorToken, diameter: compact ? 32 : 40)
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        let amount = (Text(text.money(goal.current)).font(BBTypography.cardTitle.with(size: compact ? 16 : 18, lineHeight: 28).font).foregroundColor(.bbForeground)
                            + Text(" " + text.tr("di {0}", ["0": text.money(goal.target)])).font(BBTypography.body.font).foregroundColor(.bbText3))
                            .monospacedDigit()
                            .lineLimit(1)
                        // `flex-wrap justify-between`: the amount moves under the name when both do not fit.
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                                BBText(goal.name, style: BBTypography.bodyLarge.with(weight: 500), lineLimit: 1).fixedSize()
                                Spacer(minLength: 0)
                                amount.fixedSize()
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                BBText(goal.name, style: BBTypography.bodyLarge.with(weight: 500), lineLimit: 1)
                                amount
                            }
                        }
                        GoalProgressBar(progress: goal.progress, status: goal.status)
                            .accessibilityLabel(text.tr("Avanzamento di {0}", ["0": goal.name]))
                        VStack(alignment: .leading, spacing: 2) {
                            ((label.map { Text("\($0) · ").font(BBTypography.bodyStrong.font).foregroundColor(goal.status == "raggiunto" || goal.status == "in_linea" ? .bbPos : labelColor) } ?? Text(""))
                                + Text(text.statusSentence(goal)).font(BBTypography.body.font).foregroundColor(.bbText2))
                                .fixedSize(horizontal: false, vertical: true)
                            if let shift {
                                BBText(BBFormat.capitalize(shift) + ".", style: BBTypography.body, color: .bbText3)
                            }
                        }
                        if !compact, !goal.sources.isEmpty {
                            FlowLayout(spacing: BBSpacing.space1_5) {
                                ForEach(goal.sources) { s in
                                    HStack(spacing: BBSpacing.space1_5) {
                                        GoalSourceIcon(kind: s.kind, refId: s.refId, name: s.name, accountColor: s.accountColor,
                                                       accountIcon: s.accountIcon, instrumentType: s.instrumentType, size: 20)
                                        BBText("\(s.name) \(text.money(s.counted))", style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                                    }
                                    .padding(.leading, BBSpacing.space1)
                                    .padding(.trailing, BBSpacing.space2_5)
                                    .padding(.vertical, BBSpacing.space1)
                                    .background(Capsule().fill(Color.bbMuted))
                                }
                            }
                        }
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            VStack(spacing: BBSpacing.space1) {
                if let onMenu { arrow(.ellipsis, label: text.tr("Azioni per {0}", ["0": goal.name]), action: onMenu) }
                if !compact, onUp != nil || onDown != nil {
                    arrow(.arrowUp, label: text.tr("Sposta {0} più in alto", ["0": goal.name]), action: onUp)
                    arrow(.arrowDown, label: text.tr("Sposta {0} più in basso", ["0": goal.name]), action: onDown)
                }
            }
        }
        .padding(.vertical, compact ? BBSpacing.space3 : BBSpacing.space4)
    }

    private func arrow(_ icon: BBIcon, label: String, action: (() -> Void)?) -> some View {
        Button { action?() } label: {
            BBIconView(icon, size: .md, color: .bbForeground)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.md)), translate: false))
        .bbDisabled(action == nil)
        .accessibilityLabel(label)
    }
}

/// GOAL-037 (web #382): a source's icon — the account's own avatar, or the instrument's icon with its logo when there is
/// one; without data, nothing (lists of 32 pt fall back to the group icon).
struct GoalSourceIcon: View {
    let kind: String
    let refId: String
    let name: String
    let accountColor: String?
    let accountIcon: String?
    let instrumentType: String?
    let size: CGFloat
    var fallback = false

    var body: some View {
        if kind == "account" {
            if let accountColor, let accountIcon {
                BBIconBadge(icon: BBIcon.account(accountIcon), color: .bbSwatch(accountColor), diameter: size, iconSize: size * 0.5)
            } else if fallback {
                BBIconBadge(icon: .landmark, color: .bbSwatchTeal, diameter: size, iconSize: size * 0.5)
            }
        } else if let instrumentType {
            InstrumentIconView(instrument: Instrument(id: refId, name: name, type: instrumentType), size: size)
        } else if fallback {
            BBIconBadge(icon: .trendingUp, color: .bbSwatchBlue, diameter: size, iconSize: size * 0.5)
        }
    }
}

/// GOAL-036 (web #382): the «⋯» actions of a row, as a sheet: the same as the detail's buttons; «Elimina» confirms.
private struct GoalActionsSheet: ViewModifier {
    let model: AnalyticsModel
    @Binding var goal: GoalView?
    let text: GoalsText
    @State private var deleting: GoalView?

    func body(content: Content) -> some View {
        content
            .bbSheet(isPresented: Binding(get: { goal != nil }, set: { if !$0 { goal = nil } }), title: goal?.name) {
                if let g = goal {
                    VStack(spacing: 0) {
                        SheetActionRow(icon: .pencil, label: text.tr("Modifica")) {
                            goal = nil
                            model.openGoalForm(GoalFormRequest(goalId: g.id, startStep: .tipo))
                        }
                        if g.achievedAt == nil {
                            SheetActionRow(icon: .piggyBank, label: text.tr("Aggiorna i soldi da parte")) {
                                goal = nil
                                model.openGoalForm(GoalFormRequest(goalId: g.id, startStep: .fonti))
                            }
                        }
                        SheetActionRow(icon: g.achievedAt != nil ? .rotateCcw : .circleCheck,
                                       label: g.achievedAt != nil ? text.tr("Riapri") : text.tr("Segna come raggiunto")) {
                            goal = nil
                            Task { await model.toggleAchieved(g) }
                        }
                        SheetActionRow(icon: .trash2, label: text.tr("Elimina"), destructive: true) {
                            goal = nil
                            model.deleteError = nil
                            DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.05) { deleting = g }
                        }
                    }
                }
            }
            .bbAlertSheet(isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                          title: text.tr("Eliminare «{0}»?", ["0": deleting?.name ?? ""]),
                          description: text.tr("L'obiettivo sparisce dalla lista. I saldi dei conti e gli investimenti non cambiano: le parti assegnate tornano libere."),
                          confirmLabel: text.tr("Elimina")) {
                guard let id = deleting?.id else { return }
                Task { if !(await model.deleteGoal(id)), let error = model.deleteError { model.env.toasts.show(.error, error) } }
            }
    }
}

/// GOAL-011: «Smettere di lavorare» → Risposte.
private struct FireGoalRow: View {
    let fire: GoalsView.Fire
    let text: GoalsText
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                GoalIcon(iconKey: GoalsRules.fireIconKey, colorToken: GoalsRules.fireColorToken)
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                        BBText(text.tr("Smettere di lavorare"), style: BBTypography.bodyLarge.with(weight: 500), lineLimit: 1)
                        Spacer(minLength: 0)
                        (Text(text.money(fire.wealth)).font(BBTypography.cardTitle.with(size: 18, lineHeight: 28).font).foregroundColor(.bbForeground)
                            + Text(" " + text.tr("di {0}", ["0": text.money(fire.target)])).font(BBTypography.body.font).foregroundColor(.bbText3))
                            .monospacedDigit()
                            .lineLimit(1)
                    }
                    AnalyticsProgress(value: min(1, max(0, fire.progress)), height: 6, color: .bbGoalToken(GoalsRules.fireColorToken))
                        .accessibilityLabel(text.tr("Avanzamento verso il traguardo"))
                    BBText(text.fireSentence(fire), style: BBTypography.body, color: .bbText2)
                }
            }
            .padding(.vertical, BBSpacing.space4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Detail (GOAL-027…033)

struct GoalDetailScreen: View {
    let goalId: String
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hidden

    var body: some View {
        let model = shell.analytics
        BBScreen(title: nil, onBack: back, onRefresh: { await model.loadGoals(force: true) }) {
            if let view = model.goals.view {
                if let goal = view.goal(goalId) {
                    GoalDetailContent(model: model, view: view, goal: goal,
                                      text: GoalsText(locale: locale, currency: view.currency, masked: hidden, translate: { L10n.lookup(italian: $0) }))
                } else {
                    EmptyState(icon: .target, title: L10n.lookup(italian: "Obiettivo non trovato"), description: L10n.lookup(italian: "Forse è stato eliminato."),
                               primary: BBStateAction(label: L10n.lookup(italian: "Torna agli obiettivi")) { back?() }, color: .bbSwatchAmber)
                        .padding(.top, BBSpacing.space4)
                }
            } else if model.goals.failed {
                LoadError(message: L10n.lookup(italian: "Impossibile caricare l'obiettivo."), onRetry: { Task { await model.retryGoals() } })
            } else {
                BBSkeleton(height: 288, radius: BBRadius.xl).accessibilityLabel(L10n.loading)
            }
        }
        .task { await model.loadGoals() }
        .modifier(GoalFormPresenter(model: model))
        .bbAlertSheet(isPresented: Binding(get: { model.confirmDeleteGoal == goalId }, set: { if !$0 { model.confirmDeleteGoal = nil } }),
                      title: L10n.lookup(italian: "Eliminare «{0}»?", ["0": model.goals.view?.goal(goalId)?.name ?? ""]),
                      description: L10n.lookup(italian: "L'obiettivo sparisce dalla lista. I saldi dei conti e gli investimenti non cambiano: le parti assegnate tornano libere."),
                      confirmLabel: L10n.lookup(italian: "Elimina")) {
            Task {
                if await model.deleteGoal(goalId) { back?() } else if let error = model.deleteError { model.env.toasts.show(.error, error) }
            }
        }
    }
}

private struct GoalDetailContent: View {
    let model: AnalyticsModel
    let view: GoalsView
    let goal: GoalView
    let text: GoalsText

    var body: some View {
        let kind = GoalKind(rawValue: goal.kind) ?? .altro
        let label = text.statusLabel(goal)
        let tax = goal.sources.reduce(0) { $0 + $1.tax }
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space3) {
                    GoalIcon(iconKey: kind.iconKey, colorToken: kind.colorToken, diameter: 56)
                    BBText(goal.name, style: BBTypography.pageTitle).accessibilityAddTraits(.isHeader)
                }
                MoneyHero(value: goal.current, currency: text.currency)
                BBText(text.targetLine(goal), style: BBTypography.bodyLarge, color: .bbText2)
                GoalProgressBar(progress: goal.progress, status: goal.status, height: 8)
                    .accessibilityLabel(text.tr("Avanzamento di {0}", ["0": goal.name]))
                if let label { BBText(label + ".", style: BBTextStyle.sectionHeading) }
                BBText(text.statusSentence(goal), style: BBTypography.bodyLarge, color: .bbText2)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                GoalSectionHeading(icon: .arrowLeftRight, title: text.tr("Da dove arrivano i soldi"), color: .bbSwatchBlue)
                if goal.sources.isEmpty {
                    BBText(text.tr("Nessun conto o titolo assegnato: l'obiettivo cresce solo con la quota del mese, quando aggiorni quanto hai messo da parte."),
                           style: BBTypography.body, color: .bbText2)
                }
                ForEach([("account", "Liquidità", BBIcon.landmark, Color.bbSwatchTeal), ("instrument", "Investimenti", BBIcon.trendingUp, Color.bbSwatchBlue)], id: \.0) { group in
                    let items = goal.sources.filter { $0.kind == group.0 }
                    if !items.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(text.tr(group.1), style: BBTypography.overline, color: .bbText3).padding(.bottom, BBSpacing.space1_5)
                            ForEach(Array(items.enumerated()), id: \.element.id) { i, s in
                                HStack(spacing: BBSpacing.space3) {
                                    // GOAL-037: the account's avatar or the instrument's icon.
                                    GoalSourceIcon(kind: s.kind, refId: s.refId, name: s.name, accountColor: s.accountColor,
                                                   accountIcon: s.accountIcon, instrumentType: s.instrumentType, size: 32, fallback: true)
                                    VStack(alignment: .leading, spacing: 0) {
                                        BBText(s.name, style: BBTypography.bodyLarge.with(weight: 500), lineLimit: 1)
                                        BBText(text.sourceDetail(s), style: BBTypography.body, color: .bbText3)
                                    }
                                    Spacer(minLength: 0)
                                    BBText(text.money(s.counted), style: BBTypography.cardTitle).monospacedDigit()
                                }
                                .padding(.vertical, BBSpacing.space3)
                            }
                        }
                    }
                }
                if tax > 0 {
                    GoalNote(text.tr("Per i titoli contiamo il valore al netto dell'imposta stimata se vendessi oggi, con l'aliquota del titolo e senza le minusvalenze da compensare: la scheda Tasse fa il calcolo completo."))
                }
            }
            if goal.status != "raggiunto" {
                let impact = text.wealthImpact(goal)
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    GoalSectionHeading(icon: .flag, title: text.tr("Cosa cambia quando lo raggiungi"), color: .bbSwatchAmber)
                    VStack(spacing: BBSpacing.space4) {
                        impactCell(text.tr("Patrimonio"), impact.value, impact.caption)
                        impactCell(text.tr("Smetti di lavorare"), view.fire?.withGoalsYear.map(String.init) ?? "—",
                                   text.fireShift(goal) ?? text.tr("serve sapere spesa e risparmio nelle Risposte"))
                    }
                }
            }
            // Web: the actions wrap as pills, «Elimina» as a quiet red text button.
            FlowLayout(spacing: BBSpacing.space2) {
                BBButton(text.tr("Aggiorna i soldi da parte"), size: .touch, isDisabled: model.goalBusy) {
                    model.openGoalForm(GoalFormRequest(goalId: goal.id, startStep: .fonti))
                }
                BBButton(text.tr("Modifica"), variant: .outline, size: .touch, isDisabled: model.goalBusy) {
                    model.openGoalForm(GoalFormRequest(goalId: goal.id, startStep: .tipo))
                }
                BBButton(goal.achievedAt != nil ? text.tr("Riapri") : text.tr("Segna come raggiunto"), variant: .outline, size: .touch,
                         isDisabled: model.goalBusy) { Task { await model.toggleAchieved(goal) } }
                Button {
                    model.deleteError = nil
                    model.confirmDeleteGoal = goal.id
                } label: {
                    BBText(text.tr("Elimina"), style: BBTypography.button, color: .bbNeg)
                        .padding(.horizontal, BBSpacing.space4)
                        .frame(height: BBLayout.minTouchTarget)
                        .contentShape(Capsule())
                }
                .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(Capsule()), translate: false))
                .bbDisabled(model.goalBusy)
            }
            AnalyticsDisclaimer()
        }
    }

    private func impactCell(_ label: String, _ value: String, _ caption: String) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(label, style: BBTypography.body, color: .bbText2)
            BBText(value, style: BBTypography.amountLarge).monospacedDigit()
            BBText(caption, style: BBTypography.body, color: .bbText3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, BBSpacing.space3)
    }
}

/// `GoalNote`: info icon + text-sm `--text-2`.
struct GoalNote: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        HStack(alignment: .top, spacing: BBSpacing.space2) {
            BBIconView(.info, size: .md, color: .bbText3).padding(.top, 2)
            BBText(text, style: BBTypography.body, color: .bbText2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
