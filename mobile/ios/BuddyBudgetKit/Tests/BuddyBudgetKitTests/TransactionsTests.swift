import Foundation
import Testing
@testable import BuddyBudgetKit

// Movimenti, Analisi and the add/edit/split forms (features/03-transactions.md), against spec/api/fixtures.

private func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
    try JSONDecoder().decode(T.self, from: try fixture(name))
}

private let today = CalendarDate(year: 2026, month: 10, day: 18)

private func movement(_ id: String, amount: Double, excluded: Double = 0, category: String? = "c", date: String = "2026-10-18",
                      note: String? = nil, source: TransactionOrigin = .manuale) -> Movement {
    Movement(id: id, accountId: "a", categoryId: category, description: "Spesa \(id)", note: note, amount: amount,
             excludedAmount: excluded, date: date, source: source)
}

@Test func TX007_pagedRequestSendsLimitCursorAndFilters() async throws {
    let transport = StubTransport(status: 200, body: String(decoding: try fixture("transactions-page.json"), as: UTF8.self))
    let api = TransactionsAPI(client: makeClient(transport, token: "t"))
    let query = TransactionQuery(type: .uscita, accountId: "acc", categoryId: "cat", search: "  super ", uncategorized: true, limit: 20)
    let page = try await api.page(query, cursor: "CUR")
    let url = try #require(transport.last?.url)
    let items = Dictionary(uniqueKeysWithValues: URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!.map { ($0.name, $0.value!) })
    #expect(url.path == "/api/transactions")
    #expect(items == ["limit": "20", "type": "uscita", "accountId": "acc", "categoryId": "cat", "q": "super", "uncategorized": "1", "cursor": "CUR"])
    #expect(page.items.count == 20)
    #expect(page.nextCursor != nil)
    let transfer = page.items[0]
    #expect(transfer.amount == -250 && transfer.excludedAmount == -250 && transfer.effectiveAmount == 0)
    #expect(transfer.source == .auto)
}

@Test func TX014_TX015_defaultQueryHasNoOptionalFilters() {
    let q = TransactionQuery()
    #expect(q.queryItems(cursor: nil) == ["limit": "50", "type": "tutte"])
    #expect(!q.hasFilters)
    #expect(TransactionQuery(search: "   ").queryItems(cursor: nil)["q"] == nil)
    #expect(TransactionQuery(type: .entrata).hasFilters)
}

@Test func TX018_feedGroupsByDayAndHoldsBackTheIncompleteLastDay() throws {
    var feed = MovementFeed()
    feed.reset(with: try decode(MovementPage.self, "transactions-page.json"))
    let first = feed.groups(today: today, locale: .itIT)
    #expect(first.first?.date == "2026-10-18")
    #expect(first.first?.label == "Oggi")
    #expect(first[1].label == "Ieri")
    // Page 1 ends on 10 Oct: hidden until page 2 arrives.
    #expect(first.last?.date == "2026-10-11")
    #expect(first.first?.total == 0) // the two transfers count 0
    feed.append(try decode(MovementPage.self, "transactions-page-2.json"))
    let second = feed.groups(today: today, locale: .itIT)
    #expect(second.contains { $0.date == "2026-10-10" })
    #expect(feed.items.count == 40)
    // Appending the same page again does not duplicate rows.
    feed.append(try decode(MovementPage.self, "transactions-page-2.json"))
    #expect(feed.items.count == 40)
}

@Test func TX019_lastPageShowsEveryDay() throws {
    var feed = MovementFeed()
    feed.reset(with: try decode(MovementPage.self, "transactions-page-uncategorized.json"))
    #expect(!feed.hasMore)
    #expect(feed.groups(today: today, locale: .itIT).count == 5)
}

@Test func TX008_decodesLiquidityMonthFixtures() throws {
    let month = try decode(LiquidityMonth.self, "liquidity-month.json")
    #expect(month.accounts.count == 4)
    #expect(month.groups.map(\.key) == ["dovuta", "voluta", "futuro", "saltuaria"])
    #expect(month.voice.first?.segments.contains { $0.strong } == true)
    #expect(month.budget != nil)
    #expect(month.surplus == JSNumber.round2(month.income - month.spent))
    let empty = try decode(LiquidityMonth.self, "liquidity-month-en-empty.json")
    #expect(empty.pace.typicalSoFar == nil)
    #expect(empty.budget == nil)
    #expect(empty.toFix == 0)
    _ = try decode(LiquidityMonth.self, "liquidity-month-account.json")
}

@Test func TX053_decodesAnalysisFixtures() throws {
    let current = try decode(LiquidityAnalysis.self, "liquidity-analysis.json")
    #expect(current.isCurrentMonth)
    #expect(current.typical != nil)
    #expect(current.curve.first?.date == current.range.from)
    #expect(current.groups.allSatisfy { !$0.categories.isEmpty })
    let previous = try decode(LiquidityAnalysis.self, "liquidity-analysis-previous-month.json")
    #expect(!previous.isCurrentMonth)
    #expect(previous.typical == nil)
    let year = try decode(LiquidityAnalysis.self, "liquidity-analysis-anno.json")
    #expect(year.savings.count == 12)
}

@Test func TX007_decodesAccountsAsRefs() throws {
    let accounts = try decode([Account].self, "accounts.json")
    #expect(!accounts.isEmpty)
    #expect(accounts.contains { $0.isManual })
}

private func categories() throws -> [MovementCategory] { try decode([MovementCategory].self, "categories.json") }

@Test func TX042_addFormValidatesEachStep() throws {
    let cats = try categories()
    let accounts = [Account(id: "bank", name: "Banca", type: "", balance: 0, source: .auto), Account(id: "cash", name: "Contanti", type: "", balance: 0)]
    var form = AddTransactionForm(today: today)
    var ok = form.next(categories: cats, usage: [:], accounts: accounts)
    #expect(!ok)
    #expect(form.errors[.amount] == "Scrivi un importo maggiore di zero.")
    form.amountText = "0"
    ok = form.next(categories: cats, usage: [:], accounts: accounts)
    #expect(!ok)
    form.amountText = "12,50"
    ok = form.next(categories: cats, usage: [:], accounts: accounts)
    #expect(ok)
    #expect(form.step == 1)
    let missing = form.body(categories: cats, usage: [:], accounts: accounts)
    #expect(missing == nil)
    #expect(form.errors[.description] != nil)
    form.description = "  Pane  "
    let built = form.body(categories: cats, usage: [:], accounts: accounts)
    let body = try #require(built)
    #expect(body.amount == 12.5)
    #expect(body.description == "Pane")
    #expect(body.direction == "uscita")
    #expect(body.accountId == "cash") // first manual account
    #expect(body.date == "2026-10-18")
}

@Test func TX043_defaultCategoryIsTheMostUsedEligibleNeverTheFallback() throws {
    let cats = try categories()
    let spesa = try #require(cats.first { $0.name == "Spesa" })
    let fallback = try #require(cats.first { $0.isFallback })
    var form = AddTransactionForm(today: today)
    #expect(form.categoryId(cats, usage: [spesa.id: 5, fallback.id: 50]) == spesa.id)
    form.isIncome = true
    let stipendio = try #require(cats.first { $0.name == "Stipendio" })
    #expect(form.categoryId(cats, usage: [stipendio.id: 1]) == stipendio.id)
    #expect(form.availableCategories(cats).allSatisfy { $0.type == .entrata || $0.type == .trasferimento })
    // Changing direction resets an explicit choice.
    form.categoryOverride = stipendio.id
    form.isIncome = false
    #expect(form.categoryOverride == nil)
}

@Test func TX044_noManualAccountBlocksSubmit() throws {
    var form = AddTransactionForm(today: today)
    form.amountText = "5"
    form.description = "Caffè"
    let body = form.body(categories: try categories(), usage: [:], accounts: [Account(id: "b", name: "B", type: "", balance: 0, source: .auto)])
    #expect(body == nil)
    #expect(form.errors[.account] == "Serve un conto manuale su cui registrare il movimento.")
}

@Test func TX046_addAnotherKeepsDateAccountAndDirection() {
    var form = AddTransactionForm(today: today)
    form.isIncome = true
    form.amountText = "10"
    form.description = "x"
    form.accountOverride = "cash"
    form.date = CalendarDate(year: 2026, month: 10, day: 17)
    form.step = 1
    form.didAddAndContinue()
    #expect(form.step == 0 && form.amountText.isEmpty && form.description.isEmpty)
    #expect(form.isIncome && form.accountOverride == "cash" && form.date.day == 17)
    #expect(form.added == 1)
}

@Test func TX034_TX035_splitFormClampsAndMatchesPresets() {
    var split = SplitForm(movement: movement("m", amount: -90, excluded: -45))
    #expect(split.total == 90 && split.ownShare == 45)
    #expect(split.matchingPreset?.key == "meta")
    split.applyPreset(SplitShare.presets[2])
    #expect(split.ownShare == 30 && split.excluded == 60)
    split.setOwnShare(text: "200")
    #expect(split.ownShare == 90 && split.excluded == 0)
    split.setOwnShare(text: "abc")
    #expect(split.ownShare == 90)
    split.setOwnShare(-3)
    #expect(split.ownShare == 0 && split.excluded == 90)
    #expect(split.matchingPreset == nil)
}

@Test func TX039_editSendsOnlyChangedValidFields() {
    let m = movement("m", amount: -12.5, date: "2026-10-10")
    #expect(MovementEdit.patch(m, description: "Spesa m", date: CalendarDate(iso: "2026-10-10")!, amountText: "12,50") == nil)
    let patch = MovementEdit.patch(m, description: " Pane ", date: CalendarDate(iso: "2026-10-11")!, amountText: "")
    #expect(patch == TransactionPatch(description: "Pane", date: "2026-10-11"))
    #expect(MovementEdit.patch(m, description: "", date: CalendarDate(iso: "2026-10-10")!, amountText: "13") == TransactionPatch(amount: 13))
}

@Test func TX038_noteSavesOnlyWhenChangedAndEmptyClears() {
    let m = movement("m", amount: -1, note: "cena")
    #expect(MovementEdit.notePatch(m, text: " cena ") == nil)
    #expect(MovementEdit.notePatch(m, text: "") == "")
    #expect(MovementEdit.notePatch(m, text: String(repeating: "a", count: 600))?.count == 500)
}

@Test func TX025_TX026_movementKind() throws {
    let cats = try categories()
    let transfer = cats.first { $0.type == .trasferimento }
    let fallback = cats.first { $0.isFallback }
    let spesa = cats.first { $0.name == "Spesa" }
    #expect(MovementKind.of(movement("a", amount: -5, excluded: -5), category: transfer) == .transfer)
    #expect(MovementKind.of(movement("a", amount: -5), category: fallback) == .uncategorized)
    #expect(MovementKind.of(movement("a", amount: -5, excluded: -2), category: spesa) == .split)
    #expect(MovementKind.of(movement("a", amount: -5), category: spesa) == .plain)
}

@Test func TX028_pickerOffersFallbackTransfersAndDirectionCategories() throws {
    let cats = try categories()
    let forIncome = CategoryRules.pickerCategories(cats, amount: 10)
    #expect(forIncome.contains { $0.isFallback })
    #expect(forIncome.allSatisfy { $0.isFallback || $0.type == .entrata || $0.type == .trasferimento })
    let forExpense = CategoryRules.pickerCategories(cats, amount: -10)
    #expect(!forExpense.contains { $0.type == .entrata })
}

@Test func TX052_analysisPeriodNavigation() {
    let ref = today
    #expect(Periods.shiftReferenceDate(.mese, ref, direction: -1).month == 9)
    let range = Periods.getPeriodRange(.treMesi, ref)
    #expect(range.from.iso == "2026-08-01" && range.to.iso == "2026-10-31")
}

@Test func TX054_trendGeometryPadsTwelvePercentAndSpansBothSeries() {
    let layout = TrendGeometry.layout(values: [0, 50, 100], reference: [0, 10, 20, 200], width: 300, height: 100)
    #expect(layout.columns == 4)
    #expect(layout.line[0] == ChartPoint(x: 0, y: 88))
    #expect(layout.reference[3] == ChartPoint(x: 300, y: 12))
    #expect(TrendGeometry.index(x: 160, width: 300, columns: 4) == 2)
    let flat = TrendGeometry.layout(values: [5, 5], reference: nil, width: 10, height: 100)
    #expect(flat.line.allSatisfy { $0.y == 88 })
}

@Test func TX008_voiceTextMasksNumbers() {
    #expect(VoiceText.masked("Spesi 2164 €, 808 € in più") == "Spesi •••• €, •••• € in più")
}
