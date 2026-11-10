import BuddyBudgetKit
import Foundation

extension VectorSuite {
    static let pensionHandlers: [String: Handler] = [
        "exitTaxRate": { i in .number(PensionCalc.exitTaxRate(try num(i["years"]))) },
        "exitTaxMilestones": { i in
            let m = PensionCalc.exitTaxMilestones(try str(i["adhesionDate"]))
            return .object(["reductionStartsOn": .string(m.reductionStartsOn), "minRateOn": .string(m.minRateOn)])
        },
        "withdrawalScenarios": { i in
            let list = PensionCalc.withdrawalScenarios(
                value: try num(i["value"]), netContributions: try num(i["netContributions"]),
                adhesionDate: i["adhesionDate"].string, today: try str(i["today"]), yearsOverride: i["yearsOverride"].double)
            return .array(list.map {
                .object(["reason": .string($0.reason.rawValue), "rate": .number($0.rate), "netLow": .number($0.netLow), "netHigh": .number($0.netHigh)])
            })
        },
        "projectPension": { i in .array(try projection(i).map(projectionPoint)) },
        "projectPension(last point)": { i in
            guard let last = try projection(i).last else { throw AdapterError("empty projection") }
            return projectionPoint(last)
        },
    ]

    static func projection(_ i: JSONValue) throws -> [PensionProjectionPoint] {
        let r = i["rates"]
        return PensionCalc.projectPension(
            startValue: try num(i["startValue"]), quarterlyContribution: try num(i["quarterlyContribution"]), years: try num(i["years"]),
            rates: PensionProjectionRates(prudent: try num(r["prudent"]), base: try num(r["base"]), optimistic: try num(r["optimistic"])))
    }

    static func projectionPoint(_ p: PensionProjectionPoint) -> JSONValue {
        .object(["year": .number(Double(p.year)), "prudent": .number(p.prudent), "base": .number(p.base), "optimistic": .number(p.optimistic)])
    }
}
