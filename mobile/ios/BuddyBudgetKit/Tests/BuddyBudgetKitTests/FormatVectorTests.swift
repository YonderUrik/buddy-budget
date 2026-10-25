import BuddyBudgetKit
import BuddyBudgetVectors
import Testing

// Shared golden vectors (spec/domain/vectors/*.json) for BBFormat, Periods and the domain ports: one parameterized test per
// vector file, one case per vector (named by its id). Same adapters as `swift run vector-check`.

private func check(_ vector: Vector) {
    switch VectorSuite.run(vector) {
    case .pass, .skip:
        break
    case .fail(let message):
        Issue.record("[\(vector.id)] \(vector.function): \(message)")
    }
}

@Test func vectorFilesLoadAndLocaleDataIsCurrent() throws {
    for file in VectorSuite.files {
        #expect(try !VectorSuite.load(file).isEmpty, "\(file) has no vectors")
    }
    #expect(VectorSuite.localeDataMismatch() == nil)
}

@Test("formatting.json", arguments: VectorSuite.vectors("formatting.json"))
func formattingVectors(_ vector: Vector) { check(vector) }

@Test("expenses.json", arguments: VectorSuite.vectors("expenses.json"))
func expensesVectors(_ vector: Vector) { check(vector) }

@Test("cashflow.json", arguments: VectorSuite.vectors("cashflow.json"))
func cashflowVectors(_ vector: Vector) { check(vector) }

@Test("liquidity.json", arguments: VectorSuite.vectors("liquidity.json"))
func liquidityVectors(_ vector: Vector) { check(vector) }

@Test("net-worth.json", arguments: VectorSuite.vectors("net-worth.json"))
func netWorthVectors(_ vector: Vector) { check(vector) }

@Test("debts.json", arguments: VectorSuite.vectors("debts.json"))
func debtsVectors(_ vector: Vector) { check(vector) }

@Test("goals.json", arguments: VectorSuite.vectors("goals.json"))
func goalsVectors(_ vector: Vector) { check(vector) }

@Test("pension.json", arguments: VectorSuite.vectors("pension.json"))
func pensionVectors(_ vector: Vector) { check(vector) }

@Test("italian-taxes.json", arguments: VectorSuite.vectors("italian-taxes.json"))
func italianTaxesVectors(_ vector: Vector) { check(vector) }

@Test("fire-and-simulations.json", arguments: VectorSuite.vectors("fire-and-simulations.json"))
func fireVectors(_ vector: Vector) { check(vector) }

@Test("returns.json", arguments: VectorSuite.vectors("returns.json"))
func returnsVectors(_ vector: Vector) { check(vector) }

@Test("category-colors.json", arguments: VectorSuite.vectors("category-colors.json"))
func categoryColorsVectors(_ vector: Vector) { check(vector) }

@Test("costs.json", arguments: VectorSuite.vectors("costs.json"))
func costsVectors(_ vector: Vector) { check(vector) }

@Test("exposure.json", arguments: VectorSuite.vectors("exposure.json"))
func exposureVectors(_ vector: Vector) { check(vector) }

@Test("financial-planning-de.json", arguments: VectorSuite.vectors("financial-planning-de.json"))
func planningDEVectors(_ vector: Vector) { check(vector) }

@Test("fx.json", arguments: VectorSuite.vectors("fx.json"))
func fxVectors(_ vector: Vector) { check(vector) }

@Test("investments.json", arguments: VectorSuite.vectors("investments.json"))
func investmentsVectors(_ vector: Vector) { check(vector) }

@Test("month-pace.json", arguments: VectorSuite.vectors("month-pace.json"))
func monthPaceVectors(_ vector: Vector) { check(vector) }

@Test("overview-voice.json", arguments: VectorSuite.vectors("overview-voice.json"))
func overviewVoiceVectors(_ vector: Vector) { check(vector) }

@Test("risk.json", arguments: VectorSuite.vectors("risk.json"))
func riskVectors(_ vector: Vector) { check(vector) }

@Test("subscriptions.json", arguments: VectorSuite.vectors("subscriptions.json"))
func subscriptionsVectors(_ vector: Vector) { check(vector) }

// Behaviour not pinned by the vectors but stated in formatting-localization.md.
@Test func amountMaskAndHalfCentRounding() {
    #expect(BBFormat.formatCurrency(1234.5, currency: "EUR", locale: .itIT, masked: true) == "\u{2022}\u{2022}\u{2022}\u{2022}")
    #expect(BBFormat.formatCurrency(1.005, currency: "EUR", locale: .deDE) == "1,01\u{00A0}\u{20AC}")
    #expect(BBFormat.parseAmount("1,5") == 1.5)
    #expect(BBFormat.parseAccountAmount("12,5") == 12.5)
    #expect(JSNumber.round(-2.5) == -2)
}
