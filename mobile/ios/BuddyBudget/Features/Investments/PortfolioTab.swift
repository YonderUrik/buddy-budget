import BuddyBudgetKit
import SwiftUI

/// Investimenti › Portafoglio (INV-011…030): hero with the cost simulation, value chart, period selector, positions,
/// «Seguiti», dividends summary and costs. Android: PortfolioTab.kt.
struct PortfolioTab: View {
    let model: InvestmentsModel
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let query = model.state.portfolioQuery
        InvestmentsGateView(gate: model.gate(query, countsCash: true), model: model, onRetry: { Task { await model.loadPortfolio() } }) {
            if let view = model.views[query] {
                VStack(alignment: .leading, spacing: BBSpacing.space10) {
                    if debugShows(0) { PortfolioHeroSection(model: model, view: view) }
                    if debugShows(1) { PositionsSection(model: model, view: view) }
                    if debugShows(2) { WatchedTitlesSection(model: model) }
                    if debugShows(3) { DividendsSummary(view: view) { model.select(.income) } }
                    CostDetails(view: view, italian: model.taxesEnabled) { model.select(.taxes) }
                }
            }
        }
    }
}

// MARK: - Hero

private struct PortfolioHeroSection: View {
    let model: InvestmentsModel
    let view: InvestmentsView
    @State private var selection: Int?
    @State private var costsOpen = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let text = InvestmentsText(locale: locale, masked: hide, translate: { L10n.lookup(italian: $0) })
        let hero = PortfolioHero.of(view, reinvestFees: model.state.reinvestFees, reinvestTaxes: model.state.reinvestTaxes)
        let currency = view.currency
        let summary = view.summary
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(L10n.lookup(italian: "Il tuo portafoglio"), style: BBTypography.bodyLarge.with(weight: 500), color: .bbMutedForeground)
                MoneyHero(value: hero.value, currency: currency)
                if hero.showsDayChange, let change = summary.dayChange, let pct = summary.dayChangePct {
                    HStack(spacing: BBSpacing.space1) {
                        BBIconView(change < 0 ? .trendingDown : .trendingUp, points: 16, color: .bbSigned(change))
                        (Text(verbatim: text.dayChange(change, pct: pct, currency: currency, masked: hide)).foregroundColor(.bbSigned(change))
                            + Text(verbatim: " " + L10n.lookup(italian: "dall'ultima chiusura")).foregroundColor(.bbMutedForeground))
                            .bbTextStyle(BBTypography.body)
                            .monospacedDigit()
                    }
                }
                if !view.brokerCash.isEmpty {
                    BBText(text.cashLine(cash: view.cashTotal, total: summary.totalValue + view.cashTotal, currency: currency, masked: hide),
                           style: BBTypography.body, color: .bbMutedForeground)
                }
                if hero.simulating {
                    BBText(text.simulationLine(extra: hero.extra, currency: currency, masked: hide), style: BBTypography.body,
                           color: .bbMutedForeground)
                }
            }
            chart(hero: hero, text: text)
            HStack(alignment: .top, spacing: BBSpacing.space2) {
                InvestmentsPeriodSelector(period: model.state.period, range: model.state.customRange, today: model.state.today,
                                          onPeriod: { model.setPeriod($0) }, onApply: { model.applyCustomRange($0) })
            }
            costsButton
            if !hero.simulating {
                let showsPeriodGain = view.periodGain != nil && model.state.period != .max
                if showsPeriodGain, let gain = view.periodGain {
                    RunsText(runs: text.periodGainSentence(gain, currency: currency, masked: hide))
                } else {
                    RunsText(runs: text.gainSentence(view.breakdown, unpriced: summary.unpricedCount, currency: currency, masked: hide))
                    ValueBreakdownBar(breakdown: view.breakdown, currency: currency)
                }
            }
        }
        .bbSheet(isPresented: $costsOpen, title: L10n.lookup(italian: "E se costi e imposte fossero rimasti investiti?")) {
            ReinvestmentPanel(model: model, view: view)
        }
    }

    private var costsButton: some View {
        let count = model.state.simulationCount
        let active = count > 0
        return Button { costsOpen = true } label: {
            HStack(spacing: BBSpacing.space1_5) {
                BBIconView(.slidersHorizontal, points: 14, color: active ? .bbPrimary : .bbMutedForeground)
                BBText(L10n.lookup(italian: "Costi e imposte"), style: BBTypography.body, color: active ? .bbPrimary : .bbMutedForeground)
                if active { BBText("·\(count)", style: BBTypography.body, color: .bbPrimary).monospacedDigit() }
            }
            .padding(.horizontal, BBSpacing.space3)
            .frame(height: 32)
            .background(Capsule().fill(active ? Color.bbAlphaPrimary10 : Color.clear))
            .overlay(Capsule().strokeBorder(active ? Color.bbPrimary.opacity(0.4) : Color.bbBorder, lineWidth: 1))
            .bbHitArea(height: 32)
        }
        .buttonStyle(BBPressableStyle(translate: false))
        .accessibilityLabel(active ? L10n.lookup(italian: "Costi e imposte: simulazione attiva su {0} di 2", ["0": String(count)])
                                   : L10n.lookup(italian: "Costi e imposte: simulazione spenta"))
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private static func series(_ hero: PortfolioHero) -> [InvestmentsSeries] {
        var series = [InvestmentsSeries(id: "value", values: hero.values, color: .bbPrimary, style: .area)]
        if let registered = hero.registered {
            series.append(InvestmentsSeries(id: "registered", values: registered, color: .bbForeground, style: .line, width: 1.5))
        }
        series.append(InvestmentsSeries(id: "invested", values: hero.invested, color: .bbMutedForeground, style: .dashedStep, width: 1.5))
        return series
    }

    @ViewBuilder private func chart(hero: PortfolioHero, text: InvestmentsText) -> some View {
        if view.series.isEmpty {
            BBText(L10n.lookup(italian: "Nessun dato disponibile nel periodo selezionato."), style: BBTypography.body, color: .bbMutedForeground)
        } else {
            let currency = view.currency
            let series = Self.series(hero)
            VStack(spacing: BBSpacing.space3) {
                InvestmentsChart(count: view.series.count, series: series, height: 240,
                                 accessibilitySummary: L10n.lookup(italian: "Il tuo portafoglio"), selection: $selection) { i in
                    let point = view.series[i]
                    let value = hero.values[i]
                    let diff = value - point.invested
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(CalendarDate(iso: point.date).map { BBFormat.formatLongDate($0, locale: text.locale) } ?? point.date,
                               style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                        BBText("\(L10n.lookup(italian: "Valore")) \(text.money(value, currency))", style: BBTypography.caption, lineLimit: 1)
                        BBText("\(L10n.lookup(italian: "Versato")) \(text.money(point.invested, currency))", style: BBTypography.caption,
                               color: .bbMutedForeground, lineLimit: 1)
                        BBText("\(diff < 0 ? BBFormat.minusSign : "+")\(text.money(abs(diff), currency))", style: BBTypography.caption,
                               color: .bbSigned(diff), lineLimit: 1)
                    }
                    .monospacedDigit()
                }
                .padding(.horizontal, -BBSpacing.space4)
                HStack(spacing: BBSpacing.space4) {
                    ChartLegendItem(label: L10n.lookup(italian: "Valore") + (hero.simulating ? L10n.lookup(italian: " simulato") : ""), color: .bbPrimary)
                    if hero.simulating {
                        ChartLegendItem(label: L10n.lookup(italian: "Valore registrato (senza simulazione)"), color: .bbForeground)
                    }
                    ChartLegendItem(label: L10n.lookup(italian: "Versato (acquisti meno vendite)"), color: .bbMutedForeground, dashed: true)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

/// Paid vs market (green) or, at a loss, value vs lost (red) (INV-013).
private struct ValueBreakdownBar: View {
    let breakdown: InvestmentsView.Breakdown
    let currency: String
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let gaining = breakdown.market >= 0
        let whole = gaining ? breakdown.value : breakdown.paid
        let first = gaining ? breakdown.paid : breakdown.value
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: currency, locale: locale, maximumFractionDigits: 0, masked: hide) }
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            GeometryReader { proxy in
                HStack(spacing: 0) {
                    Rectangle().fill(Color.bbPrimary).frame(width: whole > 0 ? proxy.size.width * max(0, first / whole) : 0)
                    Rectangle().fill(gaining ? Color.bbPos : Color.bbNeg.opacity(0.7))
                        .frame(width: whole > 0 ? proxy.size.width * max(0, abs(breakdown.market) / whole) : 0)
                    Spacer(minLength: 0)
                }
                .background(Color.bbMuted)
                .clipShape(Capsule())
            }
            .frame(height: 12)
            .accessibilityHidden(true)
            HStack(spacing: BBSpacing.space4) {
                legend(color: .bbPrimary, label: L10n.lookup(italian: gaining ? "Pagato" : "Vale oggi"), value: money(first), valueColor: .bbForeground)
                Spacer(minLength: 0)
                legend(color: gaining ? .bbPos : .bbNeg.opacity(0.7), label: L10n.lookup(italian: gaining ? "Dal mercato" : "Perso"),
                       value: "\(gaining ? "+" : BBFormat.minusSign)\(money(abs(breakdown.market)))", valueColor: gaining ? .bbPos : .bbNeg)
            }
        }
    }

    private func legend(color: Color, label: String, value: String, valueColor: Color) -> some View {
        HStack(spacing: BBSpacing.space1_5) {
            Circle().fill(color).frame(width: 8, height: 8)
            (Text(verbatim: label + " ").foregroundColor(.bbMutedForeground) + Text(verbatim: value).fontWeight(.medium).foregroundColor(valueColor))
                .bbTextStyle(BBTypography.caption)
                .monospacedDigit()
        }
    }
}

/// «Costi e imposte» switches (INV-018…020).
private struct ReinvestmentPanel: View {
    let model: InvestmentsModel
    let view: InvestmentsView
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let impact = view.costImpact
        let disabled = !impact.available
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.lookup(italian: "Ogni importo pagato torna nel portafoglio il giorno in cui l'hai versato e rende come il resto. Non cambia le tue operazioni."),
                   style: BBTypography.body, color: .bbMutedForeground)
            row(label: "Rimetti i costi nel portafoglio", paid: "Commissioni e costi pagati: {0}.", amount: impact.fees,
                effect: view.reinvestmentEffects.fees, isOn: model.state.reinvestFees, disabled: disabled) { model.setReinvest(fees: $0) }
            row(label: "Rimetti le imposte nel portafoglio",
                paid: model.taxesEnabled ? "Imposte registrate e stimate sulle vendite: {0}." : "Imposte registrate: {0}.",
                amount: impact.taxes, effect: view.reinvestmentEffects.taxes, isOn: model.state.reinvestTaxes,
                disabled: disabled) { model.setReinvest(taxes: $0) }
            if disabled {
                BBText(L10n.lookup(italian: "Non disponibile finché ogni strumento non ha un prezzo."), style: BBTypography.body,
                       color: .bbMutedForeground)
            }
        }
    }

    private func row(label: String, paid: String, amount: Double, effect: Double, isOn: Bool, disabled: Bool,
                     onChange: @escaping (Bool) -> Void) -> some View {
        let currency = view.currency
        return HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBSwitch(isOn: Binding(get: { isOn }, set: onChange), size: .sm, accessibilityLabel: L10n.lookup(italian: label),
                     isDisabled: disabled)
                .padding(.top, 3)
            VStack(alignment: .leading, spacing: 2) {
                BBText(L10n.lookup(italian: label), style: BBTypography.bodyStrong)
                let paidText = L10n.lookup(italian: paid, ["0": BBFormat.formatCurrency(amount, currency: currency, locale: locale)])
                let effectText = effect > 0
                    ? " \(L10n.lookup(italian: "Rimasti investiti, oggi varresti")) \(BBFormat.formatCurrency(effect, currency: currency, locale: locale, maximumFractionDigits: 0)) \(L10n.lookup(italian: "in più."))"
                    : ""
                BBText(paidText + effectText, style: BBTypography.body, color: .bbMutedForeground)
            }
        }
        .opacity(disabled ? 0.6 : 1)
    }
}

// MARK: - Positions

private struct PositionsSection: View {
    let model: InvestmentsModel
    let view: InvestmentsView
    @State private var searchOpen = false
    @State private var search: InstrumentSearchModel?
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let rows = view.summary.rows
        let weighted = rows.filter { $0.weight != nil }
        PanelSection(title: L10n.lookup(italian: "Posizioni"), icon: .chartPie) {
            // Web phone layout: the instrument search as a full-width field under the title, then the concentration line.
            Button {
                search = InstrumentSearchModel(env: env)
                searchOpen = true
            } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBText(L10n.lookup(italian: "Cerca un titolo"), style: BBTypography.body, color: .bbMutedForeground, lineLimit: 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.chevronDown, points: 16, color: .bbMutedForeground)
                }
                .padding(.horizontal, BBSpacing.space3)
                .frame(height: 40)
                .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbInput, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(BBPressableStyle(translate: false))
            if let concentration = view.concentrationText {
                BBText(concentration, style: BBTypography.body, color: .bbMutedForeground)
            }
            if weighted.count > 1 {
                GeometryReader { proxy in
                    let total = weighted.reduce(0) { $0 + ($1.weight ?? 0) }
                    let gaps = CGFloat(weighted.count - 1) * 2
                    HStack(spacing: 2) {
                        ForEach(weighted) { row in
                            Rectangle().fill(Color.bbSwatch(InstrumentIcons.typeSwatch(row.instrument.kind)))
                                .frame(width: max(2, (proxy.size.width - gaps) * CGFloat((row.weight ?? 0) / max(total, 0.0001))))
                        }
                    }
                    .clipShape(Capsule())
                }
                .frame(height: 8)
                .accessibilityLabel(L10n.lookup(italian: "Peso di ogni posizione nel portafoglio"))
            }
            if rows.isEmpty {
                BBText(L10n.lookup(italian: "Nessuna posizione aperta."), style: BBTypography.body, color: .bbMutedForeground)
            } else {
                VStack(spacing: 0) {
                    ForEach(rows) { row in
                        PositionRowView(row: row, note: view.priceNote(row.instrument.id), currency: view.currency,
                                        loadingHistory: model.backfilling.contains(row.instrument.id),
                                        onOpen: { shell.push(.instrument(row.instrument.id)) },
                                        onManualPrice: { model.manualPriceFor = row.instrument },
                                        onRemoteLogo: { model.logosShown = true })
                    }
                }
                if model.logosShown { LogoCredit() }
            }
        }
        .formDialog(isPresented: $searchOpen) {
            if let search {
                VStack(alignment: .leading, spacing: BBSpacing.space4) {
                    BBText(L10n.lookup(italian: "Cerca un titolo"), style: BBTextStyle.sectionHeading)
                    InstrumentSearchContent(model: search, suggestions: view.instruments, currency: view.currency) { chosen in
                        searchOpen = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationBase + 0.05) { shell.push(.instrument(chosen.id)) }
                    }
                }
            }
        }
    }
}

/// One open position: compact card that expands to quantity, average cost, last price (INV-021/022).
private struct PositionRowView: View {
    let row: PositionRow
    let note: InvestmentsView.PriceNote?
    let currency: String
    let loadingHistory: Bool
    let onOpen: () -> Void
    let onManualPrice: () -> Void
    let onRemoteLogo: () -> Void

    @State private var open = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let text = InvestmentsText(locale: locale, masked: hide, translate: { L10n.lookup(italian: $0) })
        let weight = row.weight.map(InvestmentsRules.percent) ?? "—"
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: BBSpacing.space1) {
                Button(action: onOpen) {
                    HStack(spacing: BBSpacing.space3) {
                        InstrumentIconView(instrument: row.instrument, onRemoteLogo: onRemoteLogo)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: BBSpacing.space2) {
                                BBText(row.instrument.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                if loadingHistory { BBBadge(L10n.lookup(italian: "Storico in caricamento"), variant: .secondary) }
                            }
                            BBText("\(L10n.lookup(italian: InstrumentIcons.typeLabel(row.instrument.kind))) · \(weight)",
                                   style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        VStack(alignment: .trailing, spacing: 2) {
                            if let value = row.value {
                                AmountText(value: value, currency: currency, style: BBTextStyle.rowAmount)
                            } else {
                                BBText("—", style: BBTextStyle.rowAmount)
                            }
                            BBText(text.positionGain(row, currency: currency, masked: hide), style: BBTypography.caption,
                                   color: .bbSigned(row.unrealizedGain), lineLimit: 1)
                                .monospacedDigit()
                        }
                    }
                    .padding(.vertical, BBSpacing.space3)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Button { withAnimation(.easeOut(duration: BBMotion.durationFast)) { open.toggle() } } label: {
                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
                        .rotationEffect(.degrees(open ? 180 : 0))
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                        .bbHitArea(height: 36, width: 36)
                }
                .buttonStyle(.plain)
                .padding(.trailing, -BBSpacing.space2)
                .accessibilityLabel(L10n.lookup(italian: "Dettagli di {0}", ["0": row.instrument.name]))
            }
            if open { details(text) }
            if let w = row.weight {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.bbMuted)
                        Capsule().fill(Color.bbSwatch(InstrumentIcons.typeSwatch(row.instrument.kind)))
                            .frame(width: proxy.size.width * max(0.01, w))
                    }
                }
                .frame(height: 2)
                .accessibilityHidden(true)
            }
        }
    }

    private func details(_ text: InvestmentsText) -> some View {
        let average = row.averagePrice.map { text.price($0, currency) } ?? "—"
        let stale = note?.stale == true
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(alignment: .top, spacing: BBSpacing.space4) {
                detail(L10n.lookup(italian: "Quantità"), text.quantityWithUnit(row))
                detail(L10n.lookup(italian: "Carico medio"), average)
            }
            HStack(alignment: .bottom, spacing: BBSpacing.space2) {
                VStack(alignment: .leading, spacing: 2) {
                    BBText(L10n.lookup(italian: "Ultimo prezzo"), style: BBTypography.caption, color: .bbMutedForeground)
                    BBText(note?.price.map { text.masked ? BBFormat.amountMask : $0 } ?? L10n.lookup(italian: "Nessun prezzo"), style: BBTypography.body, color: stale ? .bbNeg : .bbForeground)
                        .monospacedDigit()
                    if let detail = note?.detail { BBText(detail, style: BBTypography.caption, color: stale ? .bbNeg : .bbForeground) }
                    if let hint = note?.hint { BBText(L10n.lookup(italian: hint), style: BBTypography.caption, color: stale ? .bbNeg : .bbForeground) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                BBButton(L10n.lookup(italian: "Inserisci prezzo"), icon: .pencilLine, variant: .outline, size: .sm, action: onManualPrice)
            }
        }
        .padding(.leading, 48)
        .padding(.bottom, BBSpacing.space3)
    }

    private func detail(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: BBTypography.body).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Seguiti, dividends, costs

/// «Seguiti» (INV-027, SEC-010/011): watched, not held; hidden when empty or on error.
struct WatchedTitlesSection: View {
    let model: InvestmentsModel
    @Environment(ShellModel.self) private var shell

    var body: some View {
        let items = (model.titles ?? []).filter { $0.watching && !$0.held }
        if !items.isEmpty {
            PanelSection(title: L10n.lookup(italian: "Seguiti"), icon: .eye,
                         description: L10n.lookup(italian: "Titoli che osservi senza possederli. Aprine uno per il grafico e gli avvisi di prezzo.")) {
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        TitleRow(item: item) { shell.push(.instrument(item.instrument.id)) }
                    }
                }
            }
        }
    }
}

/// One title of the list (SEC-011).
struct TitleRow: View {
    let item: TitleItem
    let onOpen: () -> Void
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let instrument = item.instrument
        Button(action: onOpen) {
            HStack(spacing: BBSpacing.space3) {
                InstrumentIconView(instrument: instrument)
                VStack(alignment: .leading, spacing: 4) {
                    BBText(instrument.name, style: BBTypography.bodyStrong, lineLimit: 1)
                    HStack(spacing: BBSpacing.space2) {
                        BBText(L10n.lookup(italian: InstrumentIcons.typeLabel(instrument.kind)), style: BBTypography.caption, color: .bbMutedForeground)
                        if item.held { BBBadge(L10n.lookup(italian: "Posseduto"), variant: .secondary) }
                        if item.watching && !item.held { BBBadge(L10n.lookup(italian: "Seguito"), variant: .outline) }
                        if item.activeAlerts > 0 {
                            HStack(spacing: 2) {
                                BBIconView(.bell, points: 12, color: .bbMutedForeground)
                                BBText("\(item.activeAlerts) \(L10n.lookup(italian: item.activeAlerts == 1 ? "avviso" : "avvisi"))",
                                       style: BBTypography.caption, color: .bbMutedForeground)
                            }
                        }
                        if item.triggeredAlerts > 0 {
                            BBBadge(item.triggeredAlerts == 1 ? L10n.lookup(italian: "Avviso scattato")
                                    : L10n.lookup(italian: "{0} avvisi scattati", ["0": String(item.triggeredAlerts)]), variant: .destructive)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 2) {
                    if let close = item.lastClose {
                        BBText(BBFormat.formatPrice(close, currency: instrument.currency, locale: locale), style: BBTypography.bodyStrong)
                            .monospacedDigit()
                    } else {
                        BBText(L10n.lookup(italian: "Nessun prezzo"), style: BBTypography.caption, color: .bbMutedForeground)
                    }
                    if let change = item.dayChange {
                        BBText(BBFormat.formatSignedPct(change, locale: locale), style: BBTypography.caption, color: .bbSigned(change))
                            .monospacedDigit()
                    } else {
                        BBText("—", style: BBTypography.caption, color: .bbMutedForeground)
                    }
                }
            }
            .padding(.vertical, BBSpacing.space3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Dividends summary (INV-028).
private struct DividendsSummary: View {
    let view: InvestmentsView
    let onAll: () -> Void
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let income = view.income
        PanelSection(title: L10n.lookup(italian: "Dividendi"), icon: .handCoins, color: .bbSwatchAmber,
                     linkLabel: L10n.lookup(italian: "Tutti"), onLink: onAll) {
            HStack(alignment: .top, spacing: BBSpacing.space4) {
                InvestmentsStat(label: L10n.lookup(italian: "Ultimi 12 mesi"),
                                value: BBFormat.formatCurrency(income.trailing, currency: view.currency, locale: locale, masked: hide))
                InvestmentsStat(label: L10n.lookup(italian: "Totale incassato"),
                                value: BBFormat.formatCurrency(income.total, currency: view.currency, locale: locale, masked: hide))
            }
            BBText(L10n.lookup(italian: income.count > 0 ? "Dividendi e cedole registrati, al netto di imposte e costi." : "Nessun dividendo o cedola registrato."),
                   style: BBTypography.body, color: .bbMutedForeground)
        }
    }
}

/// «Costi e imposte» card (INV-029).
private struct CostDetails: View {
    let view: InvestmentsView
    let italian: Bool
    let onTaxes: () -> Void
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let impact = view.costImpact
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: view.currency, locale: locale, masked: hide) }
        PanelSection(title: L10n.lookup(italian: "Costi e imposte"), icon: .receiptText, color: .bbNeg,
                     description: L10n.lookup(italian: "Dall’inizio · operazioni registrate"),
                     linkLabel: italian ? L10n.lookup(italian: "Dettaglio fiscale") : nil, onLink: italian ? onTaxes : nil) {
            VStack(spacing: 0) {
                InvestmentsValueRow(label: L10n.lookup(italian: "Costi e commissioni"), value: money(impact.fees))
                InvestmentsValueRow(label: L10n.lookup(italian: "Imposte già registrate"), value: money(impact.taxes - impact.estimatedTaxes))
                if italian {
                    InvestmentsValueRow(label: L10n.lookup(italian: "Imposte aggiuntive stimate"), value: money(impact.estimatedTaxes))
                }
                InvestmentsValueRow(label: L10n.lookup(italian: "Totale costi e imposte"), value: money(impact.fees + impact.taxes), strong: true,
                                    showsDivider: false)
            }
            BBText(L10n.lookup(italian: "I costi del fondo (TER) sono già riflessi nel prezzo: non vengono sottratti di nuovo né inclusi tra le commissioni registrate. Eventuali costi del broker non registrati non sono inclusi."),
                   style: BBTypography.body, color: .bbMutedForeground)
            BBText(L10n.lookup(italian: italian ? "Stesse stime della scheda Tasse, con aliquote, regime e compensazione delle minusvalenze. Bollo escluso."
                               : "Per la Germania mostriamo solo costi e imposte registrati. Non aggiungiamo il bollo italiano né stime fiscali tedesche."),
                   style: BBTypography.body, color: .bbMutedForeground)
        }
    }
}

// MARK: - Manual price (INV-026)

struct ManualPriceView: View {
    let model: InvestmentsModel
    let instrument: Instrument
    @State private var date = InvestmentsModel.todayKey
    @State private var price = ""
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        let value = BBFormat.parseAmount(price)
        let label = instrument.isPercentOfNominal ? "Prezzo (% del nominale)" : "Prezzo per quota"
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            FormDialogHeader(icon: .pencilLine, title: "\(L10n.lookup(italian: "Prezzo di")) \(instrument.name)",
                             description: L10n.lookup(italian: "Vale solo per il tuo portafoglio e ha la precedenza sui prezzi automatici dello stesso giorno."))
            BBDateField(label: L10n.lookup(italian: "Data"), date: Binding(get: { date }, set: { date = min($0, InvestmentsModel.todayKey) }))
            BBTextField(label: "\(L10n.lookup(italian: label)) (\(instrument.currency))", text: $price, keyboard: .amount)
            if let error { BBErrorBox(message: error) }
            BBButton(L10n.lookup(italian: "Salva prezzo"), size: .touch, fullWidth: true, isLoading: saving,
                     isDisabled: (value ?? 0) <= 0) {
                guard let value else { return }
                saving = true
                Task {
                    error = await model.saveManualPrice(instrument, date: date, close: value)
                    saving = false
                }
            }
        }
    }
}
