import Foundation

// What the German Tax and Income screens show (web `tax-editor.tsx`, `income-view.tsx`, `fields.tsx`), built from the
// server results, the instrument names and the edited plan. Bound to one language; `translate` maps a catalog key (the
// English source keys of this area) to its text (identity in tests). Same API on Android.

/// A label / amount row (web `Result`); a nil amount reads «More information needed» (PLAN-016).
public struct GermanPlanningRow: Equatable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let value: String
    public init(id: String, label: String, value: String) { self.id = id; self.label = label; self.value = value }
}

/// One option of a native picker (web `Choice`).
public struct GermanPlanningOption: Equatable, Sendable, Hashable {
    public let value: String
    public let label: String
}

/// A fund / ETF to classify (PLAN-025).
public struct GermanFundRow: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
}

/// A 2026 fund sale that takes prior gross advances (PLAN-025).
public struct GermanFundSaleRow: Equatable, Sendable, Identifiable {
    public let id: String
    public let label: String
}

/// One recorded-income year (PLAN-027).
public struct GermanIncomeYearView: Equatable, Sendable, Identifiable {
    public let year: Int
    public let rows: [GermanPlanningRow]
    public var id: Int { year }
}

/// One forecast payment, rendered as a card on phone (mobile adaptation of the web table, PLAN-028, PLAN-029).
public struct GermanForecastCard: Equatable, Sendable, Identifiable {
    public let id: String
    public let date: String
    public let instrument: String
    public let gross: String
    public let net: String
    /// The net amount is not computable (shown muted).
    public let netUnavailable: Bool
    /// `2026 rules scenario` flag (only with simulations).
    public let benchmark: Bool
}

/// External sources listed under «Rules and official sources» (PLAN-017).
public struct GermanPlanningSource: Equatable, Sendable, Identifiable {
    public let label: String
    public let url: String
    public var id: String { label }
}

public struct GermanPlanningText {
    public static let currency = "EUR"

    /// Web `REASONS`.
    public static let reasonKeys: [String: String] = [
        "currency": "German tax estimates require portfolio currency EUR.",
        "history": "Confirm complete acquisition history and custody accounts before calculating.",
        "classification": "Confirm the fund tax classification using its documentation.",
        "fund-history": "Confirm prior fund advances and any taxable advances received this year.",
        "legacy": "Pre-2009 securities and pre-2018 fund lots need individual tax treatment.",
        "unsupported": "This instrument or adjustment requires individual tax treatment.",
        "missing-lots": "A sale has missing acquisition lots. Add the original purchases in the same custody account.",
        "invalid": "An operation has missing or invalid amounts.",
    ]

    /// Web `FUND_OPTIONS` labels.
    public static let fundKindKeys: [String: String] = [
        "unknown": "Not yet classified",
        "equity": "Equity fund (30% exemption)",
        "mixed": "Mixed fund (15% exemption)",
        "property": "Property fund (60% exemption)",
        "foreign-property": "Foreign property fund (80% exemption)",
        "other": "Other fund (no exemption)",
    ]

    public static let sources: [GermanPlanningSource] = [
        GermanPlanningSource(label: "EStG §32d", url: "https://www.gesetze-im-internet.de/estg/__32d.html"),
        GermanPlanningSource(label: "InvStG §18", url: "https://www.gesetze-im-internet.de/invstg_2018/__18.html"),
        GermanPlanningSource(label: "InvStG §20", url: "https://www.gesetze-im-internet.de/invstg_2018/__20.html"),
        GermanPlanningSource(label: "RWBestV 2026", url: "https://www.gesetze-im-internet.de/rwbestv_2026/BJNR0B20A0026.html"),
        GermanPlanningSource(label: "EStG §23", url: "https://www.gesetze-im-internet.de/estg/__23.html"),
    ]

    public let locale: BBLocale
    public let masked: Bool
    private let translate: (String) -> String

    public init(locale: BBLocale, masked: Bool = false, translate: @escaping (String) -> String) {
        self.locale = locale
        self.masked = masked
        self.translate = translate
    }

    public func tr(_ key: String) -> String { translate(key) }

    /// Web `Amount`: EUR in the user's locale, `More information needed` for nil (PLAN-016).
    public func amount(_ value: Double?) -> String {
        guard let value else { return tr("More information needed") }
        return BBFormat.formatCurrency(value, currency: Self.currency, locale: locale, masked: masked)
    }

    public func date(_ iso: String) -> String { BBFormat.formatDateWithYear(iso, locale: locale) }

    // MARK: Inputs

    public var assessmentOptions: [GermanPlanningOption] {
        [GermanPlanningOption(value: "single", label: tr("Individual (€1,000 allowance)")),
         GermanPlanningOption(value: "joint", label: tr("Joint (€2,000 allowance)"))]
    }

    /// Stored values 0, 0.08, 0.09 as strings (`String(p.churchRate)` on the web).
    public var churchOptions: [GermanPlanningOption] {
        [GermanPlanningOption(value: "0", label: tr("None")),
         GermanPlanningOption(value: "0.08", label: tr("8%")),
         GermanPlanningOption(value: "0.09", label: tr("9%"))]
    }

    public static func churchValue(_ rate: Double) -> String { rate == 0.08 ? "0.08" : rate == 0.09 ? "0.09" : "0" }
    public static func churchRate(_ value: String) -> Double { value == "0.08" ? 0.08 : value == "0.09" ? 0.09 : 0 }

    public var fundOptions: [GermanPlanningOption] {
        GermanFundKinds.all.map { GermanPlanningOption(value: $0, label: tr(Self.fundKindKeys[$0] ?? $0)) }
    }

    // MARK: Tax (PLAN-021…026)

    /// PLAN-021: one line per issue, `{instrument}: {reason}` when instrument-specific.
    public func issueLines(_ report: PlanningResults.TaxReport, portfolio: PlanningPortfolio?) -> [String] {
        report.issues.map { issue in
            let reason = tr(Self.reasonKeys[issue.reason] ?? issue.reason)
            guard !issue.instrumentId.isEmpty else { return reason }
            return "\(portfolio?.name(issue.instrumentId) ?? ""): \(reason)"
        }
    }

    /// PLAN-022, PLAN-023: the eight result rows; estimates are «More information needed» while issues exist, the
    /// recorded taxes always show.
    public func taxRows(_ report: PlanningResults.TaxReport) -> [GermanPlanningRow] {
        let e = report.estimate
        return [
            GermanPlanningRow(id: "foreignCredit", label: tr("Foreign tax credit applied"), value: amount(e?.foreignCredit)),
            GermanPlanningRow(id: "capitalTax", label: tr("Estimated capital income tax"), value: amount(e?.capitalTax)),
            GermanPlanningRow(id: "solidarity", label: tr("Solidarity surcharge"), value: amount(e?.solidarity)),
            GermanPlanningRow(id: "church", label: tr("Church tax"), value: amount(e?.church)),
            GermanPlanningRow(id: "total", label: tr("Estimated total tax"), value: amount(e?.total)),
            GermanPlanningRow(id: "recorded", label: tr("Recorded taxes (shown separately)"), value: amount(report.recordedTaxes)),
            GermanPlanningRow(id: "shareLosses", label: tr("Remaining share losses"), value: amount(e?.remainingShareLosses)),
            GermanPlanningRow(id: "generalLosses", label: tr("Remaining general losses"), value: amount(e?.remainingGeneralLosses)),
        ]
    }

    /// PLAN-024: `{date} · {instrument}` and the taxable amount of each 2026 realised event.
    public func realisedEvents(_ report: PlanningResults.TaxReport, portfolio: PlanningPortfolio?) -> [GermanPlanningRow] {
        report.events.map {
            GermanPlanningRow(id: $0.id, label: "\(date($0.date)) · \(portfolio?.name($0.instrumentId) ?? "")", value: amount($0.taxable))
        }
    }

    /// PLAN-025: the funds / ETFs with operations, in the server's order.
    public func fundRows(_ tax: PlanningResults.Tax, portfolio: PlanningPortfolio?) -> [GermanFundRow] {
        tax.fundInstrumentIds.map { GermanFundRow(id: $0, name: portfolio?.name($0) ?? "") }
    }

    /// PLAN-025: `{instrument} · {date} · Prior gross advances (€)` per 2026 fund sale.
    public func fundSaleRows(_ tax: PlanningResults.Tax, portfolio: PlanningPortfolio?) -> [GermanFundSaleRow] {
        tax.fundSaleIds.compactMap { id in
            guard let sale = portfolio?.operation(id) else { return nil }
            return GermanFundSaleRow(id: id, label: "\(portfolio?.name(sale.instrumentId) ?? "") · \(date(sale.date)) · \(tr("Prior gross advances (€)"))")
        }
    }

    // MARK: Income (PLAN-027…031)

    /// PLAN-027: per year, newest first.
    public func incomeYears(_ income: PlanningResults.Income) -> [GermanIncomeYearView] {
        income.history.sorted { $0.year > $1.year }.map { y in
            GermanIncomeYearView(year: y.year, rows: [
                GermanPlanningRow(id: "gross", label: tr("Gross income"), value: amount(y.gross)),
                GermanPlanningRow(id: "withheld", label: tr("Recorded withholding and fees"), value: amount(y.withheld)),
                GermanPlanningRow(id: "net", label: tr("Recorded net income"), value: amount(y.net)),
            ])
        }
    }

    /// PLAN-028, PLAN-029: one card per forecast payment (the server already excludes principal redemptions).
    public func forecastCards(_ income: PlanningResults.Income, portfolio: PlanningPortfolio?) -> [GermanForecastCard] {
        income.events.enumerated().map { i, e in
            GermanForecastCard(id: "\(e.instrumentId):\(e.date):\(i)", date: date(e.date), instrument: portfolio?.name(e.instrumentId) ?? "",
                               gross: amount(e.gross), net: amount(e.net), netUnavailable: e.net == nil, benchmark: e.benchmark)
        }
    }
}
