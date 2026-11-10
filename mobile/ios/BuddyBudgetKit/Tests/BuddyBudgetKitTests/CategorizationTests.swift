import Foundation
import Testing
@testable import BuddyBudgetKit

// Categories, rules and Categorizza (features/05-categories-categorization.md), against spec/api/fixtures.

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
    try JSONDecoder().decode(T.self, from: try fixture(name))
}

private func cat(_ id: String, _ name: String, _ type: CategoryType, fallback: Bool = false) -> MovementCategory {
    MovementCategory(id: id, name: name, type: type, isFallback: fallback)
}

private func group(_ key: String, count: Int, suggestion: CategorizeSuggestion? = nil, income: Bool = false) -> SuggestionGroup {
    SuggestionGroup(groupKey: "\(key)::\(income ? "entrata" : "uscita")", merchantKey: key, label: key.capitalized,
                    transactionIds: (0..<count).map { "\(key)-\($0)" }, transactionDescriptions: Array(repeating: key, count: count),
                    transactionDates: (0..<count).map { "2026-10-\(String(format: "%02d", 10 + $0))" },
                    transactionAmounts: Array(repeating: -10, count: count), totalAmount: Double(-10 * count), suggestion: suggestion)
}

@Test func CAT001_CAT003_decodesCategoriesAndFindsTheFallbackByFlag() throws {
    let categories = try decode([MovementCategory].self, "categories.json")
    #expect(categories.count == 25)
    #expect(categories.filter(\.isFallback).count == 1)
    let english = try decode([MovementCategory].self, "categories-en.json")
    #expect(english.contains { $0.isFallback })
}

@Test func CAT004_directionCompatibility() {
    #expect(CategoryRules.isDirectionCompatible(.entrata, isIncome: true, isFallback: false))
    #expect(!CategoryRules.isDirectionCompatible(.entrata, isIncome: false, isFallback: false))
    #expect(CategoryRules.isDirectionCompatible(.dovuta, isIncome: false, isFallback: false))
    #expect(!CategoryRules.isDirectionCompatible(.dovuta, isIncome: true, isFallback: false))
    #expect(CategoryRules.isDirectionCompatible(.trasferimento, isIncome: true, isFallback: false))
    #expect(CategoryRules.isDirectionCompatible(.voluta, isIncome: true, isFallback: true))
}

@Test func CAT006_CAT007_boardSectionsInOrderWithEmptyGroups() throws {
    let board = CategoryBoard.sections(try decode([MovementCategory].self, "categories.json"))
    #expect(board.map(\.key) == ["dovuta", "voluta", "futuro", "saltuaria", "entrata", "trasferimento", "fallback"])
    #expect(board.last?.addType == nil)
    let minimal = CategoryBoard.sections([cat("1", "Stipendio", .entrata)])
    #expect(minimal.map(\.key) == ["dovuta", "voluta", "futuro", "saltuaria", "entrata", "trasferimento"])
    #expect(minimal[0].categories.isEmpty)
}

@Test func CAT090_mostUsedOnlyWithEightCategoriesAndSomeUsage() throws {
    let all = try decode([MovementCategory].self, "categories.json")
    let spesa = try #require(all.first { $0.name == "Spesa" })
    let sections = CategoryPicker.sections(all, usage: [spesa.id: 3], query: "")
    #expect(sections.first?.key == "most-used")
    #expect(sections.first?.categories == [spesa])
    #expect(sections.last?.key == "fallback")
    let few = Array(all.prefix(5))
    #expect(CategoryPicker.sections(few, usage: [few[0].id: 3], query: "").first?.key != "most-used")
    #expect(CategoryPicker.sections(all, usage: [:], query: "").first?.key != "most-used")
    // Alphabetical inside a group.
    let dovute = try #require(sections.first { $0.key == "type-dovuta" })
    #expect(dovute.categories.map(\.name) == dovute.categories.map(\.name).sorted { CategoryLegend.localeCompareIt($0, $1) < 0 })
}

@Test func CAT091_searchIsAccentInsensitiveAndRanked() {
    let categories = [cat("1", "Caffè & Bar", .voluta), cat("2", "Bar sport", .voluta), cat("3", "Sport & Benessere", .voluta),
                      cat("4", "Stipendio", .entrata), cat("5", "Da categorizzare", .voluta, fallback: true)]
    #expect(CategoryPicker.normalizeForSearch(" Caffè ") == "caffe")
    let caffe = CategoryPicker.sections(categories, usage: [:], query: "CAFFE")
    #expect(caffe.first?.categories.map(\.id) == ["1"])
    // prefix (Bar sport) > word prefix (Caffè & Bar)
    #expect(CategoryPicker.sections(categories, usage: [:], query: "bar").first?.categories.map(\.id) == ["2", "1"])
    // every word must match
    #expect(CategoryPicker.sections(categories, usage: [:], query: "sport bar").first?.categories.map(\.id) == ["2"])
    // group label match comes after name matches; the fallback is found only by name
    let volute = CategoryPicker.sections(categories, usage: ["3": 9], query: "volu").first?.categories.map(\.id)
    #expect(volute == ["3", "2", "1"])
    #expect(CategoryPicker.sections(categories, usage: [:], query: "zzz").isEmpty)
}

@Test func CAT025_decodesRulesFixture() throws {
    let rules = try decode([CategorizationRule].self, "categorization-rules.json")
    #expect(!rules.isEmpty)
    #expect(rules[0].matchType == .merchant)
    #expect(rules[0].isLearned)
    #expect(rules[0].categoryName != nil)
}

@Test func CAT033_ruleSaveResultCarriesAppliedAndPastMatches() throws {
    let json = #"{"id":"r","matchType":"contains","pattern":"amazon","categoryId":"c","splitPercentage":"0.5000","source":"manuale","hitCount":0,"applied":3,"pastMatches":12}"#
    let result = try JSONDecoder().decode(RuleSaveResult.self, from: Data(json.utf8))
    #expect(result.applied == 3 && result.pastMatches == 12)
    let rule = try JSONDecoder().decode(CategorizationRule.self, from: Data(json.utf8))
    #expect(rule.splitPercentage == 0.5)
}

@Test func CAT039_deckSortsGroupsByMovementCount() {
    let deck = CategorizeDeck(groups: [group("a", count: 1), group("b", count: 3), group("c", count: 1), group("d", count: 2)])
    #expect(deck.queue.map(\.merchantKey) == ["b", "d", "a", "c"])
    #expect(deck.movementCount == 7)
}

@Test func CAT058_CAT066_confirmUsesTheProposalAndItsSplit() throws {
    let suggestion = CategorizeSuggestion(suggestedCategoryId: "cat", source: .storico, confidence: 0.8, suggestedSplitPercentage: 0.5)
    var deck = CategorizeDeck(groups: [group("a", count: 2, suggestion: suggestion), group("b", count: 1)])
    let confirmed = deck.confirm(remember: true)
    #expect(confirmed)
    let saved = deck.beginSave()
    let batch = try #require(saved)
    #expect(batch[0].applyGroup == CategorizeApplyGroup(transactionIds: ["a-0", "a-1"], categoryId: "cat", excludedPercentage: 0.5,
                                                        createRule: true, merchantKey: "a"))
    // No proposal: confirm is refused, choosing another category applies 0 %.
    let refused = deck.confirm(remember: false)
    #expect(!refused)
    deck.choose(categoryId: "other", remember: false)
    #expect(deck.pending.last?.excludedPercentage == 0)
    #expect(deck.pending.last?.exit == .change)
    #expect(deck.isEmpty)
}

@Test func CAT060_skipMovesTheCardToTheEnd() {
    var deck = CategorizeDeck(groups: [group("a", count: 3), group("b", count: 2), group("c", count: 1)])
    deck.skip()
    #expect(deck.queue.map(\.merchantKey) == ["b", "c", "a"])
    #expect(deck.pending.isEmpty)
}

@Test func CAT064_undoRestoresTheLastUnsavedDecision() {
    var deck = CategorizeDeck(groups: [group("a", count: 2), group("b", count: 1)])
    deck.choose(categoryId: "x", remember: false)
    deck.choose(categoryId: "y", remember: false)
    #expect(deck.isEmpty && deck.canUndo)
    let undone = deck.undo()
    #expect(undone?.group.merchantKey == "b")
    #expect(deck.current?.merchantKey == "b")
    _ = deck.beginSave()
    #expect(!deck.canUndo) // saved decisions are not undoable
}

@Test func CAT065_failedSaveReturnsCardsToTheDeck() throws {
    var deck = CategorizeDeck(groups: [group("a", count: 2), group("b", count: 1)])
    deck.choose(categoryId: "x", remember: false)
    let saved = deck.beginSave()
    let batch = try #require(saved)
    deck.failSave(batch)
    #expect(deck.queue.map(\.merchantKey) == ["a", "b"])
    #expect(deck.saving.isEmpty)
}

@Test func CAT040_CAT042_readyGroupsHiddenAndRestored() {
    let groups = [group("a", count: 2), group("b", count: 1)]
    var deck = CategorizeDeck(groups: groups)
    deck.remove(keys: ["a::uscita"])
    #expect(deck.queue.map(\.merchantKey) == ["b"])
    deck.restore([groups[0]])
    #expect(deck.queue.map(\.merchantKey) == ["b", "a"])
}

@Test func CAT047_originPhrases() {
    #expect(CategorizationText.suggestionOrigin(CategorizeSuggestion(suggestedCategoryId: "c", source: .assistente, confidence: 0.7)).key == "Proposta dall'AI")
    #expect(CategorizationText.suggestionOrigin(CategorizeSuggestion(suggestedCategoryId: "c", source: .regola, confidence: 0.7, rulePattern: "esselunga"))
        == .init(key: "Simile alla tua regola «{0}»", values: ["esselunga"]))
    let history = { (a: Int, t: Int) in CategorizationText.suggestionOrigin(
        CategorizeSuggestion(suggestedCategoryId: "c", source: .storico, confidence: 0.7, history: .init(agreeing: a, total: t))) }
    #expect(history(1, 1).key == "Come l'unico tuo movimento simile")
    #expect(history(3, 3) == .init(key: "Come tutti i tuoi {0} movimenti simili", values: ["3"]))
    #expect(history(2, 3) == .init(key: "Come {0} dei tuoi {1} movimenti simili", values: ["2", "3"]))
    #expect(CategorizationText.confidencePercent(0.934) == 93)
}

@Test func CAT055_dateRangeLabel() {
    let today = CalendarDate(year: 2026, month: 10, day: 18)
    #expect(CategorizationText.dateRangeLabel(["2026-10-09"], today: today, locale: .itIT) == "9 ott")
    #expect(CategorizationText.dateRangeLabel(["2026-10-09", "2026-10-02"], today: today, locale: .itIT) == "2–9 ott")
    #expect(CategorizationText.dateRangeLabel(["2026-09-28", "2026-10-09"], today: today, locale: .itIT) == "28 set – 9 ott")
    #expect(CategorizationText.dateRangeLabel(["2025-12-28", "2026-01-09"], today: today, locale: .itIT).contains("2025"))
    #expect(CategorizationText.recentIndices(["2026-10-01", "2026-10-09", "2026-10-05"], limit: 2) == [1, 2])
}

@Test func CAT037_decodesSuggestionsAndAutoCategorizedShapes() throws {
    let suggestions = #"{"groups":[{"groupKey":"bar centrale::uscita","merchantKey":"bar centrale","label":"Bar Centrale","transactionIds":["t"],"transactionDescriptions":["Bar Centrale"],"transactionDates":["2026-10-16"],"transactionAmounts":[-4.6],"totalAmount":-4.6,"suggestion":{"transactionId":"t","merchantKey":"bar centrale","suggestedCategoryId":"c","source":"storico","confidence":0.67,"reason":"x","suggestedSplitPercentage":null,"history":{"agreeing":2,"total":2}},"hasDivergentSuggestions":false,"logoPath":null}],"autoApply":{"enabled":true,"ready":0,"readyKeys":[]}}"#
    let decoded = try JSONDecoder().decode(CategorizeSuggestionsResponse.self, from: Data(suggestions.utf8))
    #expect(decoded.groups[0].suggestion?.history?.total == 2)
    #expect(!decoded.groups[0].isIncome)
    let auto = #"{"groups":[{"groupKey":"k","merchantKey":"m","label":"M","categoryId":"c","source":"regola","confidence":null,"transactionIds":["t"],"transactionDescriptions":["M"],"transactionDates":["2026-10-05"],"transactionAmounts":[-742.18],"totalAmount":-742.18,"lastCategorizedAt":"2026-10-18T11:45:23.496Z","logoPath":null}],"total":1,"seenAt":"2026-01-01T00:00:00.000Z"}"#
    let response = try JSONDecoder().decode(AutoCategorizedResponse.self, from: Data(auto.utf8))
    #expect(response.groups[0].source == .regola && response.total == 1)
}

@Test func CAT052_refreshKeepsOrderAndAddsNewGroups() {
    var deck = CategorizeDeck(groups: [group("a", count: 2), group("b", count: 1), group("c", count: 1)])
    deck.choose(categoryId: "x", remember: false) // a decided
    let suggestion = CategorizeSuggestion(suggestedCategoryId: "s", source: .assistente, confidence: 0.7)
    #expect(deck.withoutProposal == 2)
    deck.refresh(with: [group("a", count: 2), group("c", count: 1, suggestion: suggestion), group("b", count: 1), group("d", count: 1)])
    #expect(deck.queue.map(\.merchantKey) == ["b", "c", "d"])
    #expect(deck.queue[1].suggestion != nil)
    #expect(deck.withoutProposal == 2)
}
