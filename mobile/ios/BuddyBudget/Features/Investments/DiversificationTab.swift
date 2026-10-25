import BuddyBudgetKit
import SwiftUI

/// Investimenti › Diversificazione (INV-045…055): composition, look-through exposure with sources and corrections,
/// target allocation with the next contribution, overlaps and correlations. Android: DiversificationTab.kt.
struct DiversificationTab: View {
    let model: InvestmentsModel

    var body: some View {
        let query = model.state.baseQuery
        InvestmentsGateView(gate: model.gate(query, countsCash: false), model: model, onRetry: { Task { await model.loadView(query) } }) {
            if let view = model.views[query] {
                VStack(alignment: .leading, spacing: BBSpacing.space10) {
                    if debugShows(0) { InvCompositionSection(view: view) }
                    if debugShows(1), !view.analysis.exposureRows.isEmpty { ExposureSection(model: model, view: view) }
                    if debugShows(2) { AllocationSection(model: model, view: view) }
                    if view.analysis.exposureRows.count >= 2 { OverlapSection(view: view) }
                }
            }
        }
    }
}

// MARK: - Composizione (INV-045)

private struct InvCompositionSection: View {
    let view: InvestmentsView
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let foreign = view.currencyExposure
        let main = view.byCurrency.first?.key ?? view.currency
        let topType = view.byType.first
        PanelSection(title: L10n.lookup(italian: "Composizione"), icon: .chartPie) {
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                group(title: "Per tipo", slices: view.byType,
                      insight: topType.map { L10n.lookup(italian: "Soprattutto {0} ({1}%).", ["0": L10n.lookup(italian: InstrumentIcons.typePlural(InstrumentType(rawValue: $0.key) ?? .etf)), "1": String(Int(JSNumber.round($0.share * 100)))]) },
                      color: { key, _ in Color.bbSwatch(InstrumentIcons.typeSwatch(InstrumentType(rawValue: key) ?? .etf)) },
                      label: { L10n.lookup(italian: InstrumentIcons.typePlural(InstrumentType(rawValue: $0) ?? .etf)) })
                group(title: "Per valuta", slices: view.byCurrency,
                      insight: view.byCurrency.isEmpty ? nil : (foreign < 0.05
                          ? L10n.lookup(italian: "Quasi tutto in {0}: il cambio non sposta il valore.", ["0": main])
                          : L10n.lookup(italian: "Il {0}% è in altre valute: il cambio muove il valore anche a mercati fermi.", ["0": String(Int(JSNumber.round(foreign * 100)))])),
                      color: { _, i in Color.bbSwatch(ExposureKeys.currencyColors[i % ExposureKeys.currencyColors.count]) },
                      label: { $0 })
            }
        }
    }

    private func group(title: String, slices: [InvestmentsView.Slice], insight: String?, color: @escaping (String, Int) -> Color,
                       label: @escaping (String) -> String) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: 2) {
                BBText(L10n.lookup(italian: title), style: BBTypography.bodyStrong)
                if let insight { BBText(insight, style: BBTypography.body, color: .bbMutedForeground) }
            }
            if slices.isEmpty {
                BBText(L10n.lookup(italian: "Nessun valore da mostrare."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                StackedBar(parts: slices.enumerated().map { (color($0.element.key, $0.offset), $0.element.share) }, height: 12)
                VStack(spacing: BBSpacing.space1_5) {
                    ForEach(Array(slices.enumerated()), id: \.element.key) { i, slice in
                        HStack(spacing: BBSpacing.space2) {
                            Circle().fill(color(slice.key, i)).frame(width: 10, height: 10)
                            BBText(label(slice.key), style: BBTypography.body).frame(maxWidth: .infinity, alignment: .leading)
                            AmountText(value: slice.value, currency: view.currency, maximumFractionDigits: 0, style: BBTypography.body)
                                .foregroundStyle(Color.bbMutedForeground)
                            BBText(ExposureKeys.share(slice.share, locale: locale), style: BBTypography.bodyStrong).monospacedDigit()
                                .frame(width: 52, alignment: .trailing)
                        }
                    }
                }
            }
        }
    }
}

/// Horizontal bar split in coloured parts (weights need not sum to 1).
struct StackedBar: View {
    let parts: [(Color, Double)]
    var height: CGFloat = 8

    var body: some View {
        GeometryReader { proxy in
            let total = max(parts.reduce(0) { $0 + max(0, $1.1) }, 0.0001)
            let gaps = CGFloat(max(0, parts.count - 1)) * 2
            HStack(spacing: 2) {
                ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                    Rectangle().fill(part.0).frame(width: max(1, (proxy.size.width - gaps) * CGFloat(max(0, part.1) / total)))
                }
            }
            .clipShape(Capsule())
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

// MARK: - Diversificazione (INV-046…048)

private struct ExposureSection: View {
    let model: InvestmentsModel
    let view: InvestmentsView
    @State private var editing: InvestmentsView.ExposureRow?
    @State private var showAllSources = false

    var body: some View {
        let analysis = view.analysis
        let worst = min(analysis.areas.classifiedShare, analysis.sectors.classifiedShare)
        PanelSection(title: L10n.lookup(italian: "Diversificazione"), icon: .globe, color: .bbSwatchBlue,
                     description: L10n.lookup(italian: "Dove investi, guardando dentro ETF e fondi")) {
            VStack(alignment: .leading, spacing: BBSpacing.space6) {
                ExposureRows(title: "Aree geografiche", insight: analysis.areaInsight, slices: analysis.areas.slices, currency: view.currency,
                             label: { ExposureKeys.areaLabels[$0] ?? $0 }, colorKey: { ExposureKeys.areaColors[$0] ?? "slate" }, icon: nil)
                ExposureRows(title: "Settori", insight: analysis.sectorInsight, slices: analysis.sectors.slices, currency: view.currency,
                             label: { ExposureKeys.sectorLabels[$0] ?? $0 }, colorKey: { ExposureKeys.sectorColors[$0] ?? "slate" },
                             icon: { ExposureKeys.sectorIcons[$0].flatMap(BBIcon.forKey) })
                if worst < ExposureKeys.coverageThreshold {
                    BBText(L10n.lookup(italian: "Il {0}% del valore non è classificato: puoi correggerlo da \"Da dove vengono i dati\".",
                                       ["0": String(Int(JSNumber.round((1 - worst) * 100)))]), style: BBTypography.body, color: .bbMutedForeground)
                }
                InvestmentsDisclosure(title: L10n.lookup(italian: "Da dove vengono i dati")) {
                    let rows = analysis.exposureRows
                    let visible = showAllSources ? rows : Array(rows.prefix(5))
                    VStack(spacing: 0) {
                        ForEach(visible, id: \.instrument.id) { row in
                            HStack(spacing: BBSpacing.space3) {
                                InstrumentIconView(instrument: row.instrument, size: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    (Text(verbatim: row.instrument.name).foregroundColor(.bbForeground)
                                        + Text(verbatim: " · \(InvestmentsRules.percent(row.share))").foregroundColor(.bbMutedForeground))
                                        .bbTextStyle(BBTypography.body).lineLimit(1)
                                    BBText("\(L10n.lookup(italian: "Area:")) \(L10n.lookup(italian: ExposureKeys.sourceLabels[row.exposure?.areaSource ?? "nessuno"] ?? ""))",
                                           style: BBTypography.caption, color: .bbMutedForeground)
                                    BBText("\(L10n.lookup(italian: "Settore:")) \(L10n.lookup(italian: ExposureKeys.sourceLabels[row.exposure?.sectorSource ?? "nessuno"] ?? ""))",
                                           style: BBTypography.caption, color: .bbMutedForeground)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                BBButton(L10n.lookup(italian: "Correggi"), variant: .ghost, size: .sm) { editing = row }
                            }
                            .padding(.horizontal, BBSpacing.space3)
                            .padding(.vertical, BBSpacing.space2)
                        }
                    }
                    .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
                    if rows.count > 5 {
                        BBButton(showAllSources ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutte ({0})", ["0": String(rows.count)]),
                                 variant: .ghost, size: .sm) { showAllSources.toggle() }
                    }
                    BBText(L10n.lookup(italian: "Per gli ETF Yahoo dà solo i settori: le aree degli indici più diffusi sono una stima indicativa, le altre puoi inserirle tu."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        }
        .formDialog(isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
            if let editing { BreakdownDialog(model: model, row: editing) { self.editing = nil } }
        }
    }
}

private struct ExposureRows: View {
    let title: String
    let insight: String?
    let slices: [InvestmentsView.Slice]
    let currency: String
    let label: (String) -> String
    let colorKey: (String) -> String
    let icon: ((String) -> BBIcon?)?
    @State private var showAll = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let visible = showAll ? slices : Array(slices.prefix(ExposureKeys.visibleRows))
        let maxShare = max(slices.map(\.share).max() ?? 0.01, 0.01)
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: 2) {
                BBText(L10n.lookup(italian: title), style: BBTypography.bodyStrong)
                if let insight { BBText(insight, style: BBTypography.body, color: .bbMutedForeground) }
            }
            VStack(spacing: BBSpacing.space2_5) {
                ForEach(visible, id: \.key) { slice in
                    let color = Color.bbSwatch(colorKey(slice.key))
                    HStack(spacing: BBSpacing.space3) {
                        if let icon, let i = icon(slice.key) {
                            BBIconView(i, points: 16, color: color)
                                .frame(width: 32, height: 32)
                                .background(RoundedRectangle.bb(BBRadius.lg).fill(color.opacity(0.16)))
                        } else {
                            Circle().fill(color).frame(width: 10, height: 10)
                        }
                        VStack(alignment: .leading, spacing: BBSpacing.space1) {
                            HStack {
                                BBText(L10n.lookup(italian: label(slice.key)), style: BBTypography.body).frame(maxWidth: .infinity, alignment: .leading)
                                BBText(ExposureKeys.share(slice.share, locale: locale), style: BBTypography.bodyStrong).monospacedDigit()
                            }
                            GeometryReader { proxy in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Color.bbMuted)
                                    Capsule().fill(color).frame(width: proxy.size.width * CGFloat(slice.share / maxShare))
                                }
                            }
                            .frame(height: 6)
                            AmountText(value: slice.value, currency: currency, maximumFractionDigits: 0, style: BBTypography.caption)
                                .foregroundStyle(Color.bbMutedForeground)
                        }
                    }
                }
            }
            if slices.count > ExposureKeys.visibleRows {
                BBButton(showAll ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutti ({0})", ["0": String(slices.count)]),
                         variant: .ghost, size: .sm) { showAll.toggle() }
            }
        }
    }
}

/// «Correggi» (INV-048): sector or area percentages, remainder unclassified; null = back to automatic.
private struct BreakdownDialog: View {
    let model: InvestmentsModel
    let row: InvestmentsView.ExposureRow
    let onClose: () -> Void
    @State private var dimension = "areas"
    @State private var values: [String: [String: String]] = [:]
    @State private var reset: Set<String> = []
    @State private var saving = false
    @State private var error: String?
    @Environment(\.bbLocale) private var locale

    private static let sectorKeys = ["tecnologia", "finanza", "salute", "industria", "consumi_ciclici", "consumi_difensivi", "comunicazioni",
                                     "energia", "materiali", "servizi_pubblici", "immobiliare", "obbligazioni", "liquidita", "materie_prime",
                                     "crypto", "altro"]
    private static let areaKeys = ["nord_america", "europa", "italia", "giappone", "pacifico", "emergenti", "nessuna"]

    private func initial(_ dim: String) -> [String: String] {
        let source = dim == "areas" ? (row.manual?.areas ?? row.exposure?.areas) : (row.manual?.sectors ?? row.exposure?.sectors)
        return (source ?? [:]).filter { $0.key != "non_classificato" && $0.value > 0 }
            .mapValues { OperationForm.numberText((($0 * 1000).rounded()) / 10) }
    }

    private func current(_ dim: String) -> [String: String] { values[dim] ?? initial(dim) }

    private func parsed(_ dim: String) -> [String: Double] {
        current(dim).compactMapValues { BBFormat.parseAmount($0) }.filter { $0.value > 0 }
    }

    var body: some View {
        let keys = dimension == "areas" ? Self.areaKeys : Self.sectorKeys
        let labels = dimension == "areas" ? ExposureKeys.areaLabels : ExposureKeys.sectorLabels
        let total = parsed(dimension).values.reduce(0, +)
        let over = total > 100.01
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .pencilLine, title: L10n.lookup(italian: "Correggi") + " · " + row.instrument.name,
                             description: L10n.lookup(italian: "Metti le percentuali che trovi nella scheda dell'emittente (KID o sito del fondo). Quello che manca a 100% resta “non classificato”. La correzione vale solo per te."))
            SegmentedControl(options: [("areas", L10n.lookup(italian: "Area geografica")), ("sectors", L10n.lookup(italian: "Settore"))],
                             selection: $dimension, accessibilityLabel: L10n.lookup(italian: "Cosa correggere"), stretch: true)
            if reset.contains(dimension) {
                BBText(L10n.lookup(italian: "Tornerà ai dati automatici quando salvi."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                VStack(spacing: BBSpacing.space2) {
                    ForEach(keys, id: \.self) { key in
                        HStack(spacing: BBSpacing.space3) {
                            BBText(L10n.lookup(italian: labels[key] ?? key), style: BBTypography.body).frame(maxWidth: .infinity, alignment: .leading)
                            BBTextField(text: Binding(get: { current(dimension)[key] ?? "" }, set: { v in
                                var map = current(dimension)
                                map[key] = v
                                values[dimension] = map
                            }), placeholder: "0", keyboard: .amount)
                            .frame(width: 88)
                            .accessibilityLabel(L10n.lookup(italian: "{0} in percentuale", ["0": L10n.lookup(italian: labels[key] ?? key)]))
                            BBText("%", style: BBTypography.body, color: .bbMutedForeground)
                        }
                    }
                }
                BBText("\(L10n.lookup(italian: "Totale")) \(BBFormat.formatNumber(total, maximumFractionDigits: 1, locale: locale))%"
                       + (total < 100 ? L10n.lookup(italian: " · non classificato {0}%", ["0": BBFormat.formatNumber(100 - total, maximumFractionDigits: 1, locale: locale)]) : ""),
                       style: BBTypography.bodyStrong, color: over ? .bbDestructive : .bbForeground)
            }
            if let error { BBErrorBox(message: error) }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: "Torna all'automatico"), variant: .ghost) { reset.insert(dimension); values[dimension] = [:] }
                Spacer(minLength: 0)
                BBButton(L10n.lookup(italian: "Annulla"), variant: .outline, action: onClose)
                BBButton(L10n.lookup(italian: saving ? "Salvo…" : "Salva"), isLoading: saving, isDisabled: over) { save() }
            }
        }
    }

    private func save() {
        func dim(_ d: String) -> [String: Double]? {
            if reset.contains(d) { return nil }
            let map = parsed(d).mapValues { $0 / 100 }
            if values[d] == nil { return d == "areas" ? row.manual?.areas : row.manual?.sectors }
            return map.isEmpty ? nil : map
        }
        saving = true
        Task {
            do {
                try await model.env.instruments.saveBreakdown(id: row.instrument.id, sectors: dim("sectors"), areas: dim("areas"))
                await model.reloadAll()
                onClose()
            } catch {
                self.error = (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Qualcosa è andato storto. Riprova.")
            }
            saving = false
        }
    }
}

// MARK: - Allocazione obiettivo (INV-051…055)

private struct AllocationSection: View {
    let model: InvestmentsModel
    let view: InvestmentsView
    @State private var open = false
    @State private var editing = false
    @State private var amountText = "100"
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let allocation = view.analysis.allocation
        let outOfLine = allocation?.rows.filter { $0.status != "in_linea" } ?? []
        let description: String = {
            guard allocation != nil else {
                return L10n.lookup(italian: "Decidi quanto deve pesare ogni strumento: ti diciamo dove mettere il prossimo versamento.")
            }
            if outOfLine.isEmpty { return L10n.lookup(italian: "Tutto entro ±{0} punti dall'obiettivo.", ["0": "5"]) }
            let who = outOfLine.count == 1 ? L10n.lookup(italian: "Uno strumento è")
                : L10n.lookup(italian: "{0} strumenti sono", ["0": String(outOfLine.count)])
            return L10n.lookup(italian: "{0} fuori di più di {1} punti.", ["0": who, "1": "5"])
        }()
        PanelSection(title: L10n.lookup(italian: "Allocazione obiettivo"), icon: .target, color: .bbSwatchEmerald, description: description) {
            if allocation != nil {
                HStack(spacing: BBSpacing.space1) {
                    BBButton(L10n.lookup(italian: "Modifica"), variant: .ghost, size: .sm) { editing = true }
                    BBButton(L10n.lookup(italian: open ? "Chiudi" : "Dettaglio"), icon: open ? .chevronUp : .chevronDown, iconTrailing: true,
                             variant: .outline, size: .sm) { open.toggle() }
                }
            }
        } content: {
            if let allocation {
                if open { detail(allocation) }
            } else {
                BBButton(L10n.lookup(italian: "Imposta un obiettivo"), variant: .outline) { editing = true }
            }
        }
        .formDialog(isPresented: $editing) {
            TargetsDialog(model: model, view: view) { editing = false }
        }
    }

    @ViewBuilder private func detail(_ allocation: InvestmentsView.Allocation) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            VStack(spacing: BBSpacing.space3) {
                ForEach(allocation.rows, id: \.instrumentId) { row in
                    let drift = ExposureKeys.driftText(row)
                    VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                        BBText(view.instrument(row.instrumentId)?.name ?? "—", style: BBTypography.body, lineLimit: 1)
                        (Text(verbatim: InvestmentsRules.percent(row.currentWeight)
                              + (row.inTarget ? L10n.lookup(italian: " su {0}", ["0": InvestmentsRules.percent(row.targetWeight)]) : "") + " · ")
                            .foregroundColor(.bbMutedForeground)
                            + Text(verbatim: L10n.lookup(italian: drift.source, drift.values))
                            .foregroundColor(row.status == "in_linea" ? .bbMutedForeground : .bbForeground)
                            .fontWeight(row.status == "in_linea" ? .regular : .medium))
                            .bbTextStyle(BBTypography.caption).monospacedDigit()
                        AllocationBar(row: row)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            if !allocation.unpricedIds.isEmpty {
                BBText("\(L10n.lookup(italian: "Esclusi perché senza prezzo:")) \(allocation.unpricedIds.map { view.instrument($0)?.name ?? "—" }.joined(separator: ", ")).",
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            contribution(allocation)
        }
    }

    private func contribution(_ allocation: InvestmentsView.Allocation) -> some View {
        let amount = BBFormat.parseAmount(amountText) ?? 0
        let analysis = allocation.analysis
        let suggestions = AllocationTargets.suggestContribution(analysis, amount: amount)
        return VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(spacing: BBSpacing.space2) {
                BBText(L10n.lookup(italian: "Se versi"), style: BBTypography.bodyStrong)
                BBTextField(text: $amountText, keyboard: .amount).frame(width: 112)
                BBText("\(view.currency)\(L10n.lookup(italian: ", compra:"))", style: BBTypography.body, color: .bbMutedForeground)
            }
            if suggestions.isEmpty {
                BBText(L10n.lookup(italian: "Inserisci un importo per vedere dove metterlo."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                ForEach(suggestions, id: \.instrumentId) { s in
                    HStack(spacing: BBSpacing.space3) {
                        VStack(alignment: .leading, spacing: 2) {
                            (Text(verbatim: BBFormat.formatCurrency(s.amount, currency: view.currency, locale: locale, maximumFractionDigits: 0))
                                .fontWeight(.medium)
                                + Text(verbatim: " \(L10n.lookup(italian: "di")) \(view.instrument(s.instrumentId)?.name ?? "—")"))
                                .bbTextStyle(BBTypography.body).foregroundStyle(Color.bbForeground).lineLimit(1)
                            BBText("\(L10n.lookup(italian: "arriva al")) \(InvestmentsRules.percent(s.weightAfter)) \(L10n.lookup(italian: "(obiettivo")) \(InvestmentsRules.percent(s.targetWeight)))",
                                   style: BBTypography.caption, color: .bbMutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        BBButton(L10n.lookup(italian: "Registra"), variant: .outline, size: .sm) { register(s) }
                    }
                }
            }
            BBText(L10n.lookup(italian: "Solo acquisti: compra per primo ciò che è più sotto obiettivo, senza vendere niente."),
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
        .padding(BBSpacing.space3)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.5)))
    }

    /// INV-055: purchase, instrument, last price, quantity floored to 4 decimals.
    private func register(_ s: AllocationSuggestion) {
        let row = view.summary.rows.first { $0.instrument.id == s.instrumentId }
        let price = row?.lastPrice?.close
        let quantity = InvestmentsRules.suggestedQuantity(amount: s.amount, lastPrice: price)
        model.openRegister(OperationForm(type: .acquisto, instrument: view.instrument(s.instrumentId), date: InvestmentsModel.todayKey,
                                         quantity: quantity.map(OperationForm.numberText) ?? "",
                                         price: price.map(OperationForm.priceText) ?? ""))
    }
}

private struct AllocationBar: View {
    let row: InvestmentsView.AllocationRowView

    var body: some View {
        let scale = max(row.currentWeight, row.targetWeight, 0.01)
        let maxValue = min(1, scale * 1.15)
        let color: Color = row.status == "in_linea" ? .bbPrimary : row.status == "sotto" ? .bbSwatchAmber : .bbSwatchViolet
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.bbMuted).frame(height: 8)
                Capsule().fill(color).frame(width: proxy.size.width * CGFloat(row.currentWeight / maxValue), height: 8)
                if row.inTarget {
                    RoundedRectangle(cornerRadius: 1).fill(Color.bbForeground).frame(width: 2, height: 16)
                        .offset(x: proxy.size.width * CGFloat(row.targetWeight / maxValue) - 1)
                }
            }
            .frame(height: 16)
        }
        .frame(height: 16)
        .accessibilityHidden(true)
    }
}

/// «Obiettivo di allocazione» (INV-051/052).
private struct TargetsDialog: View {
    let model: InvestmentsModel
    let view: InvestmentsView
    let onClose: () -> Void
    @State private var rows: [TargetDraft] = []
    @State private var saving = false
    @State private var error: String?
    @State private var started = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let missing = TargetsEditor.missing(rows)
        let suggestions = view.heldInstrumentIds.compactMap { view.instrument($0) }.filter { i in !rows.contains { $0.instrumentId == i.id } }
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .target, title: L10n.lookup(italian: "Obiettivo di allocazione"),
                             description: L10n.lookup(italian: "Quanto vuoi che pesi ogni strumento sul totale. Serve per vedere quanto ti sei allontanato e dove mettere il prossimo versamento."),
                             color: .bbSwatchEmerald)
            VStack(spacing: BBSpacing.space2) {
                ForEach($rows) { $row in
                    HStack(spacing: BBSpacing.space2) {
                        BBText(row.name, style: BBTypography.body, lineLimit: 2).frame(maxWidth: .infinity, alignment: .leading)
                        BBTextField(text: $row.percent, keyboard: .amount).frame(width: 80)
                            .accessibilityLabel(L10n.lookup(italian: "Peso obiettivo di {0} in percentuale", ["0": row.name]))
                        BBText("%", style: BBTypography.body, color: .bbMutedForeground)
                        BBIconButton(icon: .x, accessibilityLabel: L10n.lookup(italian: "Togli {0}", ["0": row.name])) {
                            rows.removeAll { $0.instrumentId == row.instrumentId }
                        }
                    }
                }
            }
            HStack(spacing: BBSpacing.space2) {
                BBText("\(L10n.lookup(italian: "Totale")) \(BBFormat.formatNumber(TargetsEditor.total(rows), maximumFractionDigits: 1, locale: locale))%"
                       + (abs(missing) < 0.05 ? "" : missing > 0
                          ? L10n.lookup(italian: " · mancano {0}", ["0": BBFormat.formatNumber(missing, maximumFractionDigits: 1, locale: locale) + "%"])
                          : L10n.lookup(italian: " · {0} di troppo", ["0": BBFormat.formatNumber(-missing, maximumFractionDigits: 1, locale: locale) + "%"])),
                       style: BBTypography.bodyStrong, color: abs(missing) < 0.05 ? .bbForeground : .bbDestructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if abs(missing) >= 0.05, !rows.isEmpty {
                    BBButton("\(L10n.lookup(italian: "Aggiungi")) \(L10n.lookup(italian: "la differenza a")) \(L10n.lookup(italian: "l'ultimo"))",
                             variant: .link, size: .sm) { rows = TargetsEditor.fillLast(rows) }
                }
            }
            if rows.count < InvestmentsRules.maxTargets {
                InstrumentPickerField(instrument: nil, suggestions: suggestions, currency: model.currency, placeholder: "Aggiungi uno strumento") { chosen in
                    guard !rows.contains(where: { $0.instrumentId == chosen.id }) else { return }
                    rows.append(TargetDraft(instrumentId: chosen.id, name: chosen.name, percent: ""))
                }
            }
            if let error { BBErrorBox(message: error) }
            HStack(spacing: BBSpacing.space2) {
                if !view.analysis.targets.isEmpty {
                    BBButton(L10n.lookup(italian: "Togli l'obiettivo"), variant: .ghost) { save([]) }
                }
                Spacer(minLength: 0)
                BBButton(L10n.lookup(italian: "Annulla"), variant: .outline, action: onClose)
                BBButton(L10n.lookup(italian: saving ? "Salvo…" : "Salva"), isLoading: saving, isDisabled: !TargetsEditor.canSave(rows)) {
                    save(TargetsEditor.weights(rows))
                }
            }
        }
        .onAppear {
            guard !started else { return }
            started = true
            rows = TargetsEditor.initial(saved: view.analysis.targets, current: view.analysis.currentWeights) { view.instrument($0)?.name ?? "—" }
        }
    }

    private func save(_ targets: [InvestmentsView.Target]) {
        saving = true
        error = nil
        Task {
            error = await model.saveTargets(targets)
            saving = false
            if error == nil { onClose() }
        }
    }
}

// MARK: - Sovrapposizioni (INV-049/050)

private struct OverlapSection: View {
    let view: InvestmentsView
    @State private var showAllPairs = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let analysis = view.analysis
        let name = { (id: String) in view.instrument(id)?.name ?? "—" }
        PanelSection(title: L10n.lookup(italian: "Sovrapposizioni"), icon: .layers, color: .bbSwatchViolet,
                     description: L10n.lookup(italian: "Quando due posizioni sono, in pratica, la stessa scommessa")) {
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(L10n.lookup(italian: "Investimenti doppi"), style: BBTypography.bodyStrong)
                        BBText(L10n.lookup(italian: "Fondi che contengono in buona parte le stesse aziende."), style: BBTypography.body, color: .bbMutedForeground)
                    }
                    if analysis.overlaps.isEmpty && analysis.stocksInFunds.isEmpty {
                        BBText(L10n.lookup(italian: "Nessuna sovrapposizione rilevante tra le tue posizioni."), style: BBTypography.body, color: .bbMutedForeground)
                    }
                    ForEach(analysis.overlaps, id: \.aId) { o in
                        let verdict = PlainLabels.overlap(o.share)
                        VStack(alignment: .leading, spacing: 2) {
                            (Text(verbatim: L10n.lookup(italian: verdict.label)).fontWeight(.medium)
                                + Text(verbatim: " · \(Int(JSNumber.round(o.share * 100)))\(L10n.lookup(italian: "% in comune"))").foregroundColor(.bbMutedForeground))
                                .bbTextStyle(BBTypography.body)
                            BBText("\(name(o.aId)) + \(name(o.bId))", style: BBTypography.body, color: .bbMutedForeground)
                            BBText(L10n.lookup(italian: PlainLabels.overlapMethodNote(o.method)), style: BBTypography.caption, color: .bbMutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(BBSpacing.space3)
                        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
                    }
                    ForEach(analysis.stocksInFunds, id: \.stockId) { item in
                        stockRow(item, name: name)
                    }
                }
                if analysis.correlations != nil {
                    correlations(name: name)
                }
            }
        }
    }

    private func stockRow(_ item: InvestmentsView.StockInsideFunds, name: (String) -> String) -> some View {
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: view.currency, locale: locale, maximumFractionDigits: 0, masked: hide) }
        let via = item.totalValue - item.directValue
        let direct = item.totalValue > 0 ? item.directValue / item.totalValue : 1
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            (Text(verbatim: name(item.stockId)).fontWeight(.medium)
                + Text(verbatim: " \(L10n.lookup(italian: "pesa in tutto")) ")
                + Text(verbatim: money(item.totalValue)).fontWeight(.medium)
                + Text(verbatim: "\(L10n.lookup(italian: ", perché la hai anche dentro")) \(item.funds.count == 1 ? L10n.lookup(italian: "un ETF") : L10n.lookup(italian: "{0} ETF", ["0": String(item.funds.count)]))."))
                .bbTextStyle(BBTypography.body).foregroundStyle(Color.bbForeground)
            StackedBar(parts: [(.bbSwatchBlue, direct), (.bbSwatchAmber, 1 - direct)])
            BBText("\(money(item.directValue)) \(L10n.lookup(italian: "come azioni ·")) \(money(via)) \(L10n.lookup(italian: "dentro gli ETF ("))"
                   + item.funds.map { L10n.lookup(italian: "{0}% di {1}", ["0": BBFormat.formatNumber($0.weightInFund * 100, minimumFractionDigits: 1, maximumFractionDigits: 1, locale: locale), "1": name($0.fundId)]) }.joined(separator: ", ") + ")",
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
        .padding(BBSpacing.space3)
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
    }

    @ViewBuilder private func correlations(name: @escaping (String) -> String) -> some View {
        let analysis = view.analysis
        let average = PlainLabels.averageCorrelation(analysis.correlationPairs)
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: 2) {
                BBText(L10n.lookup(italian: "Quanto si muovono insieme"), style: BBTypography.bodyStrong)
                BBText(average.map { L10n.lookup(italian: "In media {0}: più è vicino a 0, più le posizioni si compensano quando il mercato scende.",
                                                 ["0": PlainLabels.decimal2($0, locale: locale)]) }
                       ?? L10n.lookup(italian: "Servono almeno 20 giorni di prezzi in comune per confrontare due posizioni."),
                       style: BBTypography.body, color: .bbMutedForeground)
            }
            if average != nil, let families = analysis.correlationFamilies {
                ForEach(Array(families.families.enumerated()), id: \.offset) { index, family in
                    familyBox(title: Text(verbatim: "\(L10n.lookup(italian: "Famiglia")) \(index + 1)\(L10n.lookup(italian: ": si muovono quasi insieme"))").fontWeight(.medium)
                                + Text(verbatim: " \(L10n.lookup(italian: "· contano come una sola scommessa"))").foregroundColor(.bbMutedForeground),
                              ids: family, name: name, highlight: true)
                }
                if !families.independent.isEmpty {
                    familyBox(title: Text(verbatim: L10n.lookup(italian: families.families.isEmpty ? "Nessuna coppia si muove insieme" : "Vanno per conto loro")).fontWeight(.medium)
                                + Text(verbatim: " \(L10n.lookup(italian: "· diversificano il resto"))").foregroundColor(.bbMutedForeground),
                              ids: families.independent, name: name, highlight: false)
                }
                InvestmentsDisclosure(title: L10n.lookup(italian: "Tutte le coppie")) {
                    let pairs = analysis.correlationPairs
                    ForEach(Array((showAllPairs ? pairs : Array(pairs.prefix(4))).enumerated()), id: \.offset) { _, pair in
                        let verdict = PlainLabels.correlation(pair.value)
                        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                            BBText("\(name(pair.aId)) \(L10n.lookup(italian: "e")) \(name(pair.bId))", style: BBTypography.body)
                            BBText("\(L10n.lookup(italian: verdict.label)) (\(PlainLabels.decimal2(pair.value, locale: locale)))", style: BBTypography.caption,
                                   color: .bbMutedForeground)
                            GeometryReader { proxy in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Color.bbMuted)
                                    Capsule().fill(verdict.severity == "alta" ? Color.bbNeg : verdict.severity == "media" ? .bbSwatchAmber : .bbPos)
                                        .frame(width: proxy.size.width * CGFloat(max(0.04, max(0, pair.value))))
                                }
                            }
                            .frame(height: 6)
                        }
                        .padding(BBSpacing.space3)
                        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
                    }
                    if pairs.count > 4 {
                        BBButton(showAllPairs ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutte le coppie ({0})", ["0": String(pairs.count)]),
                                 variant: .ghost, size: .sm) { showAllPairs.toggle() }
                    }
                }
            }
        }
    }

    private func familyBox(title: Text, ids: [String], name: @escaping (String) -> String, highlight: Bool) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            title.bbTextStyle(BBTypography.body).foregroundStyle(Color.bbForeground)
            InvFlowChips(items: ids.map { (id: $0, instrument: view.instrument($0)) })
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(BBSpacing.space3)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(highlight ? Color.bbSwatchAmber.opacity(0.08) : Color.clear))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(highlight ? Color.bbSwatchAmber.opacity(0.5) : Color.bbBorder, lineWidth: 1))
    }
}

/// Wrapping chips with instrument icon + name.
private struct InvFlowChips: View {
    let items: [(id: String, instrument: Instrument?)]

    var body: some View {
        FlowLayout(spacing: BBSpacing.space2) {
            ForEach(items, id: \.id) { (item: (id: String, instrument: Instrument?)) in
                HStack(spacing: BBSpacing.space1_5) {
                    if let i = item.instrument { InstrumentIconView(instrument: i, size: 20) }
                    BBText(item.instrument?.name ?? "—", style: BBTypography.body, lineLimit: 1)
                }
                .padding(.leading, 6)
                .padding(.trailing, BBSpacing.space3)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color.bbBackground))
                .overlay(Capsule().strokeBorder(Color.bbBorder, lineWidth: 1))
            }
        }
    }
}

/// Simple wrapping layout.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    /// Space between rows (default: `spacing`).
    var lineSpacing: CGFloat?

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.init(width: width, height: nil))
            if x > 0 && x + size.width > width { x = 0; y += row + (lineSpacing ?? spacing); row = 0 }
            x += size.width + spacing
            row = max(row, size.height)
            maxX = max(maxX, x - spacing)
        }
        return CGSize(width: proposal.width ?? maxX, height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.init(width: bounds.width, height: nil))
            if x > bounds.minX && x + size.width > bounds.maxX { x = bounds.minX; y += row + (lineSpacing ?? spacing); row = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: .init(width: min(size.width, bounds.width), height: size.height))
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}
