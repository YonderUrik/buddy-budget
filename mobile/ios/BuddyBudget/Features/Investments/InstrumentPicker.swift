import BuddyBudgetKit
import SwiftUI

/// Search state of the instrument picker (SEC-002…009): 300 ms debounce, ≥ 2 characters, create on choose.
@MainActor @Observable
final class InstrumentSearchModel {
    var query = "" { didSet { schedule() } }
    private(set) var result: InstrumentSearchResult?
    private(set) var searching = false
    private(set) var creating = false
    var error: String?
    var filter: InstrumentType?

    @ObservationIgnored private let env: AppEnvironment
    @ObservationIgnored private var task: Task<Void, Never>?

    init(env: AppEnvironment) { self.env = env }

    private func schedule() {
        task?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard InstrumentSearch.isSearchable(q) else {
            result = nil
            searching = false
            return
        }
        searching = true
        task = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard let self, !Task.isCancelled else { return }
            let found = try? await self.env.instruments.search(q)
            guard !Task.isCancelled else { return }
            self.result = found ?? InstrumentSearchResult(marketUnavailable: true)
            self.searching = false
        }
    }

    /// SEC-008 / SEC-009: creates or reuses the instrument.
    func create(_ input: InstrumentCreateInput, deferHistory: Bool) async -> Instrument? {
        creating = true
        error = nil
        defer { creating = false }
        do {
            return try await env.instruments.create(input, deferHistory: deferHistory)
        } catch {
            self.error = (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Qualcosa è andato storto. Riprova.")
            return nil
        }
    }
}

/// Full-screen search (mobile adaptation of the web popover): field focused, «I tuoi strumenti» before typing,
/// known instruments, market groups with type filter chips, «Non lo trovi?» form. Android: InstrumentSearchSheet.
struct InstrumentSearchContent: View {
    let model: InstrumentSearchModel
    let suggestions: [Instrument]
    let currency: String
    var deferHistory = false
    let onChoose: (Instrument) -> Void

    @Environment(\.bbLocale) private var locale

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBTextField(text: $model.query, placeholder: L10n.lookup(italian: "VWCE, Apple, IE00BK5BQT80…"), keyboard: .text,
                        prefix: nil, submitLabel: .search, autofocus: true)
                .accessibilityLabel(L10n.lookup(italian: "Cerca strumento"))
            let searchable = InstrumentSearch.isSearchable(model.query)
            if !searchable {
                if !suggestions.isEmpty {
                    sectionTitle("I tuoi strumenti")
                    ForEach(suggestions) { knownRow($0) }
                }
                BBText(L10n.lookup(italian: suggestions.isEmpty ? "Scrivi almeno 2 caratteri." : "Oppure cercane un altro: scrivi almeno 2 caratteri."),
                       style: BBTypography.body, color: .bbMutedForeground)
            } else {
                if model.searching && model.result == nil {
                    BBText(L10n.lookup(italian: "Ricerca…"), style: BBTypography.body, color: .bbMutedForeground)
                }
                if let result = model.result {
                    results(result)
                }
                sectionTitle("Non lo trovi?")
                ManualInstrumentForm(isin: model.result?.isin, currency: currency, pending: model.creating) { input in
                    Task { if let created = await model.create(input, deferHistory: deferHistory) { onChoose(created) } }
                }
            }
            if let error = model.error {
                BBText(error, style: BBTypography.body, color: .bbDestructive)
            }
        }
    }

    @ViewBuilder private func results(_ result: InstrumentSearchResult) -> some View {
        let known = InstrumentSearch.rankKnown(result.known, suggestions: suggestions)
        let groups = InstrumentSearch.group(result, query: model.query)
        if !known.isEmpty {
            sectionTitle("Già aggiunti")
            ForEach(known) { knownRow($0) }
        }
        if groups.count > 1 {
            ScrollView(.horizontal) {
                HStack(spacing: BBSpacing.space1_5) {
                    filterChip(nil, groups: groups)
                    ForEach(groups) { filterChip($0.type, groups: groups) }
                }
            }
            .scrollIndicators(.hidden)
        }
        let active = model.filter.flatMap { f in groups.contains { $0.type == f } ? f : nil }
        ForEach(groups.filter { active == nil || $0.type == active }) { group in
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                HStack(spacing: BBSpacing.space2) {
                    Circle().fill(Color.bbSwatch(InstrumentIcons.typeSwatch(group.type))).frame(width: 8, height: 8)
                    BBText("\(L10n.lookup(italian: InstrumentIcons.typePlural(group.type)).uppercased()) (\(group.items.count))",
                           style: BBTypography.caption.with(weight: 600))
                }
                .padding(.top, BBSpacing.space2)
                VStack(spacing: 0) {
                    ForEach(group.items) { item in
                        resultButton(title: item.title, detail: item.detail(cryptoCurrency: currency, inWord: L10n.lookup(italian: "in")),
                                     icon: Instrument(id: item.id, name: item.title, type: item.type.rawValue)) {
                            Task {
                                if let created = await model.create(item.createInput(currency: currency, isin: result.isin), deferHistory: deferHistory) {
                                    onChoose(created)
                                }
                            }
                        }
                        .bbDisabled(model.creating)
                    }
                }
                .padding(.leading, BBSpacing.space1)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.bbSwatch(InstrumentIcons.typeSwatch(group.type))).frame(width: 2)
                }
            }
        }
        if result.marketUnavailable {
            BBText(L10n.lookup(italian: "La fonte di ETF, azioni e fondi non risponde in questo momento: riprova tra qualche minuto, oppure aggiungilo qui sotto."),
                   style: BBTypography.body, color: .bbMutedForeground)
        } else if known.isEmpty && groups.isEmpty {
            BBText(L10n.lookup(italian: "Nessun risultato dalle fonti di mercato."), style: BBTypography.body, color: .bbMutedForeground)
        }
    }

    private func sectionTitle(_ source: String) -> some View {
        BBText(L10n.lookup(italian: source).uppercased(), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
            .padding(.top, BBSpacing.space2)
    }

    private func filterChip(_ type: InstrumentType?, groups: [SearchResultGroup]) -> some View {
        let active = model.filter.flatMap { f in groups.contains { $0.type == f } ? f : nil }
        let selected = active == type
        return Button { model.filter = type } label: {
            HStack(spacing: BBSpacing.space1_5) {
                if let type { Circle().fill(Color.bbSwatch(InstrumentIcons.typeSwatch(type))).frame(width: 8, height: 8) }
                BBText(type.map { L10n.lookup(italian: InstrumentIcons.typePlural($0)) } ?? L10n.lookup(italian: "Tutti"),
                       style: BBTypography.caption, color: selected ? .bbBackground : .bbForeground, lineLimit: 1)
            }
            .padding(.horizontal, BBSpacing.space2_5)
            .frame(height: 28)
            .background(Capsule().fill(selected ? Color.bbForeground : Color.clear))
            .overlay(Capsule().strokeBorder(selected ? Color.bbForeground : Color.bbInput, lineWidth: 1))
            .bbHitArea(height: 28)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func knownRow(_ instrument: Instrument) -> some View {
        resultButton(title: instrument.name, detail: [instrument.currency, instrument.isin ?? ""].filter { !$0.isEmpty }.joined(separator: " · "),
                     icon: instrument, remote: true, tag: InstrumentIcons.typeLabel(instrument.kind)) { onChoose(instrument) }
    }

    private func resultButton(title: String, detail: String, icon: Instrument, remote: Bool = false, tag: String? = nil,
                              action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space2_5) {
                InstrumentIconView(instrument: remote ? icon : Instrument(id: "", name: icon.name, type: icon.type), size: 28)
                VStack(alignment: .leading, spacing: 0) {
                    BBText(title, style: BBTypography.body, lineLimit: 1)
                    BBText(detail, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let tag {
                    HStack(spacing: BBSpacing.space1_5) {
                        Circle().fill(Color.bbSwatch(InstrumentIcons.typeSwatch(icon.kind))).frame(width: 8, height: 8)
                        BBText(L10n.lookup(italian: tag), style: BBTypography.caption, lineLimit: 1)
                    }
                    .padding(.horizontal, BBSpacing.space2)
                    .frame(height: 22)
                    .background(Capsule().fill(Color.bbMuted))
                }
            }
            .padding(.horizontal, BBSpacing.space2)
            .frame(minHeight: BBLayout.minTouchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.md)), translate: false))
    }
}

/// «Non lo trovi?» (SEC-009): name, type, ISO currency; a bond with a valid ISIN becomes «solo ISIN».
struct ManualInstrumentForm: View {
    let isin: String?
    let currency: String
    let pending: Bool
    let onCreate: (InstrumentCreateInput) -> Void

    @State private var name = ""
    @State private var type: InstrumentType?
    @State private var code: String?

    var body: some View {
        let kind = type ?? InstrumentSearch.manualDefaultType(isin: isin)
        let currencyText = code ?? currency
        let input = InstrumentSearch.manualInput(name: name, type: kind, currency: currencyText, isin: isin)
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBTextField(text: $name, placeholder: L10n.lookup(italian: "Nome (es. BTP Valore 2029)"))
                .accessibilityLabel(L10n.lookup(italian: "Nome dello strumento"))
            HStack(spacing: BBSpacing.space2) {
                BBSelect(options: InstrumentType.allCases.map { ($0, L10n.lookup(italian: InstrumentIcons.typeLabel($0))) },
                         selection: Binding(get: { kind }, set: { type = $0 }), title: L10n.lookup(italian: "Tipo di strumento"))
                BBTextField(text: Binding(get: { currencyText }, set: { code = String($0.uppercased().prefix(3)) }), keyboard: .email)
                    .frame(width: 80)
                    .accessibilityLabel(L10n.lookup(italian: "Valuta (codice ISO, es. EUR)"))
            }
            BBText(isin != nil && kind == .obbligazione
                   ? L10n.lookup(italian: "I prezzi arriveranno da Borsa Italiana (ISIN {0}).", ["0": isin ?? ""])
                   : L10n.lookup(italian: "Strumento visibile solo a te: i prezzi li inserisci a mano."),
                   style: BBTypography.caption, color: .bbMutedForeground)
            BBButton(L10n.lookup(italian: pending ? "Aggiunta…" : "Aggiungi strumento"), size: .sm, isDisabled: pending || input == nil) {
                if let input { onCreate(input) }
            }
        }
    }
}

/// Picker field of the register form: shows the chosen instrument and opens the search full screen.
struct InstrumentPickerField: View {
    let instrument: Instrument?
    let suggestions: [Instrument]
    let currency: String
    var placeholder = "Cerca per nome, ticker o ISIN"
    var isDisabled = false
    let onChange: (Instrument) -> Void

    @Environment(AppEnvironment.self) private var env
    @State private var open = false
    @State private var search: InstrumentSearchModel?
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Button {
            search = InstrumentSearchModel(env: env)
            open = true
        } label: {
            HStack(spacing: BBSpacing.space2) {
                if let instrument { InstrumentIconView(instrument: instrument, size: 20) }
                BBText(instrument?.name ?? L10n.lookup(italian: placeholder), style: BBTypography.body,
                       color: instrument == nil ? .bbMutedForeground : .bbForeground, lineLimit: 1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
            }
            .padding(.horizontal, BBSpacing.space3)
            .frame(height: 36)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(scheme == .dark ? Color.bbAlphaInput30 : Color.clear))
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbInput, lineWidth: 1))
            .contentShape(Rectangle())
            .bbHitArea(height: 36)
        }
        .buttonStyle(.plain)
        .bbDisabled(isDisabled)
        .formDialog(isPresented: $open) {
            if let search {
                InstrumentSearchContent(model: search, suggestions: suggestions, currency: currency) { chosen in
                    onChange(chosen)
                    open = false
                }
                .padding(.top, BBSpacing.space8)
            }
        }
    }
}
