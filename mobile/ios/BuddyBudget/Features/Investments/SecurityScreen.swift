import BuddyBudgetKit
import SwiftUI

/// Security page `/investimenti/titoli/{id}` (SEC-015…053): header with follow / register, key facts, price chart,
/// automatic prices, numbers, position, risk, held funds, alerts, type-specific sections, commentary.
/// Android: SecurityScreen.kt.
struct SecurityScreen: View {
    let instrumentId: String
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @State private var model: SecurityModel?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let investments = shell.investments
        // Web phone layout: the name is the page title with the instrument's badge, «Segui» and «Registra» under it.
        BBScreen(title: nil, onBack: back, onRefresh: { await model?.load() }) {
            if let model {
                switch model.analysis {
                case .loading:
                    VStack(spacing: BBSpacing.space6) {
                        BBSkeleton(height: 120, radius: BBRadius.xl)
                        BBSkeleton(height: 240, radius: BBRadius.xl)
                        BBSkeleton(height: 160, radius: BBRadius.xl)
                    }
                case .failed:
                    LoadError(message: model.errorMessage ?? L10n.lookup(italian: "Impossibile caricare il titolo."), onRetry: { Task { await model.load() } })
                case .loaded(let a):
                    SecurityContent(model: model, investments: investments, a: a)
                }
            }
        }
        .task {
            if model == nil {
                let m = SecurityModel(env: env, instrumentId: instrumentId)
                m.onChanged = { [investments] in
                    await investments.loadTitles()
                    await investments.reloadAll()
                }
                model = m
                await m.load()
            }
        }
        .onDisappear { model?.stop() }
        .formDialog(isPresented: Binding(get: { investments.registerForm != nil && investments.registerHost == instrumentId }, set: { if !$0 { investments.registerForm = nil; investments.editing = nil; investments.registerHost = "" } })) {
            if let form = investments.registerForm { RegisterOperationView(model: investments, initial: form) }
        }
    }
}

private struct SecurityContent: View {
    let model: SecurityModel
    let investments: InvestmentsModel
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let isFund = a.instrument.kind == .etf || a.instrument.kind == .fondo
        VStack(alignment: .leading, spacing: BBSpacing.space10) {
            if debugShows(0) {
                VStack(alignment: .leading, spacing: BBSpacing.space6) {
                    SecurityHeader(model: model, investments: investments, a: a)
                    KeyFactsGrid(a: a)
                }
            }
            if debugShows(1) { PriceChartSection(model: model, a: a) }
            if a.instrument.priceMode == "manuale", a.instrument.isin != nil, a.instrument.createdByUserId != nil {
                QuotationSection(model: model, a: a)
            }
            if debugShows(2), let stats = a.stats { NumbersSection(a: a, stats: stats) }
            if debugShows(3), let position = a.position, position.quantity > 0 {
                PositionSection(a: a, position: position, italian: investments.taxesEnabled)
            }
            if debugShows(4), let stats = a.stats, let vol = stats.volatility {
                PanelSection(title: L10n.lookup(italian: "Quanto rischia"), icon: .shieldAlert, color: .bbSwatchOrange,
                             description: L10n.lookup(italian: "Nell'ultimo anno")) {
                    let level = TitleRules.riskLevel(volatility: vol)
                    RiskMeter(level: level, position: TitleRules.riskScalePosition(volatility: vol),
                              volatilityText: "±\(BBFormat.formatPct(vol, digits: 0, locale: locale))", insight: "",
                              hint: L10n.lookup(italian: "Volatilità annua: di norma il prezzo si muove di circa questa percentuale in un anno, in su o in giù (due anni su tre)."))
                    BBText("\(L10n.lookup(italian: "Calo peggiore dal massimo nell'ultimo anno:")) \(stats.maxDrawdown.map { $0 < -0.005 ? BBFormat.formatSignedPct($0, locale: locale) : L10n.lookup(italian: "nessuno") } ?? L10n.lookup(italian: "nessuno"))",
                           style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            if a.instrument.kind == .azione, !a.insideFunds.isEmpty { InsideFundsSection(a: a) }
            if debugShows(5) { AlertsSection(model: model, a: a) }
            if a.instrument.kind == .azione, let stock = a.stock {
                StockSections(a: a, stock: stock)
            } else if a.instrument.kind == .azione {
                FundamentalsCard(a: a)
            }
            if let composition = a.composition { FundCompositionSection(a: a, composition: composition) }
            if a.instrument.kind != .azione, !a.annualReturns.isEmpty { AnnualReturnsSection(a: a) }
            if isFund, a.fundamentals != nil { FundCostSections(a: a) }
            if isFund, a.fundamentals == nil, a.fundamentalsStatus != "unsupported" { FundamentalsCard(a: a) }
            if let dividends = a.dividends { DividendsSection(a: a, dividends: dividends) }
            if a.commentaryAvailable, a.stats != nil { CommentarySection(model: model) }
            if let note = sourceNote {
                BBText(L10n.lookup(italian: note), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    private var sourceNote: String? {
        if a.instrument.kind == .azione, a.stock != nil {
            return "Bilanci, numeri chiave e date di stacco da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; multipli, valori per azione e confronti con il passato calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita."
        }
        if a.instrument.kind == .etf || a.instrument.kind == .fondo {
            return "Composizione, TER e multipli del paniere da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; rendimenti, costi e sovrapposizioni calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita."
        }
        return nil
    }
}

// MARK: - Header, key facts, chart

private struct SecurityHeader: View {
    let model: SecurityModel
    let investments: InvestmentsModel
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let instrument = a.instrument
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                HStack(alignment: .center, spacing: BBSpacing.space3) {
                    InstrumentIconView(instrument: instrument, size: 32)
                    BBText(instrument.name, style: .sectionHeading).accessibilityAddTraits(.isHeader)
                }
                HStack(spacing: BBSpacing.space2) {
                    BBText([L10n.lookup(italian: InstrumentIcons.typeLabel(instrument.kind)), instrument.isin, instrument.currency]
                        .compactMap { $0 }.joined(separator: " · "), style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                    if a.position != nil { BBBadge(L10n.lookup(italian: "Posseduto"), variant: .secondary) }
                }
                .padding(.leading, 44)
            }
            HStack(spacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: a.watching ? "Non seguire più" : "Segui"), icon: a.watching ? .eyeOff : .eye,
                         variant: .ghost, size: .sm, isLoading: model.followPending) { Task { await model.toggleFollow() } }
                BBButton(L10n.lookup(italian: "Registra"), icon: .plus, size: .sm) {
                    investments.registerHost = instrument.id
                    investments.openRegister(OperationForm(instrument: instrument, date: InvestmentsModel.todayKey))
                }
            }
            if let stats = a.stats {
                MoneyHero(value: stats.lastClose, currency: instrument.currency)
                    .padding(.top, BBSpacing.space2)
                var parts: [Text] = []
                let _ = {
                    if let d = stats.dayChange {
                        parts.append(Text(verbatim: BBFormat.formatSignedPct(d, locale: locale)).foregroundColor(.bbSigned(d))
                                     + Text(verbatim: " \(L10n.lookup(italian: "nel giorno ·")) ").foregroundColor(.bbMutedForeground))
                    }
                    if let y = stats.returns["1A"] {
                        parts.append(Text(verbatim: BBFormat.formatSignedPct(y, locale: locale)).foregroundColor(.bbSigned(y))
                                     + Text(verbatim: " \(L10n.lookup(italian: "in un anno ·")) ").foregroundColor(.bbMutedForeground))
                    }
                    parts.append(Text(verbatim: "\(L10n.lookup(italian: "chiusura del")) \(BBFormat.formatShortDate(stats.lastDate, locale: locale))")
                        .foregroundColor(.bbMutedForeground))
                }()
                parts.reduce(Text(verbatim: ""), +).bbTextStyle(BBTypography.body).monospacedDigit()
            }
        }
    }
}

private struct KeyFactsGrid: View {
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let facts = TitleFormat.keyFacts(a, locale: locale)
        if !facts.isEmpty {
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)],
                      alignment: .leading, spacing: BBSpacing.space4) {
                ForEach(Array(facts.enumerated()), id: \.offset) { _, f in
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(L10n.lookup(italian: f.label), style: BBTypography.caption, color: .bbMutedForeground)
                        BBText(L10n.lookup(italian: f.value), style: BBTypography.cardTitle.with(size: 18, lineHeight: 26), lineLimit: 1)
                            .minimumScaleFactor(0.7).monospacedDigit()
                        if let note = f.note { BBText(L10n.lookup(italian: note, f.noteValues), style: BBTypography.caption, color: .bbMutedForeground) }
                    }
                }
            }
            // Web: the facts sit on the page under a thin top border, not in a card.
            .padding(.top, BBSpacing.space4)
            .overlay(alignment: .top) { BBSeparator() }
        }
    }
}

private struct PriceChartSection: View {
    let model: SecurityModel
    let a: TitleAnalysis
    @State private var selection: Int?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let series = a.series
        let rising = TitleRules.isRising(series)
        let average = a.position?.averagePrice
        let markers = a.position.map { TitleRules.purchaseMarkers(series: series, purchases: $0.purchases) } ?? []
        PanelSection(title: L10n.lookup(italian: "Andamento"), icon: .chartLine) {
            PeriodSelector(options: TitlePeriod.allCases.map { ($0, $0.rawValue) }, selection: Binding(get: { model.period }, set: { model.setPeriod($0) }),
                           accessibilityLabel: L10n.lookup(italian: "Periodo del grafico"))
            if series.count < 2 {
                BBText(L10n.lookup(italian: a.backfilling ? "Sto scaricando lo storico dei prezzi…" : "Non ci sono ancora abbastanza prezzi per il grafico."),
                       style: BBTypography.body, color: .bbMutedForeground)
                    .frame(maxWidth: .infinity, minHeight: 120)
            } else {
                InvestmentsChart(count: series.count,
                                 series: [InvestmentsSeries(id: "close", values: series.map(\.close), color: rising ? .bbPos : .bbNeg, style: .area)],
                                 height: 220, reference: average, markers: markers,
                                 accessibilitySummary: L10n.lookup(italian: "Andamento"), selection: $selection) { i in
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(CalendarDate(iso: series[i].date).map { BBFormat.formatLongDate($0, locale: locale) } ?? series[i].date, style: BBTypography.caption,
                               color: .bbMutedForeground)
                        BBText("\(L10n.lookup(italian: "Chiusura")) \(BBFormat.formatPrice(series[i].close, currency: a.instrument.currency, locale: locale))",
                               style: BBTypography.caption)
                    }
                    .monospacedDigit()
                }
                // Web phone layout: inside the page margins, dates underneath.
                ChartAxisLabels(labels: series.map { BBFormat.formatShortDate($0.date, locale: locale) })
                if let average {
                    HStack(spacing: BBSpacing.space4) {
                        if !markers.isEmpty {
                            HStack(spacing: BBSpacing.space1_5) {
                                Circle().fill(Color.bbForeground).frame(width: 8, height: 8)
                                BBText(L10n.lookup(italian: "I tuoi acquisti"), style: BBTypography.caption, color: .bbMutedForeground)
                            }
                        }
                        ChartLegendItem(label: "\(L10n.lookup(italian: "Il tuo prezzo medio ("))\(BBFormat.formatPrice(average, currency: a.instrument.currency, locale: locale)))",
                                        color: .bbMutedForeground, dashed: true)
                    }
                    .frame(maxWidth: .infinity)
                }
                if a.backfilling {
                    BBText(L10n.lookup(italian: "Sto ancora scaricando lo storico: il grafico si completa da solo."), style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        }
    }
}

// MARK: - Automatic prices (SEC-028)

private struct QuotationSection: View {
    let model: SecurityModel
    let a: TitleAnalysis

    var body: some View {
        let isin = a.instrument.isin ?? ""
        let cur = a.instrument.currency
        PanelSection(title: L10n.lookup(italian: "Prezzi automatici"), icon: .link) {
            BBText("\(L10n.lookup(italian: "Questo titolo ha solo i prezzi del rendiconto ("))\(isin)\(L10n.lookup(italian: "). Collegalo a una quotazione in")) \(cur) \(L10n.lookup(italian: "per avere prezzi aggiornati ogni giorno, rendimenti, settori e sovrapposizioni."))",
                   style: BBTypography.body, color: .bbMutedForeground)
            if model.quotationsLoading {
                BBText("\(L10n.lookup(italian: "Cerco le quotazioni di")) \(isin)…", style: BBTypography.body, color: .bbMutedForeground)
            } else if let q = model.quotations {
                switch q.status {
                case "ok":
                    ForEach(q.candidates ?? [], id: \.symbol) { c in
                        HStack {
                            BBText("\(c.symbol) · \(c.exchange ?? L10n.lookup(italian: "Borsa non indicata")) · \(c.currency)", style: BBTypography.body)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            BBButton(L10n.lookup(italian: "Collega"), variant: .outline, size: .sm) { Task { await model.link(c.symbol) } }
                        }
                    }
                case "empty":
                    BBText("\(L10n.lookup(italian: "Non ho trovato una quotazione in")) \(cur) \(L10n.lookup(italian: "per questo ISIN: restano i prezzi del rendiconto."))",
                           style: BBTypography.body, color: .bbMutedForeground)
                default:
                    BBText(L10n.lookup(italian: "Le fonti non rispondono in questo momento. Riprova tra poco."), style: BBTypography.body, color: .bbMutedForeground)
                }
            } else {
                BBButton(L10n.lookup(italian: "Cerca la quotazione"), variant: .outline, size: .sm) { Task { await model.searchQuotations() } }
            }
            if let error = model.quotationError { BBText(error, style: BBTypography.body, color: .bbDestructive) }
        }
    }
}

// MARK: - Numbers, position, held funds

private struct NumbersSection: View {
    let a: TitleAnalysis
    let stats: TitleAnalysis.Stats
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let returns = TitleRules.returnKeys.compactMap { k in stats.returns[k.key].map { (k.label, $0) } }
        PanelSection(title: L10n.lookup(italian: "In numeri"), icon: .chartNoAxesColumn) {
            if returns.isEmpty {
                BBText(L10n.lookup(italian: "Lo storico è ancora troppo corto per calcolare le variazioni."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)],
                          alignment: .leading, spacing: BBSpacing.space3) {
                    ForEach(returns, id: \.0) { label, value in
                        VStack(alignment: .leading, spacing: 2) {
                            BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
                            BBText(BBFormat.formatSignedPct(value, locale: locale), style: BBTypography.cardTitle.with(size: 18, lineHeight: 26),
                                   color: .bbSigned(value)).monospacedDigit()
                        }
                    }
                }
            }
            if let low = stats.low52, let high = stats.high52 {
                let pos = TitleFormat.rangePosition(last: stats.lastClose, low: low, high: high)
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    (Text(verbatim: L10n.lookup(italian: "Forbice dell'ultimo anno"))
                        + Text(verbatim: (stats.fromHigh ?? 0) < -0.005
                               ? " · \(BBFormat.formatPct(-(stats.fromHigh ?? 0), locale: locale)) \(L10n.lookup(italian: "sotto il massimo"))"
                               : " \(L10n.lookup(italian: "· sui massimi"))").foregroundColor(.bbMutedForeground))
                        .bbTextStyle(BBTypography.body)
                    GeometryReader { p in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.bbMuted).frame(height: 6)
                            Circle().fill(Color.bbForeground).frame(width: 12, height: 12)
                                .overlay(Circle().stroke(Color.bbBackground, lineWidth: 2))
                                .offset(x: p.size.width * pos - 6)
                        }
                    }
                    .frame(height: 12)
                    .accessibilityLabel(L10n.lookup(italian: "Ultima chiusura al {0}% della forbice tra minimo e massimo a 52 settimane",
                                                    ["0": String(Int(JSNumber.round(pos * 100)))]))
                    HStack {
                        BBText("\(L10n.lookup(italian: "Min")) \(BBFormat.formatPrice(low, currency: a.instrument.currency, locale: locale))", style: BBTypography.caption,
                               color: .bbMutedForeground)
                        Spacer()
                        BBText("\(L10n.lookup(italian: "Max")) \(BBFormat.formatPrice(high, currency: a.instrument.currency, locale: locale))", style: BBTypography.caption,
                               color: .bbMutedForeground)
                    }
                }
            }
        }
    }
}

private struct PositionSection: View {
    let a: TitleAnalysis
    let position: TitleAnalysis.Position
    let italian: Bool
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let cur = a.instrument.currency
        var items: [(String, String, Color)] = [
            ("Valore", BBFormat.formatCurrency(position.value, currency: cur, locale: locale, masked: hide), .bbForeground),
            ("Guadagno sul prezzo medio", position.gain.map { g in
                BBFormat.formatSignedCurrency(g, currency: cur, locale: locale, masked: hide) + (position.changeVsAverage.map { " · \(BBFormat.formatSignedPct($0, locale: locale))" } ?? "")
            } ?? "—", .bbSigned(position.gain)),
            // INV-112: quantity and average price are the user's money too.
            ("Quote", hide ? BBFormat.amountMask : BBFormat.formatNumber(position.quantity, maximumFractionDigits: 6, locale: locale), .bbForeground),
            ("Prezzo medio", position.averagePrice.map { BBFormat.formatPrice($0, currency: cur, locale: locale, masked: hide) } ?? "—", .bbForeground),
        ]
        if position.incomeReceived > 0 {
            items.insert(("Proventi incassati (lordi)", BBFormat.formatCurrency(position.incomeReceived, currency: cur, locale: locale, masked: hide), .bbForeground), at: 2)
        }
        return PanelSection(title: L10n.lookup(italian: "La tua posizione"), icon: .briefcase) {
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading,
                      spacing: BBSpacing.space3) {
                ForEach(items, id: \.0) { label, value, color in
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
                        BBText(value, style: BBTypography.bodyStrong, color: color).monospacedDigit()
                    }
                }
            }
            BBText("\(L10n.lookup(italian: "Valori nella valuta del titolo ("))\(cur)\(L10n.lookup(italian: italian ? "), senza cambio né tasse. Il guadagno completo è nelle schede Portafoglio e Tasse." : "), senza cambio né stime fiscali."))",
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}

private struct InsideFundsSection: View {
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Ce l'hai già dentro"), icon: .layers, color: .bbSwatchViolet) {
            ForEach(a.insideFunds, id: \.id) { fund in
                HStack {
                    BBText(fund.name, style: BBTypography.body).frame(maxWidth: .infinity, alignment: .leading)
                    if let w = fund.weight {
                        BBText(L10n.lookup(italian: "{0} del fondo", ["0": BBFormat.formatPct(w, locale: locale)]), style: BBTypography.body,
                               color: .bbMutedForeground)
                    }
                }
            }
            BBText(L10n.lookup(italian: "Dai primi titoli dei fondi che possiedi (fonte Yahoo Finance)."), style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}

// MARK: - Alerts (SEC-029…033)

private struct AlertsSection: View {
    let model: SecurityModel
    let a: TitleAnalysis
    @State private var above = true
    @State private var level = ""
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let cur = a.instrument.currency
        let parsed = TitleRules.parseAlertLevel(level)
        PanelSection(title: L10n.lookup(italian: "Avvisi di prezzo"), icon: .bell, color: .bbSwatchAmber) {
            if a.alerts.isEmpty {
                BBText(L10n.lookup(italian: a.instrument.hasAutomaticPrices ? "Nessun avviso. Ti scrivo per email quando la chiusura raggiunge il livello che scegli."
                                   : "Gli avvisi funzionano solo per i titoli con prezzi automatici."), style: BBTypography.body, color: .bbMutedForeground)
            }
            ForEach(a.alerts) { alert in
                HStack(spacing: BBSpacing.space3) {
                    BBIconView(alert.isTriggered ? .bellRing : .bell, size: .md, color: alert.isTriggered ? .bbSwatchAmber : .bbMutedForeground)
                    VStack(alignment: .leading, spacing: 2) {
                        BBText("\(L10n.lookup(italian: alert.isAbove ? "Sale sopra" : "Scende sotto")) \(BBFormat.formatPrice(alert.target, currency: cur, locale: locale))",
                               style: BBTypography.bodyStrong)
                        BBText(alert.isTriggered
                               ? L10n.lookup(italian: "Scattato il {0} con la chiusura a {1}", ["0": BBFormat.formatShortDate(String((alert.triggeredAt ?? "").prefix(10)), locale: locale),
                                                                                                "1": BBFormat.formatPrice(alert.triggered ?? 0, currency: cur, locale: locale)])
                               : L10n.lookup(italian: "In attesa: controllo ogni sera dopo la chiusura"), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconButton(icon: .trash2, accessibilityLabel: L10n.lookup(italian: "Elimina avviso")) { Task { await model.deleteAlert(alert) } }
                }
            }
            if a.instrument.hasAutomaticPrices {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    SegmentedControl(options: [(true, L10n.lookup(italian: "Sale sopra")), (false, L10n.lookup(italian: "Scende sotto"))], selection: $above,
                                     accessibilityLabel: L10n.lookup(italian: "Direzione dell'avviso"), stretch: true)
                    BBTextField(label: "\(L10n.lookup(italian: "Livello ("))\(cur))", text: $level,
                                placeholder: a.stats.map { L10n.lookup(italian: "Ultima chiusura {0}", ["0": BBFormat.formatPrice($0.lastClose, currency: cur, locale: locale)]) }
                                    ?? L10n.lookup(italian: "Prezzo"),
                                error: !level.isEmpty && parsed == nil ? L10n.lookup(italian: "Prezzo non valido") : nil, keyboard: .amount)
                    if let error = model.alertError { BBText(error, style: BBTypography.body, color: .bbDestructive) }
                    BBButton(L10n.lookup(italian: "Crea avviso"), icon: .bell, isLoading: model.alertPending, isDisabled: parsed == nil) {
                        guard let parsed else { return }
                        Task { if await model.createAlert(above: above, level: parsed) { level = "" } }
                    }
                }
            }
        }
    }
}

// MARK: - Fundamentals

private struct FundamentalsCard: View {
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let cur = a.instrument.currency
        let items: [(String, String, String)] = {
            guard let f = a.fundamentals else { return [] }
            let compact = { (v: Double) in "\(BBFormat.formatCompactAmount(v, locale: locale)) \(cur)" }
            let ratio = { (v: Double, d: Int) in BBFormat.formatRatio(v, digits: d, locale: locale) }
            let rows: [(String, String, String)?] = [
                f.expenseRatio.map { ("Costo annuo (TER)", BBFormat.formatPct($0, digits: 2, locale: locale), "Quanto costa tenerlo ogni anno, già scalato dal prezzo.") },
                f.totalAssets.map { ("Patrimonio gestito", compact($0), "Più è grande, di solito più è facile comprarlo e venderlo.") },
                f.marketCap.map { ("Capitalizzazione", compact($0), "Valore di mercato dell'intera azienda.") },
                f.trailingPE.map { ("P/E", ratio($0, 1), "Anni di utili necessari a ripagare il prezzo, ai ritmi di oggi.") },
                f.forwardPE.map { ("P/E atteso", ratio($0, 1), "Lo stesso calcolo sugli utili previsti dagli analisti.") },
                f.priceToBook.map { ("Prezzo / patrimonio (P/B)", ratio($0, 1), "Sotto 1 costa meno del patrimonio contabile dell'azienda.") },
                f.eps.map { ("Utile per azione", "\(ratio($0, 2)) \(cur)", "Utile degli ultimi 12 mesi diviso il numero di azioni.") },
                f.dividendYield.map { ("Rendimento da dividendo", BBFormat.formatPct($0, digits: 2, locale: locale), "Dividendo annuo diviso il prezzo attuale.") },
                f.profitMargin.map { ("Margine di profitto", BBFormat.formatPct($0, locale: locale), "Quanto resta di utile su ogni 100 di ricavi.") },
                f.returnOnEquity.map { ("Redditività del capitale (ROE)", BBFormat.formatPct($0, locale: locale), "Utile in rapporto al capitale degli azionisti.") },
                f.revenueGrowth.map { ("Crescita dei ricavi", BBFormat.formatPct($0, locale: locale), "Rispetto allo stesso periodo dell'anno prima.") },
                f.debtToEquity.map { ("Debiti / capitale", ratio($0 / 100, 2), "Sopra 1 l'azienda ha più debiti che capitale proprio.") },
                f.beta.map { ("Beta", ratio($0, 2), "Sopra 1 si muove più del mercato, sotto 1 meno.") },
            ]
            return rows.compactMap { $0 }
        }()
        PanelSection(title: L10n.lookup(italian: "Numeri chiave"), icon: .chartColumn) {
            if items.isEmpty {
                BBText(L10n.lookup(italian: a.fundamentalsStatus == "unavailable" ? "Yahoo non ha risposto o non ha questi dati per il titolo. Riprova più tardi."
                                   : "Nessun dato disponibile per questo titolo."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading,
                          spacing: BBSpacing.space4) {
                    ForEach(items, id: \.0) { label, value, hint in
                        VStack(alignment: .leading, spacing: 2) {
                            BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
                            BBText(value, style: BBTypography.cardTitle.with(size: 18, lineHeight: 26)).monospacedDigit()
                            BBText(L10n.lookup(italian: hint), style: BBTypography.caption, color: .bbMutedForeground)
                        }
                    }
                }
                BBText(L10n.lookup(italian: "Fonte: Yahoo Finance, aggiornata una volta al giorno. Dati non ufficiali, da usare come orientamento."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }
}

/// One computed indicator (SEC-035…037): value, hint, optional history bar, «?» with the real division.
private struct IndicatorItem: View {
    let key: String
    let indicator: TitleAnalysis.Indicator
    let currency: String
    let priceCurrency: String
    @State private var open = false
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let meta = TitleFormat.indicatorMeta[key]!
        let value = format(indicator.value, meta.format)
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            HStack(spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: meta.label), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
                Button { open = true } label: {
                    BBIconView(.circleQuestionMark, points: 14, color: .bbMutedForeground).bbHitArea(height: 14, width: 14)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L10n.lookup(italian: "Come si calcola: {0}", ["0": L10n.lookup(italian: meta.label)]))
            }
            BBText(value, style: BBTypography.cardTitle.with(size: 20, lineHeight: 28)).monospacedDigit()
            if let h = indicator.history {
                GeometryReader { p in
                    let span = max(h.max - h.min, 0.0001)
                    let x = { (v: Double) in p.size.width * CGFloat(min(1, max(0, (v - h.min) / span))) }
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.bbMuted).frame(height: 6)
                        Rectangle().fill(Color.bbMutedForeground).frame(width: 2, height: 10).offset(x: x(h.average) - 1)
                        Circle().fill(Color.bbPrimary).frame(width: 10, height: 10).offset(x: x(indicator.value) - 5)
                    }
                }
                .frame(height: 10)
                HStack {
                    BBText("\(L10n.lookup(italian: "min")) \(format(h.min, meta.format))", style: BBTypography.caption, color: .bbMutedForeground)
                    Spacer()
                    BBText("\(L10n.lookup(italian: "max")) \(format(h.max, meta.format))", style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            BBText(L10n.lookup(italian: meta.hint), style: BBTypography.caption, color: .bbMutedForeground)
        }
        .bbSheet(isPresented: $open, title: L10n.lookup(italian: meta.label)) {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.lookup(italian: meta.formula), style: BBTypography.body)
                BBText("\(TitleFormat.operand(indicator.numerator, currency: currency, priceCurrency: priceCurrency, locale: locale, sharesWord: L10n.lookup(italian: "azioni"))) \(L10n.lookup(italian: "÷")) \(TitleFormat.operand(indicator.denominator, currency: currency, priceCurrency: priceCurrency, locale: locale, sharesWord: L10n.lookup(italian: "azioni"))) = \(value)",
                       style: BBTypography.bodyStrong).monospacedDigit()
                BBText(L10n.lookup(italian: "Calcolato dall'app sui bilanci pubblicati da Yahoo Finance (non ufficiali)."), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    private func format(_ v: Double, _ f: String) -> String {
        let text = TitleFormat.indicator(v, format: f, locale: locale)
        return f == "years" ? L10n.lookup(italian: "{0} anni", ["0": text]) : text
    }
}

private struct IndicatorGrid: View {
    let keys: [String]
    let map: [String: TitleAnalysis.Indicator]
    let currency: String
    let priceCurrency: String

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading,
                  spacing: BBSpacing.space5) {
            ForEach(keys.filter { map[$0] != nil }, id: \.self) { key in
                IndicatorItem(key: key, indicator: map[key]!, currency: currency, priceCurrency: priceCurrency)
            }
        }
    }
}

private struct StockSections: View {
    let a: TitleAnalysis
    let stock: TitleAnalysis.StockFundamentals
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let priceCurrency = a.instrument.currency
        VStack(alignment: .leading, spacing: BBSpacing.space10) {
            PanelSection(title: L10n.lookup(italian: "Quanto costa rispetto a quello che produce"), icon: .scale,
                         description: L10n.lookup(italian: "Multipli calcolati con l'ultima chiusura e i bilanci degli ultimi 12 mesi.")) {
                if !stock.priceComparable {
                    BBText(L10n.lookup(italian: "I bilanci sono in {0} e il prezzo in {1}: i multipli col prezzo non si calcolano.", ["0": stock.currency, "1": priceCurrency]),
                           style: BBTypography.body, color: .bbMutedForeground)
                } else if stock.valuation.isEmpty {
                    BBText(L10n.lookup(italian: "Con gli utili o la cassa di oggi questi multipli non hanno senso (sono negativi o mancano)."), style: BBTypography.body,
                           color: .bbMutedForeground)
                } else {
                    IndicatorGrid(keys: TitleFormat.valuationOrder, map: stock.valuation, currency: stock.currency, priceCurrency: priceCurrency)
                    BBText(L10n.lookup(italian: "La barra va dal minimo al massimo degli esercizi passati, con la tacca sulla media e il pallino sul valore di oggi."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            PanelSection(title: L10n.lookup(italian: "Per ogni azione"), icon: .table,
                         description: L10n.lookup(italian: "Ricavi, utili e cassa divisi per il numero di azioni.")) {
                ScrollView(.horizontal) {
                    Grid(alignment: .trailing, horizontalSpacing: BBSpacing.space4, verticalSpacing: BBSpacing.space2) {
                        GridRow {
                            BBText(L10n.lookup(italian: "Per azione"), style: BBTypography.caption, color: .bbMutedForeground).gridColumnAlignment(.leading)
                            ForEach(Array(stock.columns.enumerated()), id: \.offset) { _, c in
                                BBText(c.trailing ? L10n.lookup(italian: "12 mesi") : c.label, style: BBTypography.caption, color: .bbMutedForeground)
                            }
                        }
                        ForEach(TitleFormat.perShareRows, id: \.key) { row in
                            GridRow {
                                BBText(L10n.lookup(italian: row.label), style: BBTypography.body).gridColumnAlignment(.leading)
                                ForEach(Array((stock.perShare[row.key] ?? []).enumerated()), id: \.offset) { i, v in
                                    BBText(v.map { TitleFormat.perShare($0, currency: stock.currency, locale: locale) } ?? "—",
                                           style: i == stock.columns.count - 1 ? BBTypography.bodyStrong : BBTypography.body).monospacedDigit()
                                }
                            }
                        }
                    }
                }
                BBText(L10n.lookup(italian: "Calcolati dall'app: voce di bilancio ÷ numero medio di azioni dell'esercizio."), style: BBTypography.caption,
                       color: .bbMutedForeground)
            }
            PanelSection(title: L10n.lookup(italian: "I conti dell'azienda"), icon: .factory,
                         description: L10n.lookup(italian: "Esercizi annuali e ultimi 12 mesi, in valuta di bilancio.")) {
                ForEach([("Ricavi", stock.company.revenue), ("Utile netto", stock.company.netIncome), ("Cassa libera", stock.company.freeCashFlow)], id: \.0) { label, values in
                    MiniBars(label: L10n.lookup(italian: label), values: values, columns: stock.columns, currency: stock.currency)
                }
                IndicatorGrid(keys: TitleFormat.marginOrder, map: stock.margins, currency: stock.currency, priceCurrency: priceCurrency)
                if let g = stock.growth.lastYear {
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(L10n.lookup(italian: "Crescita dei ricavi"), style: BBTypography.caption, color: .bbMutedForeground)
                        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                            BBText(BBFormat.formatSignedPct(g, locale: locale), style: BBTypography.cardTitle.with(size: 20, lineHeight: 28), color: .bbSigned(g))
                            if let avg = stock.growth.average, stock.growth.averageYears >= 2 {
                                BBText("\(L10n.lookup(italian: "media {0} anni {1}", ["0": String(stock.growth.averageYears), "1": BBFormat.formatSignedPct(avg, locale: locale)]))",
                                       style: BBTypography.caption, color: .bbMutedForeground)
                            }
                        }
                        BBText(L10n.lookup(italian: "Ultimo esercizio rispetto al precedente."), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                }
            }
            if !stock.profitability.isEmpty {
                PanelSection(title: L10n.lookup(italian: "Quanto rende il capitale"), icon: .percent) {
                    IndicatorGrid(keys: TitleFormat.profitabilityOrder, map: stock.profitability, currency: stock.currency, priceCurrency: priceCurrency)
                }
            }
            if !stock.solidity.isEmpty {
                PanelSection(title: L10n.lookup(italian: "Debiti e solidità"), icon: .shield) {
                    IndicatorGrid(keys: TitleFormat.solidityOrder, map: stock.solidity, currency: stock.currency, priceCurrency: priceCurrency)
                }
            }
        }
    }
}

private struct MiniBars: View {
    let label: String
    let values: [Double?]
    let columns: [TitleAnalysis.StockFundamentals.Column]
    let currency: String
    @State private var selected: Int?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let maxValue = values.compactMap { $0.map(abs) }.max() ?? 1
        let lastIndex = values.lastIndex { $0 != nil }
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack {
                BBText(label, style: BBTypography.bodyStrong)
                Spacer()
                if let i = selected ?? lastIndex, let v = values[i] {
                    BBText("\(BBFormat.formatCompactAmount(v, locale: locale)) \(currency) · \(columns.indices.contains(i) ? (columns[i].trailing ? L10n.lookup(italian: "ultimi 12 mesi") : columns[i].label) : "")",
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(Array(values.enumerated()), id: \.offset) { i, v in
                    Button { selected = i } label: {
                        RoundedRectangle(cornerRadius: 2).fill((v ?? 0) < 0 ? Color.bbNeg : (i == lastIndex ? Color.bbPrimary : Color.bbPrimary.opacity(0.5)))
                            .frame(height: max(2, 48 * CGFloat(abs(v ?? 0) / maxValue)))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(height: 48, alignment: .bottom)
        }
    }
}

// MARK: - Fund sections (SEC-043…046), dividends (SEC-047), commentary (SEC-049)

private struct FundCompositionSection: View {
    let a: TitleAnalysis
    let composition: TitleAnalysis.Composition
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let top = Array(composition.holdings.prefix(10))
        let share = top.reduce(0) { $0 + $1.weight }
        let maxWeight = top.map(\.weight).max() ?? 1
        VStack(alignment: .leading, spacing: BBSpacing.space10) {
            if !top.isEmpty {
                PanelSection(title: L10n.lookup(italian: "Cosa c'è dentro"), icon: .layers,
                             description: L10n.lookup(italian: "Primi {0} titoli: {1} del fondo.", ["0": String(top.count), "1": BBFormat.formatPct(share, locale: locale)])) {
                    ForEach(Array(top.enumerated()), id: \.offset) { _, h in
                        weightRow(h.name, h.weight, maxWeight, color: .bbSwatchBlue)
                    }
                    ForEach(Array(composition.shared.enumerated()), id: \.offset) { _, s in
                        BBText("\(s.holding.name) — \(s.elsewhere.map(\.name).joined(separator: ", "))", style: BBTypography.caption, color: .bbMutedForeground)
                    }
                }
            }
            if let sectors = composition.sectors, !sectors.isEmpty {
                let sorted = sectors.sorted { $0.value > $1.value }
                PanelSection(title: L10n.lookup(italian: "Settori"), icon: .chartPie, description: L10n.lookup(italian: "Parte azionaria del fondo.")) {
                    ForEach(sorted, id: \.key) { key, w in
                        weightRow(L10n.lookup(italian: ExposureKeys.sectorLabels[key] ?? key), w, sorted.first?.value ?? 1,
                                  color: .bbSwatch(ExposureKeys.sectorColors[key] ?? "slate"))
                    }
                    BBText(L10n.lookup(italian: "Fonte: Yahoo Finance. Le aree geografiche arriveranno con i file degli emittenti."), style: BBTypography.caption,
                           color: .bbMutedForeground)
                }
            }
        }
    }

    /// Web phone row: name, bar and share on one line.
    private func weightRow(_ name: String, _ weight: Double, _ maxWeight: Double, color: Color) -> some View {
        HStack(spacing: BBSpacing.space3) {
            BBText(name, style: BBTypography.body, lineLimit: 1)
                .frame(width: 110, alignment: .leading)
            GeometryReader { p in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.bbMuted)
                    Capsule().fill(color).frame(width: p.size.width * CGFloat(weight / max(maxWeight, 0.0001)))
                }
            }
            .frame(height: 6)
            BBText(BBFormat.formatPct(weight, locale: locale), style: BBTypography.body, color: .bbMutedForeground)
                .monospacedDigit()
                .frame(width: 48, alignment: .trailing)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct AnnualReturnsSection: View {
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let rows = Array(a.annualReturns.sorted { $0.year > $1.year }.prefix(6))
        PanelSection(title: L10n.lookup(italian: "Anno per anno"), icon: .calendarRange,
                     description: L10n.lookup(italian: "Variazione del prezzo in ogni anno solare, senza dividendi né tasse.")) {
            ForEach(rows, id: \.year) { r in
                HStack {
                    BBText(r.partial ? L10n.lookup(italian: "{0} (finora)", ["0": String(r.year)]) : String(r.year), style: BBTypography.body)
                    Spacer()
                    BBText(BBFormat.formatSignedPct(r.value, locale: locale), style: BBTypography.bodyStrong, color: .bbSigned(r.value)).monospacedDigit()
                }
            }
        }
    }
}

private struct FundCostSections: View {
    let a: TitleAnalysis
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let f = a.fundamentals!
        let cur = a.instrument.currency
        VStack(alignment: .leading, spacing: BBSpacing.space10) {
            let basket: [(String, String)] = [
                f.holdingsPE.map { ("P/E medio", BBFormat.formatRatio($0, locale: locale)) }, f.holdingsPB.map { ("P/B medio", BBFormat.formatRatio($0, locale: locale)) },
                f.holdingsPS.map { ("P/S medio", BBFormat.formatRatio($0, locale: locale)) },
                f.fundYield.map { ("Rendimento da dividendo", BBFormat.formatPct($0, locale: locale)) },
            ].compactMap { $0 }
            if !basket.isEmpty {
                PanelSection(title: L10n.lookup(italian: "Quanto costa il paniere"), icon: .shoppingBag,
                             description: L10n.lookup(italian: "Media pesata dei titoli contenuti nel fondo.")) {
                    LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading) {
                        ForEach(basket, id: \.0) { label, value in
                            VStack(alignment: .leading, spacing: 2) {
                                BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
                                BBText(value, style: BBTypography.cardTitle.with(size: 18, lineHeight: 26)).monospacedDigit()
                            }
                        }
                    }
                    BBText(L10n.lookup(italian: "Fonte: Yahoo Finance, aggiornata una volta al giorno (non ufficiale)."), style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
            if let ter = f.expenseRatio, ter > 0 {
                let capital = "\(BBFormat.formatNumber(10_000, locale: locale)) \(cur)"
                PanelSection(title: L10n.lookup(italian: "Quanto ti costa tenerlo"), icon: .receiptText, color: .bbNeg,
                             description: L10n.lookup(italian: "Effetto del TER ({0}) su {1} con un rendimento ipotetico del {2} l'anno.",
                                                      ["0": BBFormat.formatPct(ter, digits: 2, locale: locale), "1": capital, "2": "5%"])) {
                    if let p = a.position {
                        costRow(L10n.lookup(italian: "Sulla tua posizione"), "≈ \(BBFormat.formatCurrency(p.value * ter, currency: cur, locale: locale)) \(L10n.lookup(italian: "l'anno"))")
                    }
                    ForEach([10, 20], id: \.self) { years in
                        costRow(L10n.lookup(italian: "Dopo {0} anni", ["0": String(years)]),
                                "\(BBFormat.minusSign)\(BBFormat.formatCurrency(TitleRules.terCost(ter: ter, years: years), currency: cur, locale: locale, maximumFractionDigits: 0))")
                    }
                    BBText(L10n.lookup(italian: "Differenza rispetto allo stesso fondo senza costi."), style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        }
    }

    private func costRow(_ label: String, _ value: String) -> some View {
        HStack {
            BBText(label, style: BBTypography.body)
            Spacer()
            BBText(value, style: BBTypography.bodyStrong).monospacedDigit()
        }
    }
}

private struct DividendsSection: View {
    let a: TitleAnalysis
    let dividends: TitleAnalysis.DividendFacts
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let cur = a.instrument.currency
        let maxAmount = dividends.perYear.map(\.amount).max() ?? 1
        PanelSection(title: L10n.lookup(italian: "Dividendi"), icon: .handCoins, color: .bbSwatchAmber,
                     description: L10n.lookup(italian: "Dividendo per quota con data di stacco nell'anno; l'anno in corso è parziale.")) {
            HStack(alignment: .bottom, spacing: BBSpacing.space2) {
                ForEach(dividends.perYear, id: \.year) { y in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 2).fill(y.partial ? Color.bbSwatchAmber.opacity(0.4) : Color.bbSwatchAmber)
                            .frame(height: max(2, 64 * CGFloat(y.amount / max(maxAmount, 0.0001))))
                        BBText(String(y.year), style: BBTypography.caption.with(size: 11, lineHeight: 14), color: .bbMutedForeground)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 84, alignment: .bottom)
            if let current = dividends.perYear.last, current.partial {
                BBText("\(current.year) \(L10n.lookup(italian: "finora:")) \(TitleFormat.perShare(current.amount, currency: cur, locale: locale)) \(L10n.lookup(italian: "per quota."))",
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading,
                      spacing: BBSpacing.space3) {
                if let y = dividends.yieldToday { stat("Rendimento oggi", BBFormat.formatPct(y, locale: locale)) }
                if let y = dividends.yieldOnCost { stat("Sul tuo prezzo medio", BBFormat.formatPct(y, locale: locale)) }
                if let g = dividends.growth { stat("Crescita media", "\(BBFormat.formatSignedPct(g, locale: locale)) \(L10n.lookup(italian: "l'anno"))") }
                if let next = dividends.nextExDate { stat("Prossimo stacco", BBFormat.formatDateWithYear(next, locale: locale)) }
            }
            if dividends.nextExDate != nil {
                BBText(L10n.lookup(italian: "Data annunciata secondo Yahoo, da confermare."), style: BBTypography.caption, color: .bbMutedForeground)
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: BBTypography.bodyStrong).monospacedDigit()
        }
    }
}

private struct CommentarySection: View {
    let model: SecurityModel

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Commento"), icon: .sparkles, color: .bbSwatchViolet,
                     description: L10n.lookup(italian: "Un riassunto in parole semplici di come è andato il titolo, scritto da un modello in esecuzione sul server.")) {
            if let text = model.commentary { BBText(text, style: BBTypography.body) }
            if case .failed(let message) = model.commentaryState {
                BBText(message ?? L10n.lookup(italian: "Il modello non ha risposto. Riprova tra poco."), style: BBTypography.body, color: .bbMutedForeground)
            }
            BBButton(L10n.lookup(italian: model.commentaryState == .writing ? "Sto scrivendo…" : model.commentary == nil ? "Genera commento" : "Riscrivi"),
                     icon: .sparkles, variant: .outline, size: .sm, isLoading: model.commentaryState == .writing) {
                Task { await model.generateCommentary() }
            }
            BBText(L10n.lookup(italian: "Generato automaticamente da dati di prezzo e numeri chiave: può sbagliare e non è una raccomandazione di investimento."),
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}
