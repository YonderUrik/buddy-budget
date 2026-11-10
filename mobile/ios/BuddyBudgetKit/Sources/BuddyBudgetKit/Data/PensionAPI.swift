import Foundation

// Pensione (spec: api/endpoints/pension.md, features/09-pension.md). IT only: DE gets 403 `country_feature_unavailable`.
// Amounts are JSON numbers. Same names on Android (`PensionApi` and the models in `core/data/PensionApi.kt`).

// MARK: - GET /api/pension/view

/// Everything the Pensione tabs show for one fund (gaps.md G10, PEN-002).
public struct PensionView: Decodable, Equatable, Sendable {
    public struct FundSummary: Decodable, Equatable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let adhesionDate: String
        public let snapshotCount: Int
        public let lastDate: String?
    }

    public struct Fund: Decodable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let adhesionDate: String
        /// Sorted by date ascending.
        public let snapshots: [PensionSnapshot]
    }

    public struct Performance: Decodable, Equatable, Sendable {
        public let value: Double
        public let netContributions: Double
        public let gain: Double
        public let gainPct: Double?
        public let annualReturn: Double?
        public let approximate: Bool
        public let firstDate: String
        public let lastDate: String
    }

    public struct Contribution: Decodable, Equatable, Sendable {
        public let date: String
        public let amount: Double
        public let estimated: Bool
    }

    public struct Scenario: Decodable, Equatable, Sendable {
        /// `pensionamento` | `sanitarie` | `altri`.
        public let reason: String
        public let rate: Double
        public let netLow: Double
        public let netHigh: Double

        public init(reason: String, rate: Double, netLow: Double, netHigh: Double) {
            self.reason = reason
            self.rate = rate
            self.netLow = netLow
            self.netHigh = netHigh
        }
    }

    public struct Tfr: Decodable, Equatable, Sendable {
        public let gross: Double
        public let net: Double
        public let annualRate: Double
    }

    public struct Year: Decodable, Equatable, Sendable {
        public let year: Int
        public let contributions: Double
        public let gain: Double
        public let endValue: Double
        public let returnRate: Double?
        public let partial: Bool
    }

    public struct Slider: Decodable, Equatable, Sendable {
        public let min: Double
        public let max: Double
        public let step: Double
        public let `default`: Double
    }

    public struct Projection: Decodable, Equatable, Sendable {
        public struct Preview: Decodable, Equatable, Sendable {
            public let year: Int
            public let prudent: Double
            public let base: Double
            public let optimistic: Double
        }

        public struct Rates: Decodable, Equatable, Sendable {
            public let prudent: Double
            public let base: Double
            public let optimistic: Double
        }

        public struct Sliders: Decodable, Equatable, Sendable {
            public let years: Slider
            public let quarterlyContribution: Slider
        }

        public let preview: Preview?
        public let years: Int
        public let rates: Rates
        public let sliders: Sliders
    }

    public struct ExitTax: Decodable, Equatable, Sendable {
        public struct Milestones: Decodable, Equatable, Sendable {
            public let reductionStartsOn: String
            public let minRateOn: String
        }

        public struct Step: Decodable, Equatable, Sendable {
            public let years: Int
            public let rate: Double
            public let scenarios: [Scenario]
        }

        public let realYears: Int
        public let rate: Double
        public let milestones: Milestones?
        public let maxYears: Int
        /// 36 entries, index = years of participation (0…35).
        public let timeline: [Step]
    }

    public let currency: String
    public let today: String
    public let funds: [FundSummary]
    public let fund: Fund?
    public let last: PensionSnapshot?
    public let performance: Performance?
    public let contributions: [Contribution]
    public let scenarios: [Scenario]
    public let tfr: Tfr?
    public let assumedInflation: Double
    public let quarterly: Double
    public let yearly: [Year]
    public let projection: Projection
    public let exitTax: ExitTax
}

public struct PensionSnapshot: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let date: String
    public let netContributions: Double
    public let value: Double

    public init(id: String, date: String, netContributions: Double, value: Double) {
        self.id = id
        self.date = date
        self.netContributions = netContributions
        self.value = value
    }
}

// MARK: - Requests

/// One row of `POST /api/pension/funds/{id}/snapshots/import` (PEN-017).
public struct PensionImportRowInput: Equatable, Sendable {
    public let line: Int
    public let date: String
    public let netContributions: Double
    public let value: Double

    public init(line: Int, date: String, netContributions: Double, value: Double) {
        self.line = line
        self.date = date
        self.netContributions = netContributions
        self.value = value
    }
}

/// `counts` of an import (201) or of a refused one (400 with `rows`).
public struct PensionImportCounts: Decodable, Equatable, Sendable {
    public let new: Int
    public let update: Int
    public let unchanged: Int
    public let error: Int

    public init(new: Int, update: Int, unchanged: Int, error: Int) {
        self.new = new
        self.update = update
        self.unchanged = unchanged
        self.error = error
    }
}

// MARK: - API

public struct PensionAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// PEN-002 (`fundId` default: first fund).
    public func view(fundId: String?) async throws -> PensionView {
        try await client.get("api/pension/view", query: fundId.map { ["fundId": $0] } ?? [:])
    }

    /// PEN-006 (201 `{ id }`).
    public func createFund(name: String, adhesionDate: String) async throws -> String {
        let response = try await client.send("api/pension/funds", method: "POST",
                                             body: try Self.body(["name": name, "adhesionDate": adhesionDate]))
        return DebtsAPI.id(response.data)
    }

    /// PEN-008 (204): only changed fields are sent.
    public func updateFund(id: String, name: String?, adhesionDate: String?) async throws {
        var body: [String: Any] = [:]
        if let name { body["name"] = name }
        if let adhesionDate { body["adhesionDate"] = adhesionDate }
        _ = try await client.send("api/pension/funds/\(id)", method: "PATCH", body: try Self.body(body))
    }

    /// PEN-009 (204).
    public func deleteFund(id: String) async throws {
        try await client.sendNoContent("api/pension/funds/\(id)", method: "DELETE")
    }

    /// PEN-010: upsert by date (201).
    public func saveSnapshot(fundId: String, date: String, netContributions: Double, value: Double) async throws {
        _ = try await client.send("api/pension/funds/\(fundId)/snapshots", method: "POST",
                                  body: try Self.body(["date": date, "netContributions": netContributions, "value": value]))
    }

    /// PEN-012 (204).
    public func deleteSnapshot(fundId: String, snapshotId: String) async throws {
        try await client.sendNoContent("api/pension/funds/\(fundId)/snapshots/\(snapshotId)", method: "DELETE")
    }

    /// PEN-017: all-or-nothing import of rows parsed on the device (pasted text → `incollato`).
    public func importSnapshots(fundId: String, rows: [PensionImportRowInput], format: String = "incollato") async throws -> PensionImportCounts {
        struct Result: Decodable { let counts: PensionImportCounts }
        let body: [String: Any] = [
            "format": format,
            "rows": rows.map { ["line": $0.line, "date": $0.date, "netContributions": $0.netContributions, "value": $0.value] },
        ]
        let response = try await client.send("api/pension/funds/\(fundId)/snapshots/import", method: "POST", body: try Self.body(body))
        do {
            return try JSONDecoder().decode(Result.self, from: response.data).counts
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    static func body(_ json: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }
}
