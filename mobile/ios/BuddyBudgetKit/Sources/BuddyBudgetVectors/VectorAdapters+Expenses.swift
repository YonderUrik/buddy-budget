import BuddyBudgetKit
import Foundation

extension VectorSuite {
    static let expensesHandlers: [String: Handler] = [
        "filterTransactions": { i in
            guard i["fixture"].string == "transactions" else { throw AdapterError("fixture \(i["fixture"])") }
            let f = i["filter"]
            let filter = MovementFilter(categoryId: f["categoryId"].string, searchText: try str(f["searchText"]),
                                        accountId: f["accountId"].string)
            let result = MovementList.filterTransactions(try VectorMovement.fixture(), filter: filter)
            // The search vector records only the count (see its notes).
            if i["filter"]["searchText"].string?.isEmpty == false { return .number(Double(result.count)) }
            return .array(result.map { .string($0.id) })
        },
    ]
}
