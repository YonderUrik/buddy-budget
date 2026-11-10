import BuddyBudgetKit
import Foundation

// costs.json → CostsCalc (summarizeCosts, costDrag). The cost-impact functions are server-side.
extension VectorSuite {
    static let costsHandlers: [String: Handler] = [
        "summarizeCosts": { i in try summarizeCostsVector(i) },
        "costDrag": { i in try costDragVector(i) },
    ]
}
