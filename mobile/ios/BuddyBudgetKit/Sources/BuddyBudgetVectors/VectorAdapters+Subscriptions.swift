import BuddyBudgetKit
import Foundation

extension VectorSuite {
    fileprivate static func cadence(_ i: JSONValue) throws -> SubscriptionCadence {
        guard let c = i["cadence"].string.flatMap(SubscriptionCadence.init(rawValue:)) else { throw AdapterError("cadence") }
        return c
    }

    static let subscriptionsHandlers: [String: Handler] = [
        "monthlyEquivalent": { i in .number(SubscriptionCalc.monthlyEquivalent(try num(i["amount"]), cadence: try cadence(i))) },
        "nextChargeDate": { i in
            .string(SubscriptionCalc.nextChargeDate(try str(i["lastDate"]), cadence: try cadence(i), day: i["day"].int))
        },
    ]
}
