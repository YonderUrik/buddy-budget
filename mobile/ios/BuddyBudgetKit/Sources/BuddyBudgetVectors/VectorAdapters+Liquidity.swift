import BuddyBudgetKit
import Foundation

/// A fixture transaction (`expenses.json → fixtures.transactions`) as a `MovementFields`.
struct VectorMovement: MovementFields {
    let id: String
    let date: String
    let description: String
    let note: String?
    let categoryId: String?
    let accountId: String?
    let amount: Double
    let excludedAmount: Double

    init(_ j: JSONValue) throws {
        id = try VectorSuite.str(j["id"])
        date = try VectorSuite.str(j["date"])
        description = j["description"].string ?? ""
        note = j["note"].string
        categoryId = j["categoryId"].string
        accountId = j["accountId"].string
        guard let a = JSNumber.parse(try VectorSuite.str(j["amount"])),
              let e = JSNumber.parse(try VectorSuite.str(j["excludedAmount"])) else { throw AdapterError("amount") }
        amount = a
        excludedAmount = e
    }

    /// `expenses.json → fixtures.transactions` (liquidity.json shares the expenses fixtures).
    static func fixture() throws -> [VectorMovement] {
        let url = VectorSuite.specDirectory.appendingPathComponent("domain/vectors/expenses.json")
        let root = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        guard case .array(let items) = root["fixtures"]["transactions"] else { throw AdapterError("transactions fixture") }
        return try items.map(VectorMovement.init)
    }
}

/// JS `Number(x)` for a vector number that may be written as the string "NaN".
private func jsNumber(_ v: JSONValue) throws -> Double {
    if let s = v.string { return JSNumber.parse(s) ?? .nan }
    return try VectorSuite.num(v)
}

extension VectorSuite {
    static let liquidityHandlers: [String: Handler] = [
        "ownShareForPreset": { i in .number(SplitShare.ownShareForPreset(total: try num(i["total"]), parts: try int(i["parts"]))) },
        "clampOwnShare": { i in .number(SplitShare.clampOwnShare(try jsNumber(i["share"]), total: try num(i["total"]))) },
        "excludedFromOwnShare": { i in .number(SplitShare.excludedFromOwnShare(total: try num(i["total"]), ownShare: try jsNumber(i["ownShare"]))) },
        "matchPreset": { i in
            SplitShare.matchPreset(total: try num(i["total"]), ownShare: try jsNumber(i["ownShare"])).map { .string($0.key) } ?? .null
        },
        "groupByDay": { i in
            guard i["fixture"].string == "transactions (only 2026-10-*)" else { throw AdapterError("fixture \(i["fixture"])") }
            let txs = try VectorMovement.fixture().filter { $0.date.hasPrefix("2026-10-") }
            let groups = MovementList.groupByDay(txs, today: try date(i["today"]), locale: try locale(i))
            return .array(groups.map { g in
                .object(["date": .string(g.date), "label": .string(g.label), "total": .number(g.total),
                         "itemIds": .array(g.items.map { .string($0.id) })])
            })
        },
        "computeConnectionHealth": { i in
            let input = i["input"]
            guard let status = input["status"].string.flatMap(ConnectionStatus.init(rawValue:)) else { throw AdapterError("status") }
            let expires = input["consentExpiresAt"].isNull ? nil : try instant(input["consentExpiresAt"])
            let h = ConnectionHealth.computeConnectionHealth(status: status, consentExpiresAt: expires, now: try instant(i["now"]))
            return .object(["state": .string(h.state.rawValue), "daysLeft": h.daysLeft.map { .number(Double($0)) } ?? .null])
        },
    ]
}
