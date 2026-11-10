import BuddyBudgetKit
import SwiftUI

// Building blocks shared by the Investimenti tabs and the security page. Android: InvestmentsComponents.kt.

/// Web `PanelSection`: tinted icon + title (+ link or trailing control), optional description, then the content
/// directly on the page.
struct PanelSection<Content: View, Action: View>: View {
    let title: String
    var icon: BBIcon
    var color: Color = .bbPrimary
    var description: String?
    var linkLabel: String?
    var onLink: (() -> Void)?
    let action: Action
    let content: Content

    init(title: String, icon: BBIcon, color: Color = .bbPrimary, description: String? = nil, linkLabel: String? = nil,
         onLink: (() -> Void)? = nil, @ViewBuilder action: () -> Action, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.color = color
        self.description = description
        self.linkLabel = linkLabel
        self.onLink = onLink
        self.action = action()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(spacing: BBSpacing.space3) {
                BBText(title, style: .sectionHeading).accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                action.fixedSize(horizontal: true, vertical: false)
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
            if let description {
                BBText(description, style: BBTypography.body, color: .bbMutedForeground)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension PanelSection where Action == EmptyView {
    init(title: String, icon: BBIcon, color: Color = .bbPrimary, description: String? = nil, linkLabel: String? = nil,
         onLink: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.init(title: title, icon: icon, color: color, description: description, linkLabel: linkLabel, onLink: onLink,
                  action: { EmptyView() }, content: content)
    }
}

/// Year segments beside a section title (web phone layout): inline up to this many options, else a scrolling row below.
enum TitleSegments {
    static let maxInline = 3
}

/// A sentence made of runs (strong amounts, positive / negative / muted parts).
struct RunsText: View {
    let runs: [InvestmentsTextRun]
    var style: BBTextStyle = BBTypography.bodyLarge

    var body: some View {
        runs.reduce(Text(verbatim: "")) { partial, run in
            let piece = Text(verbatim: run.text)
            switch run.style {
            case .plain: return partial + piece.foregroundColor(.bbForeground)
            case .strong: return partial + piece.fontWeight(.semibold).foregroundColor(.bbForeground)
            case .pos: return partial + piece.fontWeight(.semibold).foregroundColor(.bbPos)
            case .neg: return partial + piece.fontWeight(.semibold).foregroundColor(.bbNeg)
            case .muted: return partial + piece.foregroundColor(.bbMutedForeground)
            }
        }
        .bbTextStyle(style)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Instrument tile (web `InstrumentIcon`): issuer / name initials on the type colour @ 16 %; stocks and known fund
/// issuers try the server logo (`/api/instruments/{id}/logo`) on a white tile.
struct InstrumentIconView: View {
    let instrument: Instrument
    var size: CGFloat = 36
    var onRemoteLogo: (() -> Void)?

    @Environment(\.bbLogoLoader) private var loader
    @State private var image: UIImage?

    var body: some View {
        let spec = InstrumentIcons.spec(type: instrument.kind, name: instrument.name)
        let color = Color.bbSwatch(spec.swatch)
        let radius = size >= 36 ? BBRadius.lg : BBRadius.md
        ZStack {
            if let image {
                RoundedRectangle.bb(radius).fill(Color.white)
                Image(uiImage: image).resizable().scaledToFit().padding(size * 0.18)
                RoundedRectangle.bb(radius).strokeBorder(Color.bbBorder, lineWidth: 1)
            } else {
                RoundedRectangle.bb(radius).fill(color.opacity(0.16))
                BBText(spec.initials, style: BBTypography.bodyStrong.with(size: size >= 36 ? 14 : 12, weight: 600), color: color)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .task(id: instrument.id) {
            guard image == nil, let loader, InstrumentIcons.wantsRemoteLogo(type: instrument.kind, name: instrument.name) else { return }
            if let data = await loader.data(for: "/api/instruments/\(instrument.id)/logo"), let decoded = UIImage(data: data) {
                image = decoded
                onRemoteLogo?()
            }
        }
    }
}

/// Period selector of Portafoglio and Performance (INV-016/017): the shared `PeriodSelector` (#408) with the presets on
/// one line and «Personalizzato» as the calendar button opening the range sheet.
struct InvestmentsPeriodSelector: View {
    let period: InvestmentsPeriod
    let range: ChartRange
    let today: String
    let onPeriod: (InvestmentsPeriod) -> Void
    let onApply: (ChartRange) -> Void

    var body: some View {
        PeriodSelector(options: InvestmentsPeriod.allCases.filter { $0 != .custom }.map { ($0, L10n.lookup(italian: $0.label)) },
                       selection: Binding(get: { period }, set: { if $0 != .custom { onPeriod($0) } }),
                       accessibilityLabel: L10n.lookup(italian: "Periodo del grafico"),
                       custom: PeriodCustom(value: .custom, range: DateKeyRange(from: range.from, to: range.to), max: today,
                                            validate: { r in
                                                InvestmentsRules.isValidRange(ChartRange(from: r.from, to: r.to), today: today) ? nil
                                                    : L10n.lookup(italian: "Scegli date valide, in ordine e non successive a oggi.")
                                            },
                                            onApply: { r in onApply(ChartRange(from: r.from, to: r.to)) }))
    }
}

/// INV-008: «Tutti i broker» / «Broker: n di m» chip and its sheet.
struct BrokerSelector: View {
    let model: InvestmentsModel
    let brokers: [InvestmentsView.Broker]
    @State private var open = false

    var body: some View {
        let chip = model.state.brokerChip(brokers)
        let filtered = !model.state.excludedBrokers.isEmpty
        VStack(alignment: .trailing, spacing: BBSpacing.space2) {
            if brokers.allSatisfy({ model.state.excludedBrokers.contains($0.id) }) {
                BBText(L10n.lookup(italian: "Nessun broker selezionato: riattivane uno per vedere i suoi investimenti."),
                       style: BBTypography.body, color: .bbMutedForeground)
            }
            Button { open = true } label: {
                HStack(spacing: BBSpacing.space1_5) {
                    BBIconView(.landmark, points: 14, color: filtered ? .bbPrimary : .bbForeground)
                    BBText(L10n.lookup(italian: chip.source, chip.values), style: BBTypography.body,
                           color: filtered ? .bbPrimary : .bbForeground, lineLimit: 1)
                }
                .padding(.horizontal, BBSpacing.space3)
                .frame(height: 32)
                .background(Capsule().fill(filtered ? Color.bbAlphaPrimary10 : Color.clear))
                .overlay(Capsule().strokeBorder(filtered ? Color.bbPrimary.opacity(0.4) : Color.bbBorder, lineWidth: 1))
                .bbHitArea(height: 32)
            }
            .buttonStyle(BBPressableStyle(translate: false))
            .accessibilityLabel(L10n.lookup(italian: "Scegli i broker inclusi nei numeri"))
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .bbSheet(isPresented: $open, title: L10n.lookup(italian: "Broker inclusi nei numeri")) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                ForEach(brokers) { broker in
                    let on = !model.state.excludedBrokers.contains(broker.id)
                    Button { model.toggleBroker(broker.id) } label: {
                        HStack(spacing: BBSpacing.space3) {
                            BBCheckbox(isOn: .constant(on), accessibilityLabel: L10n.lookup(italian: broker.label))
                                .allowsHitTesting(false)
                            BBText(L10n.lookup(italian: broker.label), style: BBTypography.bodyLarge)
                            Spacer(minLength: 0)
                        }
                        .frame(minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                BBText(L10n.lookup(italian: "Vale per totali, posizioni, performance, proventi, tasse e operazioni. Gli import restano salvati e il patrimonio generale non cambia."),
                       style: BBTypography.caption, color: .bbMutedForeground)
                if filtered {
                    BBButton(L10n.lookup(italian: "Mostra tutti"), variant: .ghost, size: .sm) { model.showAllBrokers() }
                }
            }
        }
    }
}

/// INV-010: loading / error / filtered-empty / empty states of a view-gated tab.
struct InvestmentsGateView<Content: View>: View {
    let gate: InvestmentsGate
    let model: InvestmentsModel
    var errorMessage = "Impossibile caricare gli investimenti."
    let onRetry: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        switch gate {
        case .loading:
            VStack(spacing: BBSpacing.space6) {
                BBSkeleton(height: 160, radius: BBRadius.xl)
                BBSkeleton(height: 288, radius: BBRadius.xl)
            }
            .accessibilityLabel(L10n.loading)
        case .failed:
            LoadError(message: L10n.lookup(italian: errorMessage), onRetry: onRetry)
        case .emptyFiltered:
            VStack(spacing: BBSpacing.space3) {
                BBText(L10n.lookup(italian: "Nessuna operazione per i broker selezionati."), style: BBTypography.bodyLarge)
                    .multilineTextAlignment(.center)
                BBButton(L10n.lookup(italian: "Mostra tutti i broker"), variant: .outline) { model.showAllBrokers() }
            }
            .frame(maxWidth: .infinity)
            .padding(BBSpacing.space6)
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
        case .empty:
            EmptyState(icon: .trendingUp, title: L10n.lookup(italian: "Registra il tuo primo investimento"),
                       description: L10n.lookup(italian: "Cerca uno strumento per nome, ticker o ISIN (ETF, azioni, BTP, fondi, crypto) e inserisci l'acquisto: valore e guadagno si aggiornano da soli con i prezzi di chiusura."),
                       primary: BBStateAction(label: L10n.lookup(italian: "Registra un acquisto")) { model.openRegister() },
                       secondary: BBStateAction(label: L10n.lookup(italian: "Importa da file CSV")) { model.openImport?() })
        case .content:
            content()
        }
    }
}

/// Label / value row with a bottom border (web `<dl>` rows).
struct InvestmentsValueRow: View {
    let label: String
    let value: String
    var valueColor: Color = .bbForeground
    var strong = false
    var showsDivider = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space4) {
                BBText(label, style: strong ? BBTypography.bodyStrong : BBTypography.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BBText(value, style: strong ? BBTypography.bodyStrong.with(size: 16, lineHeight: 24) : BBTypography.body, color: valueColor)
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, BBSpacing.space2_5)
        }
    }
}

/// Small stat: caption label over a big value (web `<dt>`/`<dd>` with font-heading text-2xl).
struct InvestmentsStat: View {
    let label: String
    let value: String
    var valueColor: Color = .bbForeground
    var note: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(label, style: BBTypography.body, color: .bbMutedForeground)
            BBText(value, style: BBTypography.statValue.with(size: 24, lineHeight: 32), color: valueColor, lineLimit: 1)
                .minimumScaleFactor(0.7)
            if let note { BBText(note, style: BBTypography.caption, color: .bbMutedForeground) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Collapsible block (web `Disclosure` / `RiskDetails`): chevron title row, closed by default.
struct InvestmentsDisclosure<Content: View>: View {
    let title: String
    @State var open = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            Button { withAnimation(.easeOut(duration: BBMotion.durationFast)) { open.toggle() } } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
                        .rotationEffect(.degrees(open ? 180 : 0))
                    BBText(title, style: BBTypography.bodyStrong)
                    Spacer(minLength: 0)
                }
                .frame(minHeight: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(open ? .isSelected : [])
            if open { content() }
        }
    }
}

/// Info «i» that opens the explanation as a bottom sheet (mobile adaptation of the web popovers).
struct InfoHintButton: View {
    let title: String
    let text: String
    @State private var open = false

    var body: some View {
        Button { open = true } label: {
            BBIconView(.info, points: 14, color: .bbMutedForeground).bbHitArea(height: 14, width: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .bbSheet(isPresented: $open, title: title) {
            BBText(text, style: BBTypography.body, color: .bbText2)
        }
    }
}

extension Color {
    /// `--pos` / `--neg` by sign (0 counts as positive, as the web).
    static func bbSigned(_ value: Double?) -> Color {
        guard let value else { return .bbMutedForeground }
        return value < 0 ? .bbNeg : .bbPos
    }
}
