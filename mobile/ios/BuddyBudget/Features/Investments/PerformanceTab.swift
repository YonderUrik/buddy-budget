import BuddyBudgetKit
import SwiftUI

/// Investimenti › Performance (INV-031…044): period, returns card with inspection on the chart, benchmark, risk and
/// heatmap. All figures come from `GET /api/investments/performance`. Android: PerformanceTab.kt.
struct PerformanceTab: View {
    let model: InvestmentsModel
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let gate: InvestmentsGate = {
            switch model.performance {
            case .loading: return .loading
            case .failed: return .failed
            case .loaded(let p): return p.hasTransactions ? .content : (model.state.excludedBrokers.isEmpty ? .empty : .emptyFiltered)
            }
        }()
        InvestmentsGateView(gate: gate, model: model, onRetry: { Task { await model.loadPerformance() } }) {
            if let perf = model.performance.value { content(perf) }
        }
    }

    @ViewBuilder private func content(_ perf: InvestmentsPerformance) -> some View {
        let text = InvestmentsText(locale: locale, masked: hide, translate: { L10n.lookup(italian: $0) })
        let periodLabel = perf.returns.map { "\(text.date($0.values.fromKey)) – \(text.date($0.values.toKey))" }
            ?? L10n.lookup(italian: "Nessuna operazione nell’intervallo")
        VStack(alignment: .leading, spacing: BBSpacing.space10) {
            if debugShows(0) {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(L10n.lookup(italian: "Periodo della performance"), style: BBTypography.bodyStrong)
                        BBText(periodLabel, style: BBTypography.body, color: .bbMutedForeground)
                    }
                    InvestmentsPeriodSelector(period: model.state.performancePeriod, range: model.state.performanceCustomRange,
                                              today: model.state.today, onPeriod: { model.setPerformancePeriod($0) },
                                              onApply: { model.applyPerformanceRange($0) })
                    if model.selection != nil {
                        HStack(spacing: BBSpacing.space2) {
                            BBText("\(L10n.lookup(italian: "Intervallo selezionato sul grafico ·")) \(periodLabel)", style: BBTypography.body)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            BBButton(L10n.lookup(italian: "Torna al periodo scelto"), variant: .outline, size: .sm) { model.selectRange(nil) }
                        }
                        .padding(BBSpacing.space3)
                        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.3)))
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
                    }
                }
            }
            if debugShows(1) {
                if let returns = perf.returns {
                    ReturnsCard(model: model, perf: perf, returns: returns, text: text)
                } else {
                    BBText(L10n.lookup(italian: "Nessuna operazione nell’intervallo scelto. Seleziona un altro periodo."), style: BBTypography.body,
                           color: .bbMutedForeground)
                        .padding(BBSpacing.space4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
                }
            }
            if debugShows(2), let risk = perf.risk {
                RiskCard(risk: risk, benchmarkName: perf.benchmark?.name, currency: perf.currency, text: text,
                         periodLabel: L10n.lookup(italian: "Periodo del grafico · {0}", ["0": periodLabel]))
            }
            if let returns = perf.returns, !returns.series.isEmpty {
                HeatmapCard(perf: perf, text: text, periodLabel: periodLabel)
            }
        }
    }
}

// MARK: - Returns (INV-031…040)

private struct ReturnsCard: View {
    let model: InvestmentsModel
    let perf: InvestmentsPerformance
    let returns: InvestmentsPerformance.ReturnsSeries
    let text: InvestmentsText
    @State private var choosing = false
    @State private var retrying = false

    var body: some View {
        let inspected = model.inspectIndex.flatMap { InvestmentsRules.nearestInspect($0, in: perf.inspect) }
        let values = inspected?.values ?? returns.values
        let dates = text.rangeLabel(values)
        PanelSection(title: L10n.lookup(italian: "Rendimenti del periodo"), icon: .trendingUp) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText("\(L10n.lookup(italian: inspected != nil ? "Anteprima dal grafico" : "Periodo del grafico")) · \(dates)",
                       style: BBTypography.body, color: .bbMutedForeground)
                BBText("\(L10n.lookup(italian: "Importi e rendimenti in")) \(perf.currency)\(L10n.lookup(italian: ". Passa su un numero per capire cosa misura."))",
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            Grid(alignment: .topLeading, horizontalSpacing: BBSpacing.space4, verticalSpacing: BBSpacing.space5) {
                GridRow {
                    ReturnMetric(label: "Portafoglio · TWR", value: values.twr, annual: values.twrAnnual, dates: dates, text: text,
                                 description: "La performance degli investimenti. È la linea del grafico.",
                                 hint: L10n.lookup(italian: "Il rendimento ponderato per il tempo (TWR) concatena i rendimenti giornalieri e neutralizza acquisti e vendite. Misura la performance degli strumenti, senza dare più peso ai giorni in cui avevi più soldi investiti. È il valore da confrontare con un indice."))
                    ReturnMetric(label: "I tuoi versamenti · MWR", value: values.moneyWeighted, annual: values.moneyWeightedAnnual, dates: dates,
                                 text: text, description: "Tiene conto di quanto e quando hai investito.",
                                 hint: L10n.lookup(italian: "Il rendimento ponderato per il denaro (MWR), calcolato con XIRR e riportato alla durata del periodo, considera importi e date dei tuoi movimenti. Può differire dal TWR se hai investito di più prima di un rialzo o di un calo. Non è la linea del grafico. Se non esiste un tasso calcolabile, mostriamo un trattino."))
                }
                if model.showsInflation {
                    GridRow {
                        let country = L10n.lookup(italian: LocaleRules.countryLabel(model.env.session.country))
                        ReturnMetric(label: "Potere d’acquisto · Reale", value: values.real?.value, annual: nil, dates: dates, text: text,
                                     description: "Il TWR dopo l’effetto dell’inflazione.",
                                     hint: L10n.lookup(italian: "Corregge il rendimento TWR per l’aumento dei prezzi nel paese del prodotto ({0}, indice Eurostat). Un valore positivo indica un aumento del potere d’acquisto. È una stima che usa l’ultimo dato mensile di inflazione disponibile: la data è indicata sotto il numero. Non è la linea del grafico.", ["0": country]),
                                     note: values.real.map { real in
                                         L10n.lookup(italian: "Inflazione ({2}) {0} fino a {1}", [
                                             "2": country, "0": text.pct(real.inflation ?? 0),
                                             "1": BBFormat.formatMonthLabel(real.throughMonth ?? "", locale: text.locale).lowercased(),
                                         ])
                                     } ?? L10n.lookup(italian: "Dati sull’inflazione insufficienti per questo intervallo."))
                        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                    }
                }
            }
            BBText(values.timingInsight ?? L10n.lookup(italian: "TWR e MWR misurano aspetti diversi dello stesso periodo."), style: BBTypography.body,
                   color: .bbMutedForeground)
            benchmarkSummary(values)
            if returns.series.count >= 2 { chart }
        }
        .formDialog(isPresented: $choosing) {
            BenchmarkDialog(model: model, current: perf.benchmark) { choosing = false }
        }
    }

    @ViewBuilder private func benchmarkSummary(_ values: ReturnValues) -> some View {
        let name = perf.benchmark?.name ?? L10n.lookup(italian: "questo strumento")
        if values.benchmarkStatus == "none" {
            HStack(spacing: BBSpacing.space3) {
                BBText(L10n.lookup(italian: "Avresti fatto meglio con un indice? Confronta gli stessi versamenti con un ETF."), style: BBTypography.body,
                       color: .bbMutedForeground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BBButton(L10n.lookup(italian: "Scegli un confronto"), variant: .outline, size: .sm) { choosing = true }
            }
            .padding(BBSpacing.space3)
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
        } else if values.benchmarkStatus == "missing_prices" || values.benchmark == nil {
            let wait = BenchmarkRules.wait(backfill: model.benchmarkBackfill, firstPriceDate: perf.benchmarkFirstPriceDate,
                                           baseKey: values.baseKey ?? values.fromKey)
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    BBText(waitMessage(wait, name: name), style: BBTypography.body, color: .bbMutedForeground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if wait.canRetry {
                        BBButton(L10n.lookup(italian: retrying ? "Riprovo…" : "Riprova"), variant: .outline, size: .sm, isDisabled: retrying) {
                            guard let id = perf.benchmark?.id else { return }
                            retrying = true
                            Task {
                                _ = await model.setBenchmark(id)
                                retrying = false
                            }
                        }
                    }
                    BBButton(L10n.lookup(italian: "Cambia"), variant: .ghost, size: .sm) { choosing = true }
                }
                ProgressBar(state: progress(wait), label: L10n.lookup(italian: "Prezzi di {0}", ["0": name]))
            }
            .padding(BBSpacing.space3)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.5)))
        } else if let comparison = values.benchmark, let simulated = comparison.simulatedValue, let portfolio = comparison.portfolioValue {
            let verdict = BenchmarkRules.verdict(portfolioValue: portfolio, simulatedValue: simulated)
            let difference = portfolio - simulated
            let money = { (v: Double) in text.money(v, perf.currency, digits: 0) }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                HStack(alignment: .top, spacing: BBSpacing.space2) {
                    (Text(verbatim: L10n.lookup(italian: verdict == "better" ? "Il tuo portafoglio ha fatto meglio"
                                                : verdict == "worse" ? "L'indice avrebbe fatto meglio" : "Praticamente pari"))
                        .foregroundColor(.bbForeground)
                        + Text(verbatim: verdict == "even" ? "" : " (\(BBFormat.formatSignedCurrency(difference, currency: perf.currency, locale: text.locale)))")
                        .foregroundColor(.bbSigned(difference)))
                        .bbTextStyle(BBTypography.bodyStrong)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBButton(L10n.lookup(italian: "Cambia"), variant: .ghost, size: .sm) { choosing = true }
                }
                let asOf = model.inspectIndex != nil ? L10n.lookup(italian: "al {0}", ["0": text.date(values.toKey)]) : L10n.lookup(italian: "oggi")
                RunsText(runs: [
                    InvestmentsTextRun("\(L10n.lookup(italian: "Con gli stessi versamenti in")) ", .muted),
                    InvestmentsTextRun(name),
                    InvestmentsTextRun(" \(asOf) \(L10n.lookup(italian: "avresti")) ", .muted),
                    InvestmentsTextRun(money(simulated), .strong),
                    InvestmentsTextRun(" \(L10n.lookup(italian: "invece di")) ", .muted),
                    InvestmentsTextRun(money(portfolio), .strong),
                    InvestmentsTextRun("\(L10n.lookup(italian: ". Nel periodo l'ETF di confronto ha reso")) \(text.pct(comparison.twr ?? 0))"
                        + (comparison.twrAnnual.map { " (\(text.pct($0)) \(L10n.lookup(italian: "l'anno)")))" } ?? "") + ".", .muted),
                ], style: BBTypography.body)
                if comparison.depleted == true {
                    BBText(L10n.lookup(italian: "Le vendite hanno superato il valore dell'indice simulato, che si è azzerato."), style: BBTypography.caption,
                           color: .bbMutedForeground)
                }
            }
            .padding(BBSpacing.space3)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.5)))
        }
    }

    private func progress(_ wait: BenchmarkWait) -> BBProgressState {
        switch wait {
        case .checking: .indeterminate
        case .downloading(let saved, let total): total.map { .determinate(value: Double(saved), max: Double($0)) } ?? .indeterminate
        default: .none
        }
    }

    private func waitMessage(_ wait: BenchmarkWait, name: String) -> String {
        switch wait {
        case .checking: L10n.lookup(italian: "Controllo i prezzi di {0}…", ["0": name])
        case .downloading(let saved, let total):
            total.map { L10n.lookup(italian: "Scarico i prezzi di {0}: {1} giorni su {2}. Il confronto compare appena finito.",
                                    ["0": name, "1": String(saved), "2": String($0)]) }
                ?? L10n.lookup(italian: "Chiedo alle fonti lo storico dei prezzi di {0}. Il confronto compare appena finito.", ["0": name])
        case .failed:
            L10n.lookup(italian: "Non sono riuscito a scaricare i prezzi di {0}: le fonti non hanno risposto. Puoi riprovare o scegliere un altro indice.", ["0": name])
        case .noHistory(let first):
            L10n.lookup(italian: "{0} ha prezzi solo dal {1}, dopo l'inizio del periodo. Scegli un periodo più corto o un altro indice.",
                        ["0": name, "1": text.date(first)])
        case .incomplete:
            L10n.lookup(italian: "Mancano alcuni prezzi o cambi di {0} nel periodo. Riprova a scaricarli.", ["0": name])
        }
    }

    private var chart: some View {
        let series = returns.series
        let hasBenchmark = returns.values.benchmark != nil && series.contains { $0.benchmark != nil }
        var lines = [InvestmentsSeries(id: "twr", values: series.map(\.portfolio), color: .bbPrimary, style: .line)]
        if hasBenchmark { lines.append(InvestmentsSeries(id: "bench", values: series.map(\.benchmark), color: .bbSwatchAmber, style: .line)) }
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Rendimento del portafoglio · TWR cumulato"), style: BBTypography.bodyStrong)
            InvestmentsChart(count: series.count, series: lines, height: 220, zeroBased: true,
                             accessibilitySummary: L10n.lookup(italian: "Rendimento del portafoglio · TWR cumulato"),
                             selection: Binding(get: { model.inspectIndex }, set: { model.inspectIndex = $0 })) { i in
                let p = series[i]
                VStack(alignment: .leading, spacing: 2) {
                    BBText(CalendarDate(iso: p.date).map { BBFormat.formatLongDate($0, locale: text.locale) } ?? p.date, style: BBTypography.caption,
                           color: .bbMutedForeground, lineLimit: 1)
                    BBText("\(L10n.lookup(italian: "Portafoglio · TWR")) \(text.pct(p.portfolio))", style: BBTypography.caption, lineLimit: 1)
                    if hasBenchmark, let b = p.benchmark, let name = perf.benchmark?.name {
                        BBText("\(name) \(text.pct(b))", style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                    }
                }
                .monospacedDigit()
            }
            // Web phone layout: the chart sits inside the page margins with its dates underneath.
            ChartAxisLabels(labels: series.map { BBFormat.formatShortDate($0.date, locale: text.locale) })
            HStack(spacing: BBSpacing.space4) {
                ChartLegendItem(label: L10n.lookup(italian: "Portafoglio · TWR"), color: .bbPrimary)
                if hasBenchmark, let name = perf.benchmark?.name { ChartLegendItem(label: name, color: .bbSwatchAmber) }
            }
            .frame(maxWidth: .infinity)
            BBText(L10n.lookup(italian: "Tieni premuto e scorri su una data per aggiornare i numeri sopra, oppure scegli le date in «Personalizzato»."),
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}

/// One return figure; tap opens its explanation (mobile adaptation of the web popover).
private struct ReturnMetric: View {
    let label: String
    let value: Double?
    let annual: Double?
    let dates: String
    let text: InvestmentsText
    let description: String
    let hint: String
    var note: String?
    @State private var open = false

    var body: some View {
        let formatted = value.map(text.pct) ?? L10n.lookup(italian: "Non disponibile")
        Button { open = true } label: {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                HStack(spacing: BBSpacing.space1) {
                    BBText(L10n.lookup(italian: label), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
                    BBIconView(.info, points: 14, color: .bbMutedForeground)
                }
                BBText(value == nil ? "—" : formatted, style: BBTypography.statValue.with(size: 24, lineHeight: 32),
                       color: value.map { $0 < 0 ? .bbNeg : .bbPos } ?? .bbMutedForeground, lineLimit: 1)
                    .monospacedDigit()
                BBText(L10n.lookup(italian: "Cumulato nel periodo"), style: BBTypography.caption, color: .bbMutedForeground)
                if let annual {
                    BBText("\(text.pct(annual)) \(L10n.lookup(italian: "annualizzato"))", style: BBTypography.caption, color: .bbMutedForeground)
                        .monospacedDigit()
                }
                BBText(L10n.lookup(italian: description), style: BBTypography.caption, color: .bbMutedForeground)
                if let note { BBText(note, style: BBTypography.caption, color: .bbMutedForeground) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.lookup(italian: "{0}: {1}. Mostra la spiegazione", ["0": L10n.lookup(italian: label), "1": formatted]))
        .bbSheet(isPresented: $open, title: "\(L10n.lookup(italian: label)) · \(formatted)") {
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(dates, style: BBTypography.caption, color: .bbMutedForeground)
                BBText(hint, style: BBTypography.body)
                if value != nil {
                    BBText(L10n.lookup(italian: "La percentuale principale è il rendimento complessivo di questo intervallo. Il valore annualizzato, quando presente, è il tasso annuo equivalente."),
                           style: BBTypography.caption, color: .bbMutedForeground)
                }
            }
        }
    }
}

/// «Confronta con un indice» (INV-038).
struct BenchmarkDialog: View {
    let model: InvestmentsModel
    let current: Instrument?
    let onClose: () -> Void
    @State private var pending = false
    @State private var error: String?
    @State private var search: InstrumentSearchModel?
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .gitCompareArrows, title: L10n.lookup(italian: "Confronta con un indice"),
                             description: L10n.lookup(italian: "Confrontiamo gli stessi versamenti, negli stessi giorni, con un ETF ad accumulazione."),
                             color: .bbSwatchIndigo)
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.lookup(italian: "Benchmark comuni"), style: BBTypography.bodyStrong)
                BBText(L10n.lookup(italian: "Scegli un indice: il confronto usa l’ETF ad accumulazione indicato."), style: BBTypography.caption,
                       color: .bbMutedForeground)
                ForEach(BenchmarkRules.suggestions) { s in
                    let selected = current?.isin == s.isin
                    Button {
                        run {
                            do {
                                let created = try await env.instruments.create(.yahoo(symbol: s.yahooSymbol, name: s.name, type: "etf", isin: s.isin),
                                                                               deferHistory: true)
                                return await model.setBenchmark(created.id)
                            } catch {
                                return (error as? APIError)?.body?.message ?? L10n.lookup(italian: "Qualcosa è andato storto. Riprova.")
                            }
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            BBText(L10n.lookup(italian: s.label) + (selected ? L10n.lookup(italian: " · Attuale") : ""), style: BBTypography.bodyStrong)
                            BBText(L10n.lookup(italian: s.description), style: BBTypography.caption, color: .bbMutedForeground)
                            BBText("\(s.name) · \(s.yahooSymbol)", style: BBTypography.caption, color: .bbMutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(BBSpacing.space3)
                        .background(RoundedRectangle.bb(BBRadius.lg).fill(selected ? Color.bbSecondary : Color.clear))
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(selected ? Color.clear : Color.bbBorder, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(translate: false))
                    .bbDisabled(pending)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                InstrumentPickerField(instrument: nil, suggestions: [], currency: model.currency, placeholder: "Oppure cerca un altro strumento",
                                      isDisabled: pending) { chosen in
                    run { await model.setBenchmark(chosen.id) }
                }
            }
            if pending { BBText(L10n.lookup(italian: "Salvo e scarico i prezzi…"), style: BBTypography.body, color: .bbMutedForeground) }
            if let error { BBText(error, style: BBTypography.body, color: .bbDestructive) }
            if current != nil {
                BBButton(L10n.lookup(italian: "Togli il confronto"), variant: .ghost, isDisabled: pending) {
                    run { await model.setBenchmark(nil) }
                }
            }
        }
    }

    private func run(_ work: @escaping () async -> String?) {
        pending = true
        error = nil
        Task {
            let result = await work()
            pending = false
            if let result { error = result } else { onClose() }
        }
    }
}

// MARK: - Risk (INV-041…043)

private struct RiskCard: View {
    let risk: InvestmentsPerformance.Risk
    let benchmarkName: String?
    let currency: String
    let text: InvestmentsText
    let periodLabel: String
    @State private var selection: Int?

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Quanto rischia"), icon: .shieldAlert, color: .bbSwatchOrange, description: periodLabel) {
            if let volatility = risk.volatility {
                let level = risk.level ?? TitleRules.riskLevel(volatility: volatility)
                VStack(alignment: .leading, spacing: BBSpacing.space5) {
                    RiskMeter(level: level, position: risk.scalePosition ?? TitleRules.riskScalePosition(volatility: volatility),
                              volatilityText: "±\(BBFormat.formatPct(volatility, locale: text.locale))",
                              insight: [risk.levelInsight, risk.volatilityInsight].compactMap { $0 }.joined(separator: " "),
                              hint: L10n.lookup(italian: "Nome tecnico: volatilità. Di quanto si muove di solito il valore in un anno, in più o in meno. Più è alta, più il percorso è accidentato."))
                    VStack(alignment: .leading, spacing: BBSpacing.space5) {
                        RiskMetric(label: "Perdita peggiore",
                                   value: risk.drawdown.map { $0.depth < 0 ? text.pct($0.depth) : "0%" } ?? "0%",
                                   note: L10n.lookup(italian: "dal massimo"),
                                   description: risk.drawdown.map { text.drawdownText($0, recoveryDays: risk.recoveryDays) },
                                   hint: "Nome tecnico: massima perdita dal picco (drawdown). Quanto hai visto scendere il portafoglio, al massimo, rispetto al suo valore più alto. Non conta i versamenti.")
                        RiskMetric(label: "Rischio ripagato?",
                                   value: risk.sharpe == nil ? nil : RiskCopy.sharpeWord(risk.sharpeLevel).map { L10n.lookup(italian: $0) },
                                   note: risk.sharpe.map { L10n.lookup(italian: "Sharpe {0}", ["0": BBFormat.formatRatio($0, digits: 2, locale: text.locale)]) }
                                       ?? L10n.lookup(italian: "servono 3 mesi di dati"),
                                   description: risk.sharpe == nil ? nil : risk.sharpeInsight,
                                   hint: "Nome tecnico: Sharpe ratio. Quanto rendimento in più di un conto deposito hai avuto per ogni unità di rischio. Sotto 0,5 è poco, sopra 1 è buono.")
                        if let name = benchmarkName {
                            let bench = risk.benchmark
                            RiskMetric(label: "Quanto segue l'indice",
                                       value: bench?.beta.map { BBFormat.formatRatio($0, digits: 2, locale: text.locale) },
                                       note: bench?.correlation.map { L10n.lookup(italian: "correlazione {0}", ["0": BBFormat.formatRatio($0, digits: 2, locale: text.locale)]) }
                                           ?? L10n.lookup(italian: "servono 3 mesi di dati"),
                                       description: bench?.beta == nil ? nil : risk.betaInsight,
                                       hint: L10n.lookup(italian: "Nome tecnico: beta rispetto a {0}. 1 vuol dire che si muove come l'indice, 0,5 la metà, 1,5 una volta e mezza. La correlazione (da −1 a 1) dice quanto i movimenti vanno nella stessa direzione.", ["0": name]),
                                       hintTranslated: true)
                        }
                    }
                    let footnote = [risk.fewData ? L10n.lookup(italian: "Meno di un anno di dati: numeri indicativi.") : nil,
                                    benchmarkName == nil ? L10n.lookup(italian: "Scegli un indice in «Rendimenti del periodo» per vedere quanto lo segui.") : nil]
                        .compactMap { $0 }.joined(separator: " ")
                    if !footnote.isEmpty { BBText(footnote, style: BBTypography.caption, color: .bbMutedForeground) }
                    VStack(alignment: .leading, spacing: 0) {
                        if risk.drawdownSeries.count >= 2 {
                            InvestmentsDisclosure(title: L10n.lookup(italian: "Guarda le cadute nel tempo")) {
                                BBText(L10n.lookup(italian: "Quanto il portafoglio era sotto il suo massimo, giorno per giorno."), style: BBTypography.body,
                                       color: .bbMutedForeground)
                                let points = risk.drawdownSeries
                                InvestmentsChart(count: points.count, series: [InvestmentsSeries(id: "dd", values: points.map(\.drawdown), color: .bbNeg, style: .area)],
                                                 height: 160, zeroBased: true, accessibilitySummary: L10n.lookup(italian: "Guarda le cadute nel tempo"),
                                                 selection: $selection) { i in
                                    VStack(alignment: .leading, spacing: 2) {
                                        BBText(text.date(points[i].date), style: BBTypography.caption, color: .bbMutedForeground)
                                        BBText(text.pct(points[i].drawdown), style: BBTypography.caption)
                                    }
                                }
                            }
                        }
                        InvestmentsDisclosure(title: L10n.lookup(italian: "Come è calcolato")) {
                            RiskMethod()
                            if risk.sharpe != nil {
                                BBText(risk.riskFreeRate.map { L10n.lookup(italian: "Conto con il tasso €STR medio del periodo ({0}).", ["0": BBFormat.formatPct($0, locale: text.locale)]) }
                                       ?? L10n.lookup(italian: currency != "EUR" ? "Calcolato senza tasso privo di rischio (disponibile solo per l'euro)."
                                                      : "Calcolato senza tasso privo di rischio: il tasso €STR non è ancora stato scaricato."),
                                       style: BBTypography.body, color: .bbMutedForeground)
                            }
                        }
                    }
                }
            } else {
                BBText(L10n.lookup(italian: "Servono almeno 20 giorni di borsa nel periodo per misurare il rischio. Prova un periodo più lungo o torna tra qualche giorno."),
                       style: BBTypography.body, color: .bbMutedForeground)
            }
        }
    }
}

/// 4-band risk scale with marker and the level word (INV-041, SEC-026).
struct RiskMeter: View {
    let level: Int
    let position: Double
    let volatilityText: String
    let insight: String
    let hint: String

    static func color(_ level: Int) -> Color {
        switch level {
        case 1: .bbRisk1
        case 2: .bbRisk2
        case 3: .bbRisk3
        default: .bbRisk4
        }
    }

    var body: some View {
        let label = L10n.lookup(italian: TitleRules.riskLevelLabels[max(0, min(3, level - 1))])
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                BBText(label, style: BBTypography.statValue, color: Self.color(level))
                HStack(spacing: BBSpacing.space1) {
                    BBText("\(volatilityText) \(L10n.lookup(italian: "all’anno"))", style: BBTypography.body, color: .bbMutedForeground)
                    InfoHintButton(title: L10n.lookup(italian: "Cos'è: quanto oscilla"), text: hint)
                }
            }
            VStack(spacing: BBSpacing.space1_5) {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        HStack(spacing: 4) {
                            ForEach(1...4, id: \.self) { step in
                                Capsule().fill(Self.color(step)).opacity(step == level ? 1 : 0.25).frame(height: 10)
                            }
                        }
                        Circle().fill(Color.bbForeground).frame(width: 16, height: 16)
                            .overlay(Circle().stroke(Color.bbBackground, lineWidth: 3))
                            .offset(x: proxy.size.width * position - 8)
                    }
                    .frame(height: 16)
                }
                .frame(height: 16)
                HStack(spacing: 4) {
                    ForEach(1...4, id: \.self) { step in
                        BBText(L10n.lookup(italian: TitleRules.riskLevelLabels[step - 1]), style: step == level ? BBTypography.caption.with(weight: 500) : BBTypography.caption,
                               color: step == level ? .bbForeground : .bbMutedForeground, lineLimit: 1)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .accessibilityElement()
            .accessibilityLabel(L10n.lookup(italian: "Livello di rischio {0}, {1} su 4", ["0": label, "1": String(level)]))
            if !insight.isEmpty { BBText(insight, style: BBTypography.body, color: .bbMutedForeground) }
        }
    }
}

private struct RiskMetric: View {
    let label: String
    let value: String?
    var note: String?
    var description: String?
    let hint: String
    var hintTranslated = false

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            HStack(spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: label), style: BBTypography.bodyStrong)
                InfoHintButton(title: L10n.lookup(italian: "Cos'è: {0}", ["0": L10n.lookup(italian: label)]),
                               text: hintTranslated ? hint : L10n.lookup(italian: hint))
            }
            HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
                BBText(value ?? "—", style: BBTypography.statValue.with(size: 24, lineHeight: 32)).monospacedDigit()
                if let note { BBText(note, style: BBTypography.caption, color: .bbMutedForeground) }
            }
            if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
        }
    }
}

private struct RiskMethod: View {
    var body: some View {
        let steps: [(String, String)] = [
            ("1. Rendimento di ogni giorno", L10n.lookup(italian: "Si parte dal rendimento giornaliero del portafoglio senza l'effetto dei versamenti e dei prelievi (il TWR, lo stesso dei rendimenti). Si scartano i giorni senza nulla di investito e i weekend fermi: con i mercati chiusi non c'è movimento e abbasserebbero il rischio. Servono almeno {0} giorni.", ["0": "20"])),
            ("2. Quanto oscilla", L10n.lookup(italian: "È la deviazione standard dei rendimenti giornalieri, portata a un anno moltiplicandola per la radice dei giorni di borsa in un anno (circa 252). Il ± dice quanto ci si muove di solito: in circa due anni su tre il valore resta dentro quell'intervallo.")),
            ("3. Il livello", L10n.lookup(italian: "Si legge l'oscillazione annua: sotto {0} basso (per esempio obbligazioni), fino a {1} medio, fino a {2} alto (l'azionario mondiale sta intorno al {3}), oltre molto alto. Sono soglie di lettura scelte da noi, non una classificazione ufficiale.", ["0": "8%", "1": "15%", "2": "25%", "3": "15%"])),
            ("4. Perdita peggiore", L10n.lookup(italian: "Si costruisce un indice che parte da 1 e segue i rendimenti giornalieri (così i versamenti non lo fanno salire). La perdita peggiore è la distanza massima da un picco al punto più basso successivo; «tornato al massimo» è il giorno in cui l'indice rivede quel picco.")),
            ("5. Rischio ripagato (Sharpe)", L10n.lookup(italian: "Rendimento medio giornaliero meno quello di un conto senza rischio (il tasso €STR, solo per l'euro), diviso per la deviazione standard e portato a un anno. Sotto 0 hai reso meno di un conto deposito, tra 0 e 0,5 poco, tra 0,5 e 1 discreto, sopra 1 bene. Serve almeno {0} giorni di dati.", ["0": "60"])),
            ("6. Quanto segue l'indice", L10n.lookup(italian: "Con un indice di confronto si usano solo i giorni in cui ci sono entrambi i prezzi. La correlazione (da −1 a 1) dice se vanno nella stessa direzione; il beta quanto si muove il portafoglio per ogni 1% dell'indice.")),
        ]
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            ForEach(steps, id: \.0) { title, body in
                VStack(alignment: .leading, spacing: 2) {
                    BBText(L10n.lookup(italian: title), style: BBTypography.bodyStrong)
                    BBText(body, style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            BBText(L10n.lookup(italian: "Il passato non dice come andrà in futuro: con meno di un anno di dati i numeri sono solo indicativi."),
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}

// MARK: - Heatmap (INV-044)

private struct HeatmapCard: View {
    let perf: InvestmentsPerformance
    let text: InvestmentsText
    let periodLabel: String
    @State private var grouping = "mese"
    @State private var inspected: HeatmapCell?

    private func heatmap(_ g: String) -> ReturnHeatmap? {
        switch g {
        case "giorno": perf.heatmaps.giorno
        case "settimana": perf.heatmaps.settimana
        case "anno": perf.heatmaps.anno
        default: perf.heatmaps.mese
        }
    }

    var body: some View {
        if let map = heatmap(grouping) {
            PanelSection(title: L10n.lookup(italian: "Rendimento TWR nel tempo"), icon: .calendarRange, color: .bbSwatchTeal,
                         description: L10n.lookup(italian: "{0}. Mesi e anni ai bordi possono essere parziali. ", ["0": periodLabel]) + text.heatmapSummary(map)) {
                ScrollableSegmentedControl(options: [("giorno", L10n.lookup(italian: "Giorni")), ("settimana", L10n.lookup(italian: "Settimane")),
                                                     ("mese", L10n.lookup(italian: "Mesi")), ("anno", L10n.lookup(italian: "Anni"))],
                                           selection: Binding(get: { grouping }, set: { grouping = $0; inspected = nil }),
                                           accessibilityLabel: L10n.lookup(italian: "Raggruppa i rendimenti per"))
                HeatmapGrid(heatmap: map, selected: inspected?.key) { inspected = $0 }
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    detail
                    legend
                }
            }
        }
    }

    @ViewBuilder private var detail: some View {
        if let cell = inspected {
            (Text(verbatim: L10n.lookup(italian: cell.label)).foregroundColor(.bbForeground)
                + (cell.ret.map { ret in
                    Text(verbatim: " · ").foregroundColor(.bbMutedForeground)
                        + Text(verbatim: text.pct(ret)).foregroundColor(ret < 0 ? .bbNeg : .bbPos)
                        + Text(verbatim: cell.gain.map { " · " + BBFormat.formatSignedCurrency($0, currency: perf.currency, locale: text.locale) } ?? "")
                        .foregroundColor(.bbMutedForeground)
                } ?? Text(verbatim: L10n.lookup(italian: " · niente investito")).foregroundColor(.bbMutedForeground)))
                .bbTextStyle(BBTypography.caption)
                .monospacedDigit()
        } else {
            BBText(L10n.lookup(italian: "Passa sopra o tocca una casella per il dettaglio."), style: BBTypography.caption, color: .bbMutedForeground)
        }
    }

    private var legend: some View {
        HStack(spacing: 6) {
            BBText(L10n.lookup(italian: "Perdita"), style: BBTypography.caption, color: .bbMutedForeground)
            ForEach((1...4).reversed(), id: \.self) { level in
                HeatmapSwatch(ret: -1, level: level).frame(width: 12, height: 12)
            }
            RoundedRectangle(cornerRadius: 3).fill(Color.bbMuted).frame(width: 12, height: 12)
            ForEach(1...4, id: \.self) { level in
                HeatmapSwatch(ret: 1, level: level).frame(width: 12, height: 12)
            }
            BBText(L10n.lookup(italian: "Guadagno"), style: BBTypography.caption, color: .bbMutedForeground)
        }
        .accessibilityHidden(true)
    }
}

private struct HeatmapGrid: View {
    let heatmap: ReturnHeatmap
    let selected: String?
    let onInspect: (HeatmapCell) -> Void
    @Environment(\.bbLocale) private var locale


    var body: some View {
        let showValue = heatmap.grouping == "mese" || heatmap.grouping == "anno"
        let hasTotal = heatmap.rows.contains { $0.total != nil }
        let hasLabels = heatmap.rows.contains { !$0.label.isEmpty }
        let small = !showValue
        let cell: CGFloat = small ? 12 : 44
        ScrollView(.horizontal) {
            Grid(alignment: .leading, horizontalSpacing: 3, verticalSpacing: 3) {
                GridRow {
                    if hasLabels { Color.clear.frame(width: 36, height: 1) }
                    ForEach(Array(heatmap.columns.enumerated()), id: \.offset) { _, label in
                        BBText(label, style: BBTypography.caption.with(size: 10, lineHeight: 16), color: .bbMutedForeground, lineLimit: 1)
                            .fixedSize()
                            .frame(width: cell, alignment: .leading)
                    }
                    if hasTotal {
                        BBText(L10n.lookup(italian: "Anno"), style: BBTypography.caption.with(size: 10, lineHeight: 16, weight: 500), lineLimit: 1)
                            .frame(width: cell)
                    }
                }
                ForEach(Array(heatmap.rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        if hasLabels {
                            BBText(row.label, style: BBTypography.caption.with(size: 10, lineHeight: 16), color: .bbMutedForeground).frame(width: 36, alignment: .leading)
                        }
                        ForEach(Array(row.cells.enumerated()), id: \.offset) { _, c in
                            cellView(c, size: cell, showValue: showValue)
                        }
                        if hasTotal { cellView(row.total, size: cell, showValue: true) }
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    @ViewBuilder private func cellView(_ c: HeatmapCell?, size: CGFloat, showValue: Bool) -> some View {
        if let c {
            Button { onInspect(c) } label: {
                ZStack {
                    HeatmapSwatch(ret: c.ret, level: c.level)
                    if showValue, let ret = c.ret {
                        BBText(BBFormat.formatSignedPct(ret, locale: locale).replacingOccurrences(of: "+", with: ""),
                               style: BBTypography.caption.with(size: 11, lineHeight: 14), color: c.level >= 3 ? .bbBackground : .bbForeground,
                               lineLimit: 1)
                            .minimumScaleFactor(0.6)
                            .monospacedDigit()
                    }
                }
                .frame(width: size, height: showValue ? 36 : size)
                .overlay(RoundedRectangle(cornerRadius: 3).stroke(selected == c.key ? Color.bbForeground : .clear, lineWidth: 2))
            }
            .buttonStyle(.plain)
        } else {
            Color.clear.frame(width: size, height: showValue ? 36 : size)
        }
    }
}

/// Web `heatmapCellColor`: `--pos` / `--neg` mixed into `--muted` (0, 30, 50, 72, 100 %).
struct HeatmapSwatch: View {
    let ret: Double?
    let level: Int

    var body: some View {
        let mix = [0, 0.30, 0.50, 0.72, 1.0][max(0, min(level, 4))]
        ZStack {
            RoundedRectangle(cornerRadius: 3).fill(Color.bbMuted)
            if let ret, level > 0 {
                RoundedRectangle(cornerRadius: 3).fill(ret > 0 ? Color.bbPos : Color.bbNeg).opacity(mix)
            }
        }
    }
}
