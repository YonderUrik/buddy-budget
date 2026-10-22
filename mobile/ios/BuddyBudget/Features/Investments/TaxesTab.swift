import BuddyBudgetKit
import SwiftUI

/// Investimenti › Tasse (IT, INV-083…091): year card, «Prima di vendere» (server simulation), rates, loss pool with
/// prior losses, opportunities, regime. DE shows the German plan (13-planning-de). Android: TaxesTab.kt.
struct TaxesTab: View {
    let model: InvestmentsModel
    @State private var editing: Instrument?

    var body: some View {
        if model.countryContent == .germanPlan {
            GermanTaxScreen(model: model.planning)
        } else {
            switch model.taxes {
            case .loading:
                VStack(spacing: BBSpacing.space6) {
                    BBSkeleton(height: 160, radius: BBRadius.xl)
                    BBSkeleton(height: 288, radius: BBRadius.xl)
                }
            case .failed:
                LoadError(message: L10n.lookup(italian: "Impossibile caricare le tasse."), onRetry: { Task { await model.loadTaxes() } })
            case .loaded(let taxes):
                VStack(alignment: .leading, spacing: BBSpacing.space10) {
                    if debugShows(0), !taxes.report.years.isEmpty { TaxYearSection(taxes: taxes) }
                    if debugShows(1), taxes.sellable.contains(where: { $0.price != nil && $0.fxRate != nil }) {
                        SaleSimulatorSection(model: model, taxes: taxes)
                    }
                    if debugShows(2) { RatesSection(taxes: taxes) { editing = $0 } }
                    if debugShows(3) { LossPoolSection(model: model, taxes: taxes) }
                    OpportunitiesSection(taxes: taxes)
                    RegimeNote(model: model, regime: taxes.regime)
                }
                .formDialog(isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
                    if let editing {
                        InstrumentSettingsView(model: model, instrument: editing, setting: taxes.setting(editing.id),
                                               resolved: taxes.resolved(editing.id)) { self.editing = nil }
                    }
                }
            }
        }
    }
}

private struct TaxRow: View {
    let label: String
    let value: String
    var hint: String?
    var color: Color = .bbForeground

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                HStack(spacing: BBSpacing.space1) {
                    BBText(label, style: BBTypography.body, color: .bbMutedForeground)
                    if let hint { InfoHintButton(title: L10n.lookup(italian: "Cos'è: {0}", ["0": label]), text: hint) }
                }
                Spacer(minLength: 0)
                BBText(value, style: BBTypography.body, color: color).monospacedDigit()
            }
            .padding(.vertical, BBSpacing.space1_5)
        }
    }
}

private struct TaxYearSection: View {
    let taxes: InvestmentsTaxes
    @State private var year: Int?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let recent = TaxRules.recentYears(taxes.report.years)
        let y = recent.first { $0.year == year } ?? recent[0]
        let f = { (v: Double) in BBFormat.formatCurrency(v, currency: taxes.currency, locale: locale, masked: hide) }
        let hasCrypto = y.cryptoGains > 0 || y.cryptoLosses > 0
        let gap = y.estimatedTax - y.taxOnCrypto - y.withheld
        let title = y.year == taxes.currentYear ? L10n.lookup(italian: "Quest'anno") : L10n.lookup(italian: "Anno {0}", ["0": String(y.year)])
        let years = recent.map { ($0.year, String($0.year)) }
        let yearBinding = Binding(get: { y.year }, set: { year = $0 })
        PanelSection(title: title, icon: .receiptText, color: .bbNeg) {
            // The year choice sits beside the title (web phone layout) while it fits.
            if recent.count > 1, recent.count <= TitleSegments.maxInline {
                SegmentedControl(options: years, selection: yearBinding, accessibilityLabel: L10n.lookup(italian: "Anno"))
            }
        } content: {
            if recent.count > TitleSegments.maxInline {
                ScrollableSegmentedControl(options: years, selection: yearBinding, accessibilityLabel: L10n.lookup(italian: "Anno"))
            }
            RunsText(runs: [
                InvestmentsTextRun("\(L10n.lookup(italian: "Imposte stimate su quanto hai venduto:")) "),
                InvestmentsTextRun(f(y.estimatedTax), .strong),
                taxes.regime == "dichiarativo" && y.estimatedTax > 0
                    ? InvestmentsTextRun(L10n.lookup(italian: ", da versare in dichiarazione."), .muted) : InvestmentsTextRun("."),
            ])
            if taxes.regime == "amministrato" && (y.withheld > 0 || y.estimatedTax > 0) {
                BBText(abs(gap) <= 1
                       ? L10n.lookup(italian: "Hai registrato {0} di imposte trattenute sulle vendite: in linea con la stima.", ["0": f(y.withheld)])
                       : L10n.lookup(italian: "Hai registrato {0} di imposte trattenute sulle vendite, {1} {2} della stima (crypto escluse): controlla le imposte delle vendite o l'aliquota degli strumenti.",
                                     ["0": f(y.withheld), "1": f(abs(gap)), "2": L10n.lookup(italian: gap > 0 ? "in meno" : "in più")]),
                       style: BBTypography.body, color: .bbMutedForeground)
            }
            VStack(spacing: 0) {
                TaxRow(label: L10n.lookup(italian: "Plusvalenze"), value: f(y.gains),
                       hint: L10n.lookup(italian: "Guadagni da vendite e rimborsi di azioni, obbligazioni ed ETC: si possono compensare con lo zaino."),
                       color: y.gains > 0 ? .bbPos : .bbForeground)
                TaxRow(label: L10n.lookup(italian: "Minusvalenze"), value: f(y.losses),
                       hint: L10n.lookup(italian: "Perdite da vendite e rimborsi, anche di ETF e fondi: entrano nello zaino."), color: y.losses > 0 ? .bbNeg : .bbForeground)
                TaxRow(label: L10n.lookup(italian: "Guadagni da ETF e fondi"), value: f(y.fundGains),
                       hint: L10n.lookup(italian: "Sono redditi di capitale: tassati per intero, non si compensano con lo zaino."))
                TaxRow(label: L10n.lookup(italian: "Zaino usato"), value: f(y.lossesUsed),
                       hint: L10n.lookup(italian: "Minusvalenze (portate all'aliquota del 26%) usate per ridurre le plusvalenze."))
                if y.lossesExpired > 0 { TaxRow(label: L10n.lookup(italian: "Zaino scaduto"), value: f(y.lossesExpired), color: .bbNeg) }
                if hasCrypto {
                    TaxRow(label: L10n.lookup(italian: "Crypto (netto)"), value: f(y.cryptoGains - y.cryptoLosses),
                           hint: L10n.lookup(italian: "Sempre in dichiarazione, compensabili solo tra crypto. Aliquota {0} {1}.",
                                             ["0": y.year >= 2026 ? "33%" : "26%", "1": y.year <= 2024 ? L10n.lookup(italian: "con franchigia di 2.000 €") : ""]))
                }
                TaxRow(label: L10n.lookup(italian: "Imposte su plusvalenze"), value: f(y.taxOnGains))
                TaxRow(label: L10n.lookup(italian: "Imposte su ETF e fondi"), value: f(y.taxOnFunds))
                if hasCrypto { TaxRow(label: L10n.lookup(italian: "Imposte su crypto"), value: f(y.taxOnCrypto)) }
                TaxRow(label: L10n.lookup(italian: "Dividendi e cedole lordi"), value: f(y.incomeGross))
                TaxRow(label: L10n.lookup(italian: "Ritenute sui proventi"), value: f(y.incomeWithheld),
                       hint: L10n.lookup(italian: "Quelle registrate sui dividendi e le cedole: le trattiene sempre chi paga."))
                TaxRow(label: L10n.lookup(italian: y.year == taxes.currentYear ? "Bollo stimato" : "Bollo"), value: f(y.bollo),
                       hint: L10n.lookup(italian: "0,2% del valore a fine anno, in proporzione ai giorni in cui hai investito. Per l'anno in corso: se il valore restasse quello di oggi."))
            }
            if y.nonHarmonizedCount > 0 {
                BBText(L10n.lookup(italian: "Hai venduto in guadagno ETF non armonizzati: in realtà sono tassati all'aliquota IRPEF in dichiarazione, qui sono stimati al 26%."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }
}

/// «Prima di vendere» (INV-086): server simulation, debounced 300 ms.
private struct SaleSimulatorSection: View {
    let model: InvestmentsModel
    let taxes: InvestmentsTaxes
    @State private var instrumentId: String?
    @State private var quantityText: String?
    @State private var result: SaleSimulation?
    @State private var failed = false
    @State private var task: Task<Void, Never>?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let priced = taxes.sellable.filter { $0.price != nil && $0.fxRate != nil }
        let position = priced.first { $0.instrument.id == instrumentId } ?? priced[0]
        let quantityValue = quantityText.map { BBFormat.parseAmount($0) } ?? position.quantity
        let quantity = quantityValue.map { min($0, position.quantity) }
        let f = { (v: Double) in BBFormat.formatCurrency(v, currency: taxes.currency, locale: locale, masked: hide) }
        PanelSection(title: L10n.lookup(italian: "Prima di vendere"), icon: .calculator, color: .bbSwatchIndigo) {
            BBSelect(label: L10n.lookup(italian: "Posizione"), options: priced.map { ($0.instrument.id, $0.instrument.name) },
                     selection: Binding(get: { position.instrument.id }, set: { instrumentId = $0; quantityText = nil }),
                     title: L10n.lookup(italian: "Posizione da vendere"))
            BBTextField(label: L10n.lookup(italian: "Quote (di {0})", ["0": hide ? BBFormat.amountMask : BBFormat.formatNumber(position.quantity, maximumFractionDigits: 4, locale: locale)]),
                        text: Binding(get: { quantityText ?? OperationForm.numberText(position.quantity) }, set: { quantityText = $0 }), keyboard: .amount)
            BBText("\(L10n.lookup(italian: "All'ultimo prezzo ("))\(BBFormat.formatCurrency(position.price ?? 0, currency: position.instrument.currency, locale: locale, masked: hide))\(position.instrument.isPercentOfNominal ? L10n.lookup(italian: " ogni 100 di nominale") : "")\(L10n.lookup(italian: "), senza commissioni."))",
                   style: BBTypography.caption, color: .bbMutedForeground)
            if let quantity, quantity > 0, let r = result, r.instrumentId == position.instrument.id {
                SimulationResult(label: L10n.lookup(italian: "Ti resta"), value: f(r.net))
                VStack(spacing: 0) {
                    TaxRow(label: L10n.lookup(italian: "Incasso"), value: f(r.proceeds))
                    TaxRow(label: L10n.lookup(italian: "Costo fiscale (prezzo medio)"), value: f(r.cost))
                    TaxRow(label: L10n.lookup(italian: r.gain >= 0 ? "Plusvalenza" : "Minusvalenza"),
                           value: BBFormat.formatSignedCurrency(r.gain, currency: taxes.currency, locale: locale, masked: hide))
                    if r.lossesUsed > 0 { TaxRow(label: L10n.lookup(italian: "Zaino usato"), value: f(r.lossesUsed)) }
                    if r.lossesCreated > 0 { TaxRow(label: L10n.lookup(italian: "Nuovo zaino"), value: f(r.lossesCreated)) }
                    TaxRow(label: r.taxLineLabel, value: f(abs(r.taxDelta)))
                }
                BBText(r.note, style: BBTypography.body, color: .bbMutedForeground)
            } else if quantity == nil || (quantity ?? 0) <= 0 {
                BBText(L10n.lookup(italian: "Inserisci quante quote vuoi vendere."), style: BBTypography.body, color: .bbMutedForeground)
            } else if failed {
                BBText(L10n.lookup(italian: "Qualcosa è andato storto. Riprova."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                BBSkeleton(height: 160, radius: BBRadius.lg)
            }
        }
        .onChange(of: "\(position.instrument.id)|\(quantity ?? 0)", initial: true) { _, _ in
            simulate(id: position.instrument.id, quantity: quantity)
        }
    }

    private func simulate(id: String, quantity: Double?) {
        task?.cancel()
        guard let quantity, quantity > 0 else { return }
        task = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            switch await model.simulateSale(instrumentId: id, quantity: quantity) {
            case .success(let r):
                result = r
                failed = false
            case .failure:
                failed = true
                result = nil
            }
        }
    }
}

private struct RatesSection: View {
    let taxes: InvestmentsTaxes
    let onEdit: (Instrument) -> Void
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let shown = taxes.rateListInstrumentIds.compactMap { taxes.instrument($0) }.filter { $0.kind != .crypto && taxes.resolved($0.id) != nil }
        if !shown.isEmpty {
            PanelSection(title: L10n.lookup(italian: "Aliquote degli strumenti"), icon: .list, color: .bbSwatchSlate) {
                VStack(spacing: 0) {
                    ForEach(shown) { instrument in
                        let r = taxes.resolved(instrument.id)!
                        HStack(spacing: BBSpacing.space2_5) {
                            InstrumentIconView(instrument: instrument, size: 28)
                            VStack(alignment: .leading, spacing: 0) {
                                BBText(instrument.name, style: BBTypography.body, lineLimit: 1)
                                BBText("\(BBFormat.formatPct(r.taxRate, locale: locale)) · \(L10n.lookup(italian: TaxRules.rateSourceLabel(r.taxRateSource)))"
                                       + (instrument.kind == .etf || instrument.kind == .fondo ? " · \(L10n.lookup(italian: r.harmonized == true ? "armonizzato" : "non armonizzato"))" : ""),
                                       style: BBTypography.caption, color: .bbMutedForeground)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            BBButton(L10n.lookup(italian: "Modifica"), variant: .ghost, size: .sm) { onEdit(instrument) }
                        }
                        .padding(.vertical, BBSpacing.space2)
                    }
                }
            }
        }
    }
}

private struct LossPoolSection: View {
    let model: InvestmentsModel
    let taxes: InvestmentsTaxes
    @State private var adding = false
    @State private var year = ""
    @State private var amount = ""
    @State private var note = ""
    @State private var error: String?
    @State private var saving = false
    @State private var deleting: String?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let byExpiry = TaxRules.lossesByExpiry(taxes.report.losses)
        let crypto = TaxRules.lossesByExpiry(taxes.report.losses, crypto: true)
        let total = byExpiry.reduce(0) { $0 + $1.amount }
        let maxValue = byExpiry.map(\.amount).max() ?? 0
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: taxes.currency, locale: locale, maximumFractionDigits: 0, masked: hide) }
        PanelSection(title: L10n.lookup(italian: "Zaino delle minusvalenze"), icon: .backpack, color: .bbSwatchIndigo) {
            InfoHintButton(title: L10n.lookup(italian: "Cos'è lo zaino"),
                           text: L10n.lookup(italian: "Le minusvalenze di un anno si possono usare fino al 31 dicembre del quarto anno dopo, per non pagare tasse sulle plusvalenze di azioni, obbligazioni ed ETC (non sui guadagni degli ETF). Gli importi sono portati all'aliquota del 26%."))
        } content: {
            if total > 0 {
                RunsText(runs: [InvestmentsTextRun("\(L10n.lookup(italian: "Puoi ancora compensare")) "), InvestmentsTextRun(money(total), .strong),
                                InvestmentsTextRun(" \(L10n.lookup(italian: "di plusvalenze."))")])
            } else {
                BBText(L10n.lookup(italian: "Lo zaino è vuoto: nessuna minusvalenza da compensare."), style: BBTypography.bodyLarge)
            }
            ForEach(byExpiry, id: \.expiresYear) { entry in
                HStack(spacing: BBSpacing.space3) {
                    BBText("\(L10n.lookup(italian: "Scade fine")) \(entry.expiresYear)", style: entry.expiresYear == taxes.currentYear ? BBTypography.bodyStrong : BBTypography.body,
                           color: entry.expiresYear == taxes.currentYear ? .bbNeg : .bbMutedForeground)
                        .frame(width: 120, alignment: .leading)
                    GeometryReader { p in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.bbMuted)
                            Capsule().fill(Color.bbPrimary).frame(width: maxValue > 0 ? p.size.width * entry.amount / maxValue : 0)
                        }
                    }
                    .frame(height: 8)
                    BBText(money(entry.amount), style: BBTypography.body).monospacedDigit()
                }
            }
            if !crypto.isEmpty {
                BBText("\(L10n.lookup(italian: "Zaino crypto (compensabile solo con crypto):")) \(money(crypto.reduce(0) { $0 + $1.amount })).",
                       style: BBTypography.body, color: .bbMutedForeground)
            }
            BBText(L10n.lookup(italian: "Minusvalenze pregresse"), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
            if taxes.carryforwards.isEmpty {
                BBText(L10n.lookup(italian: "Se il broker aveva già minusvalenze da prima dell'app, aggiungile qui."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                ForEach(taxes.carryforwards) { c in
                    HStack(spacing: BBSpacing.space3) {
                        (Text(verbatim: "\(c.year) · \(BBFormat.formatCurrency(c.amountValue, currency: taxes.currency, locale: locale, masked: hide))")
                            + Text(verbatim: c.note.map { " · \($0)" } ?? "").foregroundColor(.bbMutedForeground))
                            .bbTextStyle(BBTypography.body).lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        BBIconButton(icon: .trash2, accessibilityLabel: L10n.lookup(italian: "Elimina la minusvalenza del {0}", ["0": String(c.year)])) {
                            deleting = c.id
                            Task {
                                await model.deleteCarryforward(c.id)
                                deleting = nil
                            }
                        }
                        .bbDisabled(deleting != nil)
                    }
                }
            }
            if adding {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    HStack(spacing: BBSpacing.space2) {
                        BBTextField(text: $year, keyboard: .number).frame(width: 96)
                            .accessibilityLabel(L10n.lookup(italian: "Anno in cui è nata"))
                        BBTextField(text: $amount, placeholder: L10n.lookup(italian: "Importo ({0})", ["0": taxes.currency]), keyboard: .amount)
                    }
                    BBTextField(text: $note, placeholder: L10n.lookup(italian: "Nota (facoltativa)"))
                    BBText(L10n.lookup(italian: "Usa il residuo dello zaino che vedi nel rendiconto fiscale del broker, con l'anno in cui è nato."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                    if let error { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
                    HStack(spacing: BBSpacing.space2) {
                        BBButton(L10n.lookup(italian: "Aggiungi"), size: .sm, isLoading: saving) { add() }
                        BBButton(L10n.lookup(italian: "Annulla"), variant: .ghost, size: .sm) { adding = false }
                    }
                }
                .padding(BBSpacing.space3)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.6)))
            } else {
                BBButton(L10n.lookup(italian: "Aggiungi minusvalenza pregressa"), variant: .outline, size: .sm) {
                    year = String(taxes.currentYear - 1)
                    amount = ""
                    note = ""
                    error = nil
                    adding = true
                }
            }
        }
    }

    private func add() {
        let value = BBFormat.parseAmount(amount)
        if let problem = TaxRules.carryforwardError(year: Int(year), amount: value, currentYear: taxes.currentYear) {
            error = problem
            return
        }
        saving = true
        Task {
            let trimmed = note.trimmingCharacters(in: .whitespaces)
            error = await model.addCarryforward(year: Int(year)!, amount: value!, note: trimmed.isEmpty ? nil : trimmed)
            saving = false
            if error == nil { adding = false }
        }
    }
}

private struct OpportunitiesSection: View {
    let taxes: InvestmentsTaxes
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let o = taxes.opportunities
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: taxes.currency, locale: locale, maximumFractionDigits: 0, masked: hide) }
        if o.expiringThisYear > 0 || !o.losses.isEmpty {
            PanelSection(title: L10n.lookup(italian: "Da sapere"), icon: .lightbulb, color: .bbSwatchAmber) {
                if o.expiringThisYear > 0 {
                    RunsText(runs: [
                        InvestmentsTextRun(money(o.expiringThisYear), .neg),
                        InvestmentsTextRun(" \(L10n.lookup(italian: "di minusvalenze scadono il 31 dicembre")) \(taxes.currentYear)."
                                           + (o.compensableGains.isEmpty
                                              ? L10n.lookup(italian: " Non hai posizioni in guadagno che possano usarle: gli ETF non compensano lo zaino.")
                                              : L10n.lookup(italian: " Le posizioni in guadagno che potrebbero usarle valgono {0} di plusvalenze (base 26%):", ["0": money(o.compensableTotal)]))),
                    ], style: BBTypography.body)
                    rows(o.compensableGains, positive: true, money: money)
                }
                if !o.losses.isEmpty {
                    BBText("\(L10n.lookup(italian: "Hai posizioni in perdita per")) \(money(o.lossesTotal)) \(L10n.lookup(italian: "(base 26%): vendendole, la minusvalenza entrerebbe nello zaino per 4 anni, anche quella di un ETF."))",
                           style: BBTypography.body)
                    rows(o.losses, positive: false, money: money)
                }
                BBText(L10n.lookup(italian: "Informazioni per capire l'effetto fiscale, non un consiglio di vendita."), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    private func rows(_ items: [InvestmentsTaxes.OpportunityRow], positive: Bool, money: @escaping (Double) -> String) -> some View {
        VStack(spacing: BBSpacing.space1) {
            ForEach(items.prefix(4), id: \.instrumentId) { row in
                HStack {
                    BBText(taxes.instrument(row.instrumentId)?.name ?? L10n.lookup(italian: "Strumento"), style: BBTypography.body, color: .bbMutedForeground, lineLimit: 1)
                    Spacer()
                    BBText("\(positive ? "+" : BBFormat.minusSign)\(money(abs(row.unrealized)))", style: BBTypography.body, color: positive ? .bbPos : .bbNeg)
                        .monospacedDigit()
                }
            }
        }
    }
}

/// INV-090: regime switch (saved immediately) and disclaimer.
private struct RegimeNote: View {
    let model: InvestmentsModel
    let regime: String
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBText(L10n.lookup(italian: "Sono stime secondo le regole italiane, non un calcolo fiscale: per la dichiarazione fai riferimento al broker o a un commercialista."),
                   style: BBTypography.body, color: .bbMutedForeground)
            HStack(spacing: BBSpacing.space2) {
                BBText(L10n.lookup(italian: "Regime"), style: BBTypography.body, color: .bbMutedForeground)
                InfoHintButton(title: L10n.lookup(italian: "Cos'è: regime"),
                               text: L10n.lookup(italian: "Amministrato (quasi tutti i broker italiani): il broker trattiene le tasse a ogni vendita e una minusvalenza compensa solo le plusvalenze che realizzi dopo. Dichiarativo (di solito i broker esteri, come IBKR o DEGIRO): paghi in dichiarazione e nell'anno si sommano tutte. Le crypto seguono sempre la dichiarazione."))
                SegmentedControl(options: [("amministrato", L10n.lookup(italian: "Amministrato")), ("dichiarativo", L10n.lookup(italian: "Dichiarativo"))],
                                 selection: Binding(get: { regime }, set: { next in
                                     guard !saving, next != regime else { return }
                                     saving = true
                                     Task {
                                         await model.setRegime(next)
                                         saving = false
                                     }
                                 }), accessibilityLabel: L10n.lookup(italian: "Regime fiscale del portafoglio"))
            }
        }
    }
}

/// Instrument settings (INV-082, SEC-050…052): tax rate / harmonised (IT only) and bond coupons.
struct InstrumentSettingsView: View {
    let model: InvestmentsModel
    let instrument: Instrument
    let setting: InvestmentsTaxes.Setting?
    let resolved: InvestmentsTaxes.Resolved?
    let onClose: () -> Void
    @State private var rate = ""
    @State private var harmonized = ""
    @State private var couponRate = ""
    @State private var frequency = 2
    @State private var maturity = ""
    @State private var hasMaturity = false
    @State private var error: String?
    @State private var saving = false
    @State private var loaded = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let italian = model.taxesEnabled
        let fund = instrument.kind == .etf || instrument.kind == .fondo
        let bond = instrument.kind == .obbligazione
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .settings, title: instrument.name, description: L10n.lookup(italian: italian ? "Valgono solo per te: servono a stimare tasse e proventi." : "Valgono solo per te: servono a stimare i proventi."))
            if italian {
                FormDialogSection(title: L10n.lookup(italian: "Imposte")) {
                    BBSelect(label: L10n.lookup(italian: "Aliquota"), options: [
                        ("", L10n.lookup(italian: "Automatica ({0})", ["0": BBFormat.formatPct(resolved?.taxRate ?? 0.26, locale: locale)])),
                        ("0.26", L10n.lookup(italian: "26% (ordinaria)")), ("0.125", L10n.lookup(italian: "12,5% (titoli di Stato)")),
                    ], selection: $rate)
                    if fund {
                        BBSelect(label: L10n.lookup(italian: "Armonizzato UE"), options: [
                            ("", L10n.lookup(italian: "Automatico ({0})", ["0": L10n.lookup(italian: resolved?.harmonized == false ? "no" : "sì")])),
                            ("si", L10n.lookup(italian: "Sì (UCITS)")), ("no", L10n.lookup(italian: "No")),
                        ], selection: $harmonized)
                    }
                }
            }
            if bond {
                FormDialogSection(title: L10n.lookup(italian: "Cedole")) {
                    BBTextField(label: L10n.lookup(italian: "Tasso annuo lordo (%)"), text: $couponRate, placeholder: L10n.lookup(italian: "Es. 3,85"), keyboard: .amount)
                    BBSelect(label: L10n.lookup(italian: "Frequenza"), options: [(1, L10n.lookup(italian: "Annuale")), (2, L10n.lookup(italian: "Semestrale")),
                                                                             (4, L10n.lookup(italian: "Trimestrale"))],
                             selection: $frequency, title: L10n.lookup(italian: "Frequenza delle cedole"))
                    if hasMaturity {
                        BBDateField(label: L10n.lookup(italian: "Scadenza"), date: $maturity)
                    } else {
                        BBButton(L10n.lookup(italian: "Scadenza"), icon: .calendarDays, variant: .outline, size: .sm) {
                            maturity = InvestmentsModel.todayKey
                            hasMaturity = true
                        }
                    }
                    BBText(L10n.lookup(italian: "Le date delle cedole si contano a ritroso dalla scadenza."), style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            if let error { BBErrorBox(message: L10n.lookup(italian: error)) }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: "Torna all'automatico"), variant: .ghost, isDisabled: setting == nil || saving) {
                    save(InstrumentSettingsInput())
                }
                Spacer(minLength: 0)
                BBButton(L10n.lookup(italian: saving ? "Salvataggio…" : "Salva"), isLoading: saving) {
                    let couponValue = BBFormat.parseAmount(couponRate)
                    let maturityValue = hasMaturity ? maturity : nil
                    if bond, let problem = TaxRules.couponsError(rate: couponValue, maturity: maturityValue) {
                        error = problem
                        return
                    }
                    let hasCoupons = bond && couponValue != nil
                    save(InstrumentSettingsInput(taxRate: italian && !rate.isEmpty ? rate : nil,
                                                 taxHarmonized: italian && fund && !harmonized.isEmpty ? harmonized == "si" : nil,
                                                 couponRate: hasCoupons ? couponValue! / 100 : nil, couponFrequency: hasCoupons ? frequency : nil,
                                                 maturityDate: hasCoupons ? maturityValue : nil))
                }
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            if let s = setting {
                if let r = s.taxRate, let v = Double(r) { rate = v == 0.125 ? "0.125" : "0.26" }
                if let h = s.taxHarmonized { harmonized = h ? "si" : "no" }
                if let c = s.couponRate.flatMap(Double.init) { couponRate = OperationForm.numberText((c * 100 * 10_000).rounded() / 10_000) }
                if let fq = s.couponFrequency { frequency = fq }
                if let m = s.maturityDate { maturity = m; hasMaturity = true }
            }
        }
    }

    private func save(_ input: InstrumentSettingsInput) {
        saving = true
        error = nil
        Task {
            error = await model.saveSettings(instrument.id, input)
            saving = false
            if error == nil { onClose() }
        }
    }
}
