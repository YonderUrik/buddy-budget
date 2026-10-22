import Foundation

/// A piece of an Investimenti sentence with its emphasis (web `font-semibold`, `text-pos`/`text-neg`, muted spans).
public struct InvestmentsTextRun: Equatable, Sendable {
    public enum Style: Equatable, Sendable { case plain, strong, pos, neg, muted }

    public let text: String
    public let style: Style

    public init(_ text: String, _ style: Style = .plain) {
        self.text = text
        self.style = style
    }
}

/// Investimenti phrasing (web components under `components/domain/investments`), bound to one language. `translate`
/// maps an Italian catalog key to its template in the app language (identity in tests). Same API on Android.
public struct InvestmentsText {
    public let locale: BBLocale
    /// INV-112 (web #448): «Nascondi gli importi» also hides quantities, prices and fees.
    public let masked: Bool
    private let translate: (String) -> String

    public init(locale: BBLocale, masked: Bool = false, translate: @escaping (String) -> String) {
        self.locale = locale
        self.masked = masked
        self.translate = translate
    }

    public func tr(_ key: String, _ values: [String: String] = [:]) -> String {
        let template = translate(key)
        return values.isEmpty ? template : BBFormat.interpolate(template, values)
    }

    public func money(_ value: Double, _ currency: String, digits: Int = 2, masked: Bool = false) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: digits, masked: masked)
    }

    /// Web `pctText`: sign, one decimal, «%» («+12,3%» / «−4,0%»).
    public func pct(_ ratio: Double) -> String { BBFormat.formatSignedPct(ratio, locale: locale) }

    public func date(_ iso: String) -> String { BBFormat.formatDateWithYear(iso, locale: locale) }

    /// Price with up to 4 decimals and the currency code after it (web `PRICE_FORMAT` + code).
    public func price(_ value: Double, _ currency: String) -> String {
        masked ? BBFormat.amountMask : "\(BBFormat.formatNumber(value, maximumFractionDigits: 4, locale: locale)) \(currency)"
    }

    /// Quantity with up to 6 decimals (web `QUANTITY_FORMAT`).
    public func quantity(_ value: Double) -> String { number(value, maximumFractionDigits: 6) }

    /// A number of the user's money without a currency (`privateNumberFormat`): `••••` while amounts are hidden.
    public func number(_ value: Double, maximumFractionDigits: Int = 3) -> String {
        masked ? BBFormat.amountMask : BBFormat.formatNumber(value, maximumFractionDigits: maximumFractionDigits, locale: locale)
    }

    // MARK: Portafoglio hero (INV-011…014)

    /// `±{amount} (±x,x%)` of the day change line (amount with 0 decimals).
    public func dayChange(_ amount: Double, pct ratio: Double, currency: String, masked: Bool) -> String {
        let sign = amount < 0 ? BBFormat.minusSign : "+"
        return "\(sign)\(money(abs(amount), currency, digits: 0, masked: masked)) (\(pct(ratio)))"
    }

    /// INV-012: «Solo titoli. In più hai {cash} di liquidità sui broker (totale {sum}).»
    public func cashLine(cash: Double, total: Double, currency: String, masked: Bool) -> String {
        "\(tr("Solo titoli. In più hai")) \(money(cash, currency, digits: 0, masked: masked)) \(tr("di liquidità sui broker (totale")) \(money(total, currency, digits: 0, masked: masked)))."
    }

    /// INV-018: «Simulazione · {±diff} rispetto al valore registrato.»
    public func simulationLine(extra: Double, currency: String, masked: Bool) -> String {
        "\(tr("Simulazione ·")) \(extra >= 0 ? "+" : "")\(money(extra, currency, masked: masked)) \(tr("rispetto al valore registrato."))"
    }

    /// INV-013: the «max» sentence (paid, market, cashed in, unpriced).
    public func gainSentence(_ b: InvestmentsView.Breakdown, unpriced: Int, currency: String, masked: Bool) -> [InvestmentsTextRun] {
        let gaining = b.market >= 0
        let marketPct = b.paid > 0 ? b.market / b.paid : nil
        var runs = [
            InvestmentsTextRun("\(tr("Per quello che possiedi hai pagato")) "),
            InvestmentsTextRun(money(b.paid, currency, digits: 0, masked: masked), .strong),
            InvestmentsTextRun("\(tr(": il mercato ha")) \(gaining ? tr("aggiunto") : tr("tolto")) "),
            InvestmentsTextRun("\(gaining ? "+" : BBFormat.minusSign)\(money(abs(b.market), currency, digits: 0, masked: masked))"
                + (marketPct.map { " (\(pct($0)))" } ?? ""), gaining ? .pos : .neg),
            InvestmentsTextRun("."),
        ]
        if b.cashedIn != 0 {
            runs.append(InvestmentsTextRun(" \(tr("Hai già")) \(b.cashedIn > 0 ? tr("incassato") : tr("perso")) \(money(abs(b.cashedIn), currency, digits: 0, masked: masked)) \(tr("tra vendite, dividendi e cedole."))", .muted))
        }
        if unpriced > 0 {
            let head = unpriced == 1 ? tr("Uno strumento non ha") : tr("{0} strumenti non hanno", ["0": String(unpriced)])
            runs.append(InvestmentsTextRun(" \(head) \(tr("ancora un prezzo e non è contato."))", .muted))
        }
        return runs
    }

    /// INV-014: «Da {date} il valore è passato da {a} a {b}. …»
    public func periodGainSentence(_ g: InvestmentsView.PeriodGain, currency: String, masked: Bool) -> [InvestmentsTextRun] {
        let m = { (v: Double) in self.money(v, currency, digits: 0, masked: masked) }
        let positive = g.gain >= 0
        var runs = [
            InvestmentsTextRun("\(tr("Da")) \(date(g.fromKey)) \(tr("il valore è passato da")) "),
            InvestmentsTextRun(m(g.startValue), .strong),
            InvestmentsTextRun(" \(tr("a")) "),
            InvestmentsTextRun(m(g.endValue), .strong),
            InvestmentsTextRun("."),
        ]
        if abs(g.netContributions) >= 0.5 {
            runs.append(InvestmentsTextRun(" \(tr("Nel periodo hai")) \(g.netContributions > 0 ? tr("versato") : tr("ritirato")) \(m(abs(g.netContributions)))\(tr(": quello non è guadagno."))"))
        }
        runs.append(InvestmentsTextRun(" \(tr("Il periodo ha")) \(positive ? tr("reso") : tr("perso")) "))
        runs.append(InvestmentsTextRun("\(positive ? "+" : BBFormat.minusSign)\(m(abs(g.gain)))" + (g.twr.map { " (\(pct($0)))" } ?? ""),
                                       positive ? .pos : .neg))
        if g.income > 0.5 {
            runs.append(InvestmentsTextRun("\(tr(", compresi")) \(m(g.income)) \(tr("tra dividendi e cedole"))", .muted))
        }
        runs.append(InvestmentsTextRun("."))
        return runs
    }

    // MARK: Positions (INV-021)

    /// `{q} quote` / `{q} nominale`.
    public func quantityWithUnit(_ row: PositionRow) -> String {
        "\(quantity(row.quantity)) \(row.instrument.isPercentOfNominal ? "nominale" : tr("quote"))"
    }

    /// Gain line of a position: `±amount · ±%` or `senza prezzo`.
    public func positionGain(_ row: PositionRow, currency: String, masked: Bool) -> String {
        guard let gain = row.unrealizedGain else { return tr("senza prezzo") }
        let amount = BBFormat.formatSignedCurrency(gain, currency: currency, locale: locale, masked: masked)
        return row.unrealizedGainPct.map { "\(amount) · \(pct($0))" } ?? amount
    }

    // MARK: Performance (INV-031…044)

    /// `{from} – {to}` or «Valore iniziale al {0}» when the range has no days.
    public func rangeLabel(_ v: ReturnValues) -> String {
        v.days == 0 ? tr("Valore iniziale al {0}", ["0": date(v.baseKey ?? v.fromKey)]) : "\(date(v.fromKey)) – \(date(v.toKey))"
    }

    /// INV-042: max drawdown sentence.
    public func drawdownText(_ d: InvestmentsPerformance.Drawdown, recoveryDays: Int?) -> String {
        if d.depth == 0 { return tr("Nel periodo non è mai sceso sotto il massimo precedente.") }
        let span = tr("Dal {0} al {1}", ["0": date(d.peakDate ?? ""), "1": date(d.troughDate ?? "")])
        if d.recoveryDate != nil, let days = recoveryDays {
            return tr("{0}; tornato al massimo in {1} giorni.", ["0": span, "1": String(days)])
        }
        return tr("{0}; non è ancora tornato al massimo (a fine periodo {1}).", ["0": span, "1": pct(d.current ?? 0)])
    }

    /// INV-044: «{n} mesi in guadagno e {m} in perdita, {k} praticamente fermi.» (nouns per grouping).
    public func heatmapSummary(_ h: ReturnHeatmap) -> String {
        let nouns: (String, String)
        switch h.grouping {
        case "giorno": nouns = ("giorno", "giorni")
        case "settimana": nouns = ("settimana", "settimane")
        case "anno": nouns = ("anno", "anni")
        default: nouns = ("mese", "mesi")
        }
        if h.counted == 0 { return tr("Ancora nessun {0} con un rendimento.", ["0": tr(nouns.0)]) }
        let flat = h.counted - h.positive - h.negative
        return tr("{0} {1} in guadagno e {2} in perdita{3}.", [
            "0": String(h.positive), "1": tr(h.positive == 1 ? nouns.0 : nouns.1), "2": String(h.negative),
            "3": flat > 0 ? tr(", {0} praticamente fermi", ["0": String(flat)]) : "",
        ])
    }

    // MARK: Operazioni (INV-056…059)

    /// Web `GainText`: «+120,50 € · +4,5%».
    public func gainText(_ gain: Double, pct ratio: Double?, currency: String, masked: Bool) -> String {
        let amount = BBFormat.formatSignedCurrency(gain, currency: currency, locale: locale, masked: masked)
        return ratio.map { "\(amount) · \(pct($0))" } ?? amount
    }

    /// Details line of an operation: date · what · fees · remaining.
    public func operationDetails(_ op: OperationResult, instrument: Instrument?) -> String {
        let t = op.transaction
        let currency = instrument?.currency ?? ""
        var parts = [date(t.date)]
        switch t.type {
        case "rettifica":
            parts.append(tr("Nessun movimento di cassa · base trasferita {0}", ["0": money(t.grossValue ?? 0, currency.isEmpty ? "EUR" : currency)]))
        case "split":
            parts.append(tr("ogni quota diventa {0}", ["0": quantity(t.quantityValue)]))
        case "dividendo", "cedola":
            parts.append(tr("{0} lordi", ["0": money(t.grossValue ?? 0, currency.isEmpty ? "EUR" : currency)]))
        default:
            let unit = instrument?.isPercentOfNominal == true ? "% " : " "
            parts.append(tr("{0} × {1}{2}{3}", ["0": quantity(t.quantityValue), "1": number(t.priceValue),
                                                 "2": unit, "3": currency]))
        }
        if t.feesValue > 0 { parts.append(tr("commissioni {0}", ["0": number(t.feesValue)])) }
        if t.type == "acquisto", let remaining = op.remainingQuantity, remaining > 1e-9, t.quantityValue - remaining > 1e-9 {
            parts.append(tr("ne restano {0}", ["0": number(remaining, maximumFractionDigits: 4)]))
        }
        return parts.joined(separator: " · ")
    }

    /// Month header line: «acquistato … · venduto … · proventi …».
    public func monthParts(_ totals: OperationTotals, currency: String, masked: Bool) -> String {
        let m = { (v: Double) in self.money(v, currency, digits: 0, masked: masked) }
        return [totals.bought > 0 ? tr("acquistato {0}", ["0": m(totals.bought)]) : nil,
                totals.sold > 0 ? tr("venduto {0}", ["0": m(totals.sold)]) : nil,
                totals.income > 0 ? tr("proventi {0}", ["0": m(totals.income)]) : nil].compactMap { $0 }.joined(separator: " · ")
    }
}
