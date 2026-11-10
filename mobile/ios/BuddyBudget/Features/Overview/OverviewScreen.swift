import BuddyBudgetKit
import SwiftUI

/// Panoramica (02-overview): greeting with the date, «Novità» and the voice sentences, renewal banner, then the
/// checklist, net worth, composition, month, dues, goals and investments in one column (mobile adaptation).
/// Twin of `OverviewScreen` on Android.
struct OverviewScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    @State private var now = Date()

    var body: some View {
        let model = shell.overview
        BBScreen(title: greeting, onRefresh: { await model.refresh() }, titleStyle: .greetingTitle) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                if OverviewDebug.shows("header") {
                    OverviewHeader(model: model, dateLabel: Greeting.dateLabel(CalendarDate.of(now, in: .current), locale: locale))
                        .padding(.top, -BBSpacing.space3)
                }
                if OverviewDebug.shows("header"), let alerts = model.view?.renewalAlerts, !alerts.isEmpty {
                    OverviewRenewalBanner(alerts: alerts) { shell.open(path: "/liquidita/conti?rinnova=panoramica") }
                }
                switch model.content {
                case .loading:
                    OverviewSkeleton()
                case .failed:
                    LoadError(message: L10n.lookup(italian: "Impossibile caricare i dati della panoramica."), onRetry: model.retry)
                case .empty:
                    EmptyOverviewLayout(model: model)
                case .loaded(let view):
                    LoadedOverviewLayout(model: model, view: view)
                }
            }
        }
        .task {
            now = Date()
            await model.activate()
            #if DEBUG
            model.applyDebugLaunch()
            #endif
        }
        .onChange(of: shell.tab) { _, tab in
            guard tab == .overview else { return }
            now = Date()
            Task { await model.activate() }
        }
    }

    /// OV-001: device hour, first name from the session.
    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: now)
        return Greeting.title(greeting: L10n.lookup(italian: Greeting.source(hour: hour)), name: env.session.bootstrap?.user.name)
    }
}

// MARK: - Header

/// Date with the «Novità» chip (OV-002, SHELL-049), then the voice sentences (OV-003/004, masked figures OV-021).
private struct OverviewHeader: View {
    let model: OverviewModel
    let dateLabel: String
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            FlowRow(spacing: BBSpacing.space3, lineSpacing: BBSpacing.space1) {
                BBText(dateLabel, style: BBTypography.body, color: .bbMutedForeground)
                if let entry = model.whatsNewEntry {
                    WhatsNewChip(entry: entry, model: model)
                }
            }
            if let lines = model.view?.voice, !lines.isEmpty {
                voice(OverviewVoice.segments(lines, hideAmounts: hideAmounts))
                    .accessibilityElement(children: .combine)
            }
        }
    }

    private func voice(_ segments: [OverviewView.VoiceSegment]) -> some View {
        let regular = BBTypography.bodyLarge.with(size: 18, lineHeight: 29)
        let strong = BBTextStyle(role: .sans, size: 18, lineHeight: 29, weight: 500, letterSpacingEm: 0, tabularNums: true,
                                 uppercase: false, anchor: .body)
        var text = Text(verbatim: "")
        for segment in segments {
            if segment.strong {
                // Figures never break inside (web `whitespace-nowrap`).
                text = text + Text(verbatim: segment.text.replacingOccurrences(of: " ", with: "\u{00A0}"))
                    .font(strong.font).foregroundColor(.bbForeground)
            } else {
                text = text + Text(verbatim: segment.text).font(regular.font).foregroundColor(.bbText2)
            }
        }
        return text.lineSpacing(regular.lineHeight - regular.size * 1.2)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - States

/// OV-005: three blocks while loading (h-80, h-36, h-28).
private struct OverviewSkeleton: View {
    var body: some View {
        VStack(spacing: BBSpacing.space6) {
            BBSkeleton(height: 320, radius: BBRadius.xl)
            BBSkeleton(height: 144, radius: BBRadius.xl)
            BBSkeleton(height: 112, radius: BBRadius.xl)
        }
        .accessibilityElement()
        .accessibilityLabel(L10n.loading)
    }
}

/// OV-007: checklist forced visible (or «Nessun conto ancora»), then the demo offer.
private struct EmptyOverviewLayout: View {
    let model: OverviewModel
    @Environment(ShellModel.self) private var shell

    var body: some View {
        // OV-007: one column with the checklist forced visible (sample data beside the next step), or «Nessun conto ancora».
        if let start = model.start {
            if StartChecklist.isVisible(start, forced: true) {
                StartChecklistSection(model: model, status: start, forced: true)
            }
        } else {
            EmptyState(icon: .wallet, title: L10n.lookup(italian: "Nessun conto ancora"),
                       description: L10n.lookup(italian: "Aggiungi un conto per vedere il tuo patrimonio netto."),
                       primary: BBStateAction(label: L10n.lookup(italian: "Crea un conto")) {
                           shell.open(path: "/liquidita/conti?nuovo=1")
                       })
        }
    }
}

/// Full layout (OV-008…036), phone order: checklist, chart, composition, month, dues, goals, investments.
private struct LoadedOverviewLayout: View {
    let model: OverviewModel
    let view: OverviewView

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            if let start = model.start, StartChecklist.isVisible(start, forced: false), OverviewDebug.shows("checklist") {
                StartChecklistSection(model: model, status: start, forced: false)
            }
            if OverviewDebug.shows("chart") { NetWorthCard(model: model, view: view) }
            VStack(alignment: .leading, spacing: BBSpacing.space10) {
                if OverviewDebug.shows("composition") { CompositionSection(model: model, view: view) }
                if OverviewDebug.shows("month") { MonthPaceSection(view: view) }
                VStack(alignment: .leading, spacing: BBSpacing.space8) {
                    if OverviewDebug.shows("dues") { UpcomingDuesSection(view: view) }
                    if OverviewDebug.shows("goals") { GoalsSection(model: model) }
                    if let investments = view.investments {
                        InvestmentsPulseSection(pulse: InvestmentsPulse(investments), currency: view.currency)
                    }
                }
            }
            .padding(.top, OverviewDebug.shows("chart") ? BBSpacing.space5 : 0)
        }
    }
}

// MARK: - «Primi passi» (OV-033…048, web #444/#452)

/// «Primi passi»: the next step alone in a filled block with its main action (sample data beside it for a new user,
/// «Non mi serve» for every step but the account), the other steps as a list that ticks itself, and
/// «Cambia cosa vuoi tenere sotto controllo». Twin of `StartChecklistSection` on Android.
struct StartChecklistSection: View {
    let model: OverviewModel
    let status: StartStatus
    /// Empty layout: shown even if dismissed, no close button (OV-035).
    let forced: Bool
    @Environment(ShellModel.self) private var shell
    @State private var focusOpen = false

    var body: some View {
        let nextId = StartChecklist.nextStep(status)
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            HStack(alignment: .top, spacing: BBSpacing.space2) {
                VStack(alignment: .leading, spacing: BBSpacing.space1) {
                    OverviewSectionHeading(icon: .listChecks, title: L10n.lookup(italian: "Primi passi"), color: .bbSwatchTeal)
                    let line = StartChecklist.statusLine(status)
                    BBText(L10n.lookup(italian: line.source, line.values), style: BBTypography.body, color: .bbText2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !forced {
                    BBIconButton(icon: .x, accessibilityLabel: L10n.lookup(italian: "Nascondi i primi passi")) {
                        Task { await model.dismissChecklist() }
                    }
                    .bbDisabled(model.dismissingChecklist)
                    .padding(.trailing, -BBSpacing.space2)
                }
            }
            if let nextId { NextStepBlock(model: model, step: model.step(nextId), forced: forced) }
            let rest = status.askedSteps.filter { $0 != nextId }
            if !rest.isEmpty {
                VStack(spacing: 0) {
                    ForEach(rest, id: \.self) { id in
                        StepRow(step: model.step(id), state: StartChecklist.rowState(status, id),
                                onCta: { shell.open(path: model.step(id).path) }, onRestore: { model.setSkipped(id, skipped: false) })
                    }
                }
            }
            BBButton(L10n.lookup(italian: "Cambia cosa vuoi tenere sotto controllo"), variant: .link, size: .touch) { focusOpen = true }
        }
        .bbSheet(isPresented: $focusOpen, title: L10n.lookup(italian: "Cosa vuoi tenere sotto controllo?")) {
            FocusSheet(model: model, status: status) { focusOpen = false }
        }
    }
}

/// OV-045: the next step in a filled block; OV-048 acknowledgement above it.
private struct NextStepBlock: View {
    let model: OverviewModel
    let step: StartStepDefinition
    let forced: Bool
    @Environment(ShellModel.self) private var shell

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            if !model.acknowledged.isEmpty {
                HStack(spacing: BBSpacing.space2) {
                    BBIconView(.check, size: .md, color: .bbPos)
                    BBText(model.acknowledged.map { L10n.lookup(italian: model.step($0).done) }.joined(separator: " · "),
                           style: BBTypography.bodyStrong, color: .bbPos)
                }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.lookup(italian: "Prossimo passo"), style: BBTypography.body, color: .bbText2)
                BBText(L10n.lookup(italian: step.title), style: .screenTitle)
                BBText(L10n.lookup(italian: step.description), style: BBTypography.bodyLarge, color: .bbText2)
            }
            FlowRow(spacing: BBSpacing.space2, lineSpacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: step.cta), size: .touch) { shell.open(path: step.path) }
                if forced {
                    BBButton(model.demoStarting ? L10n.lookup(italian: "Preparo l'esempio…") : L10n.lookup(italian: "Prima prova con dati d'esempio"),
                             variant: .ghost, size: .touch, isDisabled: model.demoStarting) {
                        Task { await model.startDemo() }
                    }
                }
                if StartChecklist.canSkip(step.id) {
                    BBButton(L10n.lookup(italian: "Non mi serve"), variant: .ghost, size: .touch, isDisabled: model.updatingStart) {
                        model.setSkipped(step.id, skipped: true)
                    }
                }
            }
            if forced, let error = model.demoStartError {
                BBText(error, style: BBTypography.body, color: .bbNeg)
            }
        }
        .padding(BBSpacing.space5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.radius4xl).fill(Color.bbCard))
    }
}

private struct StepRow: View {
    let step: StartStepDefinition
    let state: StartChecklist.RowState
    let onCta: () -> Void
    let onRestore: () -> Void

    var body: some View {
        let done = state == .done
        HStack(spacing: BBSpacing.space3) {
            ZStack {
                Circle().fill(done ? Color.bbPrimary : .clear)
                Circle().strokeBorder(done ? Color.bbPrimary : Color.bbBorder, lineWidth: 1)
                if done { BBIconView(.check, size: .md, color: .bbPrimaryForeground) }
            }
            .frame(width: 28, height: 28)
            .accessibilityHidden(true)
            BBText(state == .skipped ? "\(L10n.lookup(italian: step.title)) · \(L10n.lookup(italian: "Saltato"))" : L10n.lookup(italian: step.title),
                   style: state == .todo ? BBTypography.bodyStrong : BBTypography.body, color: state == .todo ? .bbForeground : .bbText2)
                .strikethrough(done, color: .bbText2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityValue(done ? L10n.lookup(italian: "Fatto") : "")
            switch state {
            case .skipped: BBButton(L10n.lookup(italian: "Rimetti"), variant: .link, size: .touch, action: onRestore)
            case .todo: BBButton(L10n.lookup(italian: step.cta), variant: .link, size: .touch, action: onCta)
            case .done: EmptyView()
            }
        }
        .frame(minHeight: 48)
    }
}

/// OV-047 / AUTH-058: «Cosa vuoi tenere sotto controllo?» as a sheet, preselected with the saved answer.
private struct FocusSheet: View {
    let model: OverviewModel
    let onClose: () -> Void
    @State private var value: [StartFocus]

    init(model: OverviewModel, status: StartStatus, onClose: @escaping () -> Void) {
        self.model = model
        self.onClose = onClose
        _value = State(initialValue: (status.focus ?? []).compactMap(StartFocus.init(rawValue:)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.lookup(italian: "I primi passi cambiano con la tua scelta. Senza nessuna scelta restano i quattro di partenza."),
                   style: BBTypography.body, color: .bbText2)
            FocusPicker(options: model.focusOptions, value: $value, isDisabled: model.updatingStart)
            if let error = model.focusError { BBText(error, style: BBTypography.body, color: .bbNeg) }
            VStack(spacing: BBSpacing.space2) {
                BBButton(model.updatingStart ? L10n.lookup(italian: "Salvataggio in corso…") : L10n.lookup(italian: "Salva"), size: .touch,
                         fullWidth: true, isLoading: model.updatingStart) {
                    Task { if await model.saveFocus(value) { onClose() } }
                }
                BBButton(L10n.lookup(italian: "Annulla"), variant: .ghost, size: .touch, fullWidth: true, action: onClose)
            }
        }
    }
}

/// The four answers as toggle tiles (several at once, none allowed); shared with onboarding (AUTH-058).
struct FocusPicker: View {
    let options: [StartFocus]
    @Binding var value: [StartFocus]
    var isDisabled = false

    var body: some View {
        VStack(spacing: BBSpacing.space3) {
            ForEach(options, id: \.self) { option in
                let selected = value.contains(option)
                Button {
                    if selected { value.removeAll { $0 == option } } else { value.append(option) }
                } label: {
                    HStack(alignment: .top, spacing: BBSpacing.space3) {
                        BBIconView(BBIcon.forKey(option.iconKey) ?? .wallet, size: .lg, color: selected ? .bbPrimary : .bbText2)
                            .padding(.top, 2)
                        VStack(alignment: .leading, spacing: 0) {
                            BBText(L10n.lookup(italian: option.title), style: BBTypography.bodyStrong)
                            BBText(L10n.lookup(italian: option.description), style: BBTypography.body, color: .bbText2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        ZStack {
                            Circle().fill(selected ? Color.bbPrimary : .clear)
                            Circle().strokeBorder(selected ? Color.bbPrimary : Color.bbBorder, lineWidth: 1)
                            if selected { BBIconView(.check, size: .sm, color: .bbPrimaryForeground) }
                        }
                        .frame(width: 24, height: 24)
                    }
                    .padding(BBSpacing.space4)
                    .background(RoundedRectangle.bb(BBRadius.xl).fill(selected ? Color.bbAccent : Color.bbCard))
                    .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(selected ? Color.bbPrimary : Color.bbBorder, lineWidth: selected ? 2 : 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .bbDisabled(isDisabled)
                .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L10n.lookup(italian: "Cosa vuoi tenere sotto controllo?"))
    }
}

// MARK: - Renewal banner (OV-029)

/// Bank-connection renewal alert (`RenewalBanner` of the Accounts area, Overview variant linking to Conti).
struct OverviewRenewalBanner: View {
    let alerts: [OverviewView.RenewalAlert]
    let onRenew: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: BBSpacing.space3) {
            BBIconView(.triangleAlert, points: 18, color: .bbDestructive)
            VStack(alignment: .leading, spacing: 2) {
                ForEach(alerts, id: \.connectionId) { BBText($0.message, style: BBTypography.body) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BBButton(L10n.lookup(italian: "Rinnova"), size: .sm, action: onRenew)
        }
        .padding(BBSpacing.space3)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbDestructive.opacity(0.1)))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbDestructive.opacity(0.3), lineWidth: 1))
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Shared bits

/// Overview section heading (`SectionHeading`): 36 tinted circle with an 18 icon, title text-lg, optional link.
struct OverviewSectionHeading: View {
    let icon: BBIcon
    let title: String
    let color: Color
    var linkLabel: String?
    var onLink: (() -> Void)?

    var body: some View {
        // #427: the display-face title alone (`icon`/`color` kept for call sites, not drawn).
        HStack(alignment: .center, spacing: BBSpacing.space3) {
            BBText(title, style: .sectionHeading).accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            if let linkLabel, let onLink {
                Button(action: onLink) {
                    HStack(spacing: BBSpacing.space1) {
                        BBText(linkLabel, style: .link, color: .bbPrimary)
                        BBIconView(.arrowRight, size: .md, color: .bbPrimary)
                    }
                    .padding(.horizontal, BBSpacing.space2)
                    .frame(minHeight: BBLayout.minTouchTarget)
                    .contentShape(Rectangle())
                }
                .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                .padding(.trailing, -BBSpacing.space2)
            }
        }
    }
}

extension Color {
    /// Color of an Overview token (`primary`, `pos`, `neg`, `swatch-*`) as returned by BuddyBudgetKit.
    static func bbOverviewToken(_ token: String) -> Color {
        switch token {
        case "primary": .bbPrimary
        case "pos": .bbPos
        case "neg": .bbNeg
        default: BBSwatch.color(forKey: token.replacingOccurrences(of: "swatch-", with: ""))
        }
    }
}

/// DEBUG-only `-BBFrom <section>`: start the screen at a section (header, checklist, chart, composition, month, dues,
/// goals) so long-screen screenshots are deterministic on both platforms. Always true in release.
@MainActor
enum OverviewDebug {
    static let order = ["header", "checklist", "chart", "composition", "month", "dues", "goals"]

    static func shows(_ section: String) -> Bool {
        #if DEBUG
        guard let from = DebugLaunch.value("-BBFrom"), let start = order.firstIndex(of: from),
              let index = order.firstIndex(of: section) else { return true }
        return index >= start
        #else
        return true
        #endif
    }
}
