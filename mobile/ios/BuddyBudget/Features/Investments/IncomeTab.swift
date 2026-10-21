import BuddyBudgetKit
import SwiftUI

/// Investimenti › Dividendi (IT, INV-074…082): month by month, per instrument, proposals to record, 12-month
/// forecast. DE shows the German plan (13-planning-de) (INV-003/091). Android: IncomeTab.kt.
struct IncomeTab: View {
    let model: InvestmentsModel
    @State private var couponsFor: Instrument?

    var body: some View {
        if model.countryContent == .germanPlan {
            GermanIncomeScreen(model: model.planning)
        } else {
            switch model.income {
            case .loading:
                VStack(spacing: BBSpacing.space6) {
                    BBSkeleton(height: 160, radius: BBRadius.xl)
                    BBSkeleton(height: 288, radius: BBRadius.xl)
                }
            case .failed:
                LoadError(message: L10n.lookup(italian: "Impossibile caricare i dividendi."), onRetry: { Task { await model.loadIncome() } })
            case .loaded(let income):
                if !income.hasTransactions {
                    BBText(L10n.lookup(italian: "Qui vedrai dividendi e cedole: registra prima un acquisto nella scheda Portafoglio."), style: BBTypography.body,
                           color: .bbMutedForeground)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(BBSpacing.space8)
                        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                } else {
                    content(income)
                }
            }
        }
    }

    @ViewBuilder private func content(_ income: InvestmentsIncome) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.space10) {
            if income.pendingDividendHistory > 0 {
                BBText("\(L10n.lookup(italian: "Scarico lo storico dei dividendi di")) \(income.pendingDividendHistory == 1 ? L10n.lookup(italian: "uno strumento") : L10n.lookup(italian: "{0} strumenti", ["0": String(income.pendingDividendHistory)]))…",
                       style: BBTypography.body, color: .bbMutedForeground)
            }
            if debugShows(0), !income.byMonth.isEmpty { IncomeMonthsSection(income: income) }
            if debugShows(1), !income.byInstrument.isEmpty { IncomeInstrumentsSection(income: income) { couponsFor = $0 } }
            if income.byMonth.isEmpty {
                BBText(L10n.lookup(italian: "Nessun dividendo o cedola registrato."), style: BBTypography.body, color: .bbMutedForeground)
                    .padding(BBSpacing.space6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            }
            if debugShows(2), !income.missing.isEmpty { MissingIncomeSection(model: model, income: income) }
            IncomeForecastSection(income: income) { couponsFor = $0 }
        }
        .formDialog(isPresented: Binding(get: { couponsFor != nil }, set: { if !$0 { couponsFor = nil } })) {
            if let couponsFor {
                InstrumentSettingsView(model: model, instrument: couponsFor, setting: model.taxes.value?.setting(couponsFor.id),
                                       resolved: model.taxes.value?.resolved(couponsFor.id)) { self.couponsFor = nil }
            }
        }
        .task { if model.taxes.value == nil { await model.loadTaxes() } }
    }
}

/// Stacked monthly bars (web `MonthBars`): primary (net, `--pos`) over secondary (`--muted-foreground @ 30%`).
struct MonthBarsView: View {
    struct Bar: Identifiable {
        let id: String
        let label: String
        let primary: Double
        let secondary: Double
        let title: String
    }

    let bars: [Bar]
    var height: CGFloat = 112
    @State private var selected: String?

    var body: some View {
        let maxValue = bars.map { $0.primary + $0.secondary }.max() ?? 0
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(bars) { bar in
                    let total = bar.primary + bar.secondary
                    let h = maxValue > 0 ? max(total / maxValue * height, total > 0 ? 3 : 0) : 0
                    Button { selected = selected == bar.id ? nil : bar.id } label: {
                        VStack(spacing: 4) {
                            VStack(spacing: 0) {
                                Spacer(minLength: 0)
                                if total > 0 {
                                    VStack(spacing: 0) {
                                        Rectangle().fill(Color.bbMutedForeground.opacity(0.3)).frame(height: h * bar.secondary / total)
                                        Rectangle().fill(Color.bbPos).frame(height: h * bar.primary / total)
                                    }
                                    .clipShape(RoundedRectangle(cornerRadius: 2))
                                }
                            }
                            .frame(maxWidth: 32)
                            .frame(height: height)
                            BBText(bar.label, style: BBTypography.caption.with(size: 11, lineHeight: 14), color: .bbMutedForeground, lineLimit: 1)
                                .minimumScaleFactor(0.7)
                        }
                        .frame(maxWidth: .infinity)
                        .opacity(selected == nil || selected == bar.id ? 1 : 0.5)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(bar.title)
                }
            }
            if let bar = bars.first(where: { $0.id == selected }) {
                BBText(bar.title, style: BBTypography.caption, color: .bbForeground)
            }
        }
    }
}

private struct IncomeMonthsSection: View {
    let income: InvestmentsIncome
    @State private var year: Int?
    @State private var expanded = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let selected = income.byMonth.first { $0.year == year } ?? income.byMonth[0]
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: income.currency, locale: locale, maximumFractionDigits: 0, masked: hide) }
        let full = { (v: Double) in BBFormat.formatCurrency(v, currency: income.currency, locale: locale, masked: hide) }
        let years = income.byMonth.map { ($0.year, String($0.year)) }
        let yearBinding = Binding(get: { selected.year }, set: { year = $0; expanded = true })
        PanelSection(title: L10n.lookup(italian: "Dividendi incassati"), icon: .banknote, color: .bbSwatchAmber) {
            if years.count > 1, years.count <= TitleSegments.maxInline {
                SegmentedControl(options: years, selection: yearBinding, accessibilityLabel: L10n.lookup(italian: "Anno"))
            }
        } content: {
            if years.count > TitleSegments.maxInline {
                ScrollableSegmentedControl(options: years, selection: yearBinding, accessibilityLabel: L10n.lookup(italian: "Anno"))
            }
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                stat(L10n.lookup(italian: "Lordo"), money(selected.gross), .bbForeground, note: nil)
                stat(L10n.lookup(italian: "Ritenute e costi"), money(selected.withheld), .bbForeground,
                     note: selected.gross > 0 ? BBFormat.formatPct(selected.withheld / selected.gross, digits: 0, locale: locale) : nil)
                stat(L10n.lookup(italian: "Netto"), money(selected.net), .bbPos, note: nil)
            }
            MonthBarsView(bars: selected.months.map { m in
                let label = BBFormat.shortMonthLabel(m.month, locale: locale)
                return .init(id: String(m.month), label: label, primary: max(m.net, 0), secondary: m.withheld,
                             title: "\(label) \(selected.year) · \(L10n.lookup(italian: "Lordo")): \(full(m.gross)) · \(L10n.lookup(italian: "Netto")): \(full(m.net))")
            })
            .accessibilityLabel(L10n.lookup(italian: "Incassi del {0} per mese", ["0": String(selected.year)]))
            HStack(spacing: BBSpacing.space4) {
                legend(.bbPos, L10n.lookup(italian: "Netto"))
                legend(Color.bbMutedForeground.opacity(0.3), L10n.lookup(italian: "Ritenute e costi"))
            }
            InvestmentsDisclosure(title: "\(L10n.lookup(italian: "Pagamenti del")) \(selected.year)", open: expanded) {
                IncomePaymentsList(payments: income.history.payments.filter { $0.date.hasPrefix(String(selected.year)) }, currency: income.currency,
                                   instrument: { income.instrument($0) })
            }
            .id(selected.year)
        }
    }

    private func stat(_ label: String, _ value: String, _ color: Color, note: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                BBText(value, style: BBTypography.cardTitle.with(size: 18, lineHeight: 26), color: color, lineLimit: 1).minimumScaleFactor(0.6)
                if let note { BBText(note, style: BBTypography.caption, color: .bbMutedForeground) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func legend(_ color: Color, _ label: String) -> some View {
        HStack(spacing: BBSpacing.space1_5) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 10, height: 10)
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
        }
    }
}

struct IncomePaymentsList: View {
    let payments: [InvestmentsView.IncomeHistory.Payment]
    let currency: String
    var instrument: ((String) -> Instrument?)?
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        if payments.isEmpty {
            BBText(L10n.lookup(italian: "Nessun pagamento registrato."), style: BBTypography.body, color: .bbMutedForeground)
        } else {
            VStack(spacing: 0) {
                ForEach(payments) { p in
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        HStack {
                            BBText("\(BBFormat.formatDateWithYear(p.date, locale: locale)) · \(L10n.lookup(italian: p.kind == "cedola" ? "Cedola" : "Dividendo"))",
                                   style: BBTypography.body)
                            Spacer(minLength: 0)
                            if let instrument { BBText(instrument(p.instrumentId)?.name ?? L10n.lookup(italian: "Strumento"), style: BBTypography.bodyStrong, lineLimit: 1) }
                        }
                        HStack(spacing: BBSpacing.space2) {
                            ForEach([("Lordo", p.gross), ("Imposte", p.taxes), ("Costi", p.fees), ("Netto", p.net)], id: \.0) { label, amount in
                                VStack(alignment: .leading, spacing: 0) {
                                    BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
                                    BBText(BBFormat.formatCurrency(amount, currency: currency, locale: locale, masked: hide), style: BBTypography.caption)
                                        .monospacedDigit()
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                    .padding(.vertical, BBSpacing.space3)
                }
            }
        }
    }
}

private struct IncomeInstrumentsSection: View {
    let income: InvestmentsIncome
    let onCoupons: (Instrument) -> Void
    @State private var open: Set<String> = []
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        PanelSection(title: L10n.lookup(italian: "Per strumento"), icon: .list, color: .bbSwatchSlate) {
            InfoHintButton(title: L10n.lookup(italian: "Come leggere i rendimenti da dividendo"),
                           text: "\(L10n.lookup(italian: "Sul costo"))\(L10n.lookup(italian: ": netto incassato negli ultimi 12 mesi su quanto hai pagato le quote che hai.")) \(L10n.lookup(italian: "Attuale"))\(L10n.lookup(italian: ": lordo previsto nei prossimi 12 mesi sul valore di oggi.")) \(L10n.lookup(italian: "Crescita"))\(L10n.lookup(italian: ": di quanto è cresciuto ogni anno il dividendo per quota, sugli ultimi anni completi."))")
        } content: {
            VStack(spacing: 0) {
                ForEach(income.byInstrument, id: \.instrumentId) { row in
                    if let instrument = income.instrument(row.instrumentId) {
                        let payments = income.history.payments.filter { $0.instrumentId == row.instrumentId }
                        let isOpen = open.contains(row.instrumentId)
                        VStack(alignment: .leading, spacing: 0) {
                            Button {
                                if isOpen { open.remove(row.instrumentId) } else { open.insert(row.instrumentId) }
                            } label: {
                                HStack(spacing: BBSpacing.space2_5) {
                                    InstrumentIconView(instrument: instrument, size: 28)
                                    VStack(alignment: .leading, spacing: 0) {
                                        BBText(instrument.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                        BBText("\(payments.count) \(L10n.lookup(italian: payments.count == 1 ? "pagamento" : "pagamenti"))", style: BBTypography.caption,
                                               color: .bbMutedForeground)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    VStack(alignment: .trailing, spacing: 0) {
                                        BBText(BBFormat.formatCurrency(row.trailingNet, currency: income.currency, locale: locale, masked: hide), style: BBTypography.body)
                                            .monospacedDigit()
                                        BBText(L10n.lookup(italian: "ultimi 12 mesi"), style: BBTypography.caption, color: .bbMutedForeground)
                                    }
                                    BBIconView(.chevronDown, size: .md, color: .bbMutedForeground).rotationEffect(.degrees(isOpen ? 180 : 0))
                                }
                                .padding(.vertical, BBSpacing.space4)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            if isOpen {
                                VStack(alignment: .leading, spacing: BBSpacing.space4) {
                                    HStack {
                                        metric("Sul costo", row.yieldOnCost != nil && row.trailingNet > 0 ? BBFormat.formatPct(row.yieldOnCost!, locale: locale) : "—")
                                        metric("Attuale", row.currentYield != nil && row.forecastGross > 0 ? BBFormat.formatPct(row.currentYield!, locale: locale) : "—")
                                        metric("Crescita", row.growth.map { "\(BBFormat.formatSignedPct($0.rate, locale: locale))/\(L10n.lookup(italian: "anno"))" } ?? "—")
                                    }
                                    if instrument.kind == .obbligazione {
                                        BBButton(L10n.lookup(italian: row.hasCouponTerms ? "Cedole" : "Inserisci cedole"), variant: .outline, size: .sm) { onCoupons(instrument) }
                                    }
                                    IncomePaymentsList(payments: payments, currency: income.currency)
                                }
                                .padding(.bottom, BBSpacing.space3)
                            }
                        }
                    }
                }
            }
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(L10n.lookup(italian: label), style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: BBTypography.body).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct MissingIncomeSection: View {
    let model: InvestmentsModel
    let income: InvestmentsIncome
    @State private var showAll = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let missing = income.missing
        let oldBefore = IncomeRules.monthsAgo(income.todayKey, months: 12)
        let old = missing.filter { $0.date < oldBefore }
        let shown = showAll ? missing : Array(missing.prefix(5))
        PanelSection(title: L10n.lookup(italian: "Da registrare"), icon: .circleAlert, color: .bbNeg) {
            BBText("\(missing.count == 1 ? L10n.lookup(italian: "Un provento") : L10n.lookup(italian: "{0} proventi", ["0": String(missing.count)]))\(L10n.lookup(italian: " che probabilmente hai incassato: avevi le quote il giorno dello stacco, ma non c'è")) \(L10n.lookup(italian: "un dividendo o una cedola registrati vicino a quella data. Controlla l'importo netto sull'estratto del broker."))",
                   style: BBTypography.body, color: .bbMutedForeground)
            VStack(spacing: 0) {
                ForEach(shown) { item in
                    let instrument = income.instrument(item.instrumentId)
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        VStack(alignment: .leading, spacing: 2) {
                            BBText(instrument?.name ?? L10n.lookup(italian: "Strumento"), style: BBTypography.bodyStrong, lineLimit: 1)
                            BBText("\(L10n.lookup(italian: item.kind == "cedola" ? "Cedola" : "Stacco")) \(L10n.lookup(italian: "del")) \(BBFormat.formatDateWithYear(item.date, locale: locale)) · \(hide ? BBFormat.amountMask : BBFormat.formatNumber(item.quantity, maximumFractionDigits: 4, locale: locale)) \(L10n.lookup(italian: item.kind == "cedola" ? "di nominale" : "quote"))",
                                   style: BBTypography.body, color: .bbMutedForeground)
                            (Text(verbatim: "\(BBFormat.formatCurrency(item.gross, currency: instrument?.currency ?? income.currency, locale: locale, masked: hide)) \(L10n.lookup(italian: "lordi"))")
                                + Text(verbatim: item.estimatedTax.map { " \(L10n.lookup(italian: "· ritenuta stimata")) \(BBFormat.formatCurrency($0, currency: income.currency, locale: locale, masked: hide))" } ?? "")
                                .foregroundColor(.bbMutedForeground))
                                .bbTextStyle(BBTypography.body).monospacedDigit()
                        }
                        HStack(spacing: BBSpacing.space2) {
                            BBButton(L10n.lookup(italian: "Registra"), size: .sm) {
                                model.openRegister(OperationForm(type: item.kind == "cedola" ? .cedola : .dividendo, instrument: instrument, date: item.date,
                                                                 gross: OperationForm.numberText((item.gross * 100).rounded() / 100),
                                                                 taxes: item.estimatedTax.map { OperationForm.numberText(($0 * 100).rounded() / 100) } ?? ""))
                            }
                            BBButton(L10n.lookup(italian: "Ignora"), variant: .ghost, size: .sm) { Task { await model.dismiss([item]) } }
                        }
                    }
                    .padding(.vertical, BBSpacing.space3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            HStack(spacing: BBSpacing.space2) {
                if missing.count > 5 {
                    BBButton(showAll ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutte ({0})", ["0": String(missing.count)]),
                             variant: .ghost, size: .sm) { showAll.toggle() }
                }
                if old.count > 1 {
                    BBButton("\(L10n.lookup(italian: "Ignora le")) \(old.count) \(L10n.lookup(italian: "più vecchie di un anno"))", variant: .ghost, size: .sm) {
                        Task { await model.dismiss(old) }
                    }
                }
            }
        }
    }
}

private struct IncomeForecastSection: View {
    let income: InvestmentsIncome
    let onCoupons: (Instrument) -> Void
    @State private var showAll = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hide

    var body: some View {
        let forecast = income.forecast
        let money = { (v: Double) in BBFormat.formatCurrency(v, currency: income.currency, locale: locale, maximumFractionDigits: 0, masked: hide) }
        let events = showAll ? forecast.events : Array(forecast.events.prefix(6))
        let missingTerms = forecast.bondsWithoutTerms.compactMap { income.instrument($0) }
        PanelSection(title: L10n.lookup(italian: "Prossimi 12 mesi"), icon: .calendarClock, color: .bbSwatchAmber) {
            if forecast.events.isEmpty {
                BBText(L10n.lookup(italian: "Nessun incasso previsto: i tuoi strumenti non hanno staccato dividendi nell'ultimo anno (es. ETF ad accumulazione)."),
                       style: BBTypography.body, color: .bbMutedForeground)
            } else {
                let first = forecast.months.first?.key ?? "", last = forecast.months.last?.key ?? ""
                let period = L10n.lookup(italian: "{0} a {1}", ["0": BBFormat.formatMonthLabel(first, locale: locale), "1": BBFormat.formatMonthLabel(last, locale: locale)])
                RunsText(runs: [
                    InvestmentsTextRun("\(L10n.lookup(italian: "Da")) \(period)\(L10n.lookup(italian: ", con le quote di oggi dovresti incassare circa")) "),
                    InvestmentsTextRun(money(forecast.totalNet), .pos),
                    InvestmentsTextRun(" \(L10n.lookup(italian: "netti"))"),
                    InvestmentsTextRun(" (\(money(forecast.totalGross)) \(L10n.lookup(italian: "lordi), circa")) \(money(forecast.totalNet / 12)) \(L10n.lookup(italian: "al mese."))", .muted),
                ])
                MonthBarsView(bars: forecast.months.map { m in
                    let label = BBFormat.shortMonthLabel(m.key, locale: locale)
                    return .init(id: m.key, label: label, primary: m.net, secondary: m.gross - m.net,
                                 title: "\(label) \(m.key.prefix(4)): \(money(m.net)) \(L10n.lookup(italian: "netti")), \(money(m.gross)) \(L10n.lookup(italian: "lordi"))")
                })
                .accessibilityLabel(L10n.lookup(italian: "Incassi previsti per mese"))
                VStack(spacing: 0) {
                    ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space3) {
                            VStack(alignment: .leading, spacing: 0) {
                                BBText(income.instrument(event.instrumentId)?.name ?? L10n.lookup(italian: "Strumento"), style: BBTypography.body, lineLimit: 1)
                                BBText("\(L10n.lookup(italian: event.kind == "rimborso" ? "Rimborso a scadenza" : event.kind == "cedola" ? "Cedola" : "Stacco")) \(L10n.lookup(italian: "del")) \(BBFormat.formatDateWithYear(event.date, locale: locale)) · \(L10n.lookup(italian: IncomeRules.basisLabel(event.basis)))",
                                       style: BBTypography.caption, color: .bbMutedForeground)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            VStack(alignment: .trailing, spacing: 0) {
                                BBText(BBFormat.formatCurrency(event.net, currency: income.currency, locale: locale, masked: hide), style: BBTypography.body,
                                       color: event.kind == "rimborso" ? .bbForeground : .bbPos).monospacedDigit()
                                if event.kind != "rimborso" {
                                    BBText("\(BBFormat.formatCurrency(event.gross, currency: income.currency, locale: locale, masked: hide)) \(L10n.lookup(italian: "lordi"))",
                                           style: BBTypography.caption, color: .bbMutedForeground).monospacedDigit()
                                }
                            }
                        }
                        .padding(.vertical, BBSpacing.space2)
                    }
                }
                if forecast.events.count > 6 {
                    BBButton(showAll ? L10n.lookup(italian: "Mostra meno") : L10n.lookup(italian: "Mostra tutti ({0})", ["0": String(forecast.events.count)]),
                             variant: .ghost, size: .sm) { showAll.toggle() }
                }
                BBText(L10n.lookup(italian: "Stima per data di stacco, netta della sola imposta italiana: sui dividendi esteri c'è anche la ritenuta del paese d'origine. Il rimborso di un'obbligazione è capitale che torna, non un provento."),
                       style: BBTypography.caption, color: .bbMutedForeground)
            }
            if !missingTerms.isEmpty {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.lookup(italian: "Per prevedere le cedole servono tasso e scadenza di:"), style: BBTypography.body)
                    FlowLayout(spacing: BBSpacing.space2) {
                        ForEach(missingTerms) { i in BBButton(i.name, variant: .outline, size: .sm) { onCoupons(i) } }
                    }
                }
                .padding(BBSpacing.space3)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.6)))
            }
        }
    }
}
