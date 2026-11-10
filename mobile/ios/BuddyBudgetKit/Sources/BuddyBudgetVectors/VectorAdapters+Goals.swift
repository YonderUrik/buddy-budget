import BuddyBudgetKit
import Foundation

extension VectorSuite {
    static let goalsHandlers: [String: Handler] = [
        "emergencyTarget": { i in
            .number(GoalWizard.emergencyTarget(essentialMonthly: try num(i["essentialMonthly"]), months: try num(i["months"])))
        },
        "requiredMonthly": { i in
            let d = i["draft"]
            var draft = GoalDraft(target: d["target"].double, targetMonth: d["targetMonth"].string)
            if case .object(let o) = d["sources"] {
                // JSONValue objects are unordered; the sum does not depend on the order for these vectors.
                for key in o.keys.sorted() { draft.setSource(key, try num(o[key]!)) }
            }
            return GoalWizard.requiredMonthly(draft, todayKey: try str(i["today"])).map(JSONValue.number) ?? .null
        },
    ]
}
