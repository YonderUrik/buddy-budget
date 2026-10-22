import BuddyBudgetKit
import Foundation

extension VectorSuite {
    fileprivate static func allocationTargets(_ v: JSONValue) throws -> [AllocationTarget] {
        guard case .array(let a) = v else { throw AdapterError("targets") }
        return try a.map { AllocationTarget(instrumentId: try str($0["instrumentId"]), weight: try num($0["weight"])) }
    }

    fileprivate static func analyze(_ i: JSONValue) throws -> AllocationAnalysis {
        guard case .array(let p) = i["positions"] else { throw AdapterError("positions") }
        let positions = try p.map { AllocationPosition(instrumentId: try str($0["instrumentId"]), value: $0["value"].double) }
        return AllocationTargets.analyzeAllocation(positions: positions, targets: try allocationTargets(i["targets"]))
    }

    static let exposureHandlers: [String: Handler] = [
        "analyzeAllocation": { i in
            let a = try analyze(i)
            return .object([
                "rows": .array(a.rows.map { r in
                    .object(["instrumentId": .string(r.instrumentId), "value": .number(r.value), "currentWeight": .number(r.currentWeight),
                             "targetWeight": .number(r.targetWeight), "drift": .number(r.drift), "status": .string(r.status.rawValue),
                             "inTarget": .bool(r.inTarget)])
                }),
                "total": .number(a.total),
                "unpricedIds": .array(a.unpricedIds.map(JSONValue.string)),
                "maxDrift": .number(a.maxDrift),
            ])
        },
        "suggestContribution": { i in
            // "output of <vector id>": rerun that analyzeAllocation vector's input.
            let ref = try str(i["analysis"])
            guard ref.hasPrefix("output of "),
                  let source = try load("exposure.json").first(where: { $0.id == String(ref.dropFirst("output of ".count)) })
            else { throw AdapterError("analysis ref \(ref)") }
            let suggestions = AllocationTargets.suggestContribution(try analyze(source.input), amount: try num(i["amount"]))
            return .array(suggestions.map { s in
                .object(["instrumentId": .string(s.instrumentId), "amount": .number(s.amount),
                         "weightAfter": .number(s.weightAfter), "targetWeight": .number(s.targetWeight)])
            })
        },
        "isCompleteTarget": { i in .bool(AllocationTargets.isCompleteTarget(try allocationTargets(i["targets"]))) },
    ]
}
