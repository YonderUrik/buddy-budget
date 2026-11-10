import Foundation
import Testing
@testable import BuddyBudgetKit

// Abbonamenti (spec: features/06-subscriptions.md). Fixture captured from the dev server (dev user, today 2026-10-18):
// Tests/BuddyBudgetKitTests/Fixtures/subscriptions.json (proposed for spec/api/fixtures/). Twin: SubscriptionsTest.kt.

private func subscriptionsFixture() throws -> SubscriptionsResponse {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/subscriptions.json")
    return try SubscriptionsResponse.decode(try Data(contentsOf: url))
}

nonisolated(unsafe) private let italian = SubscriptionText(locale: .itIT, translate: { $0 })

private func item(_ key: String, id: String? = nil, origin: SubscriptionOrigin = .rilevato,
                  decision: SubscriptionDecision = .daConfermare, activity: SubscriptionActivity = .attivo,
                  cadence: SubscriptionCadence? = .mensile, amount: Double? = 10, monthly: Double? = 10,
                  lastDate: String? = nil, nextDate: String? = nil, priceChange: SubscriptionPriceChange? = nil,
                  charges: [SubscriptionCharge] = []) -> SubscriptionItem {
    SubscriptionItem(key: key, id: id, name: key.capitalized, origin: origin, decision: decision, activity: activity,
                     cadence: cadence, amount: amount, monthly: monthly, lastDate: lastDate, nextDate: nextDate,
                     priceChange: priceChange, charges: charges)
}

@Test func SUB001_decodesTheFixtureWithServerToday() throws {
    let r = try subscriptionsFixture()
    #expect(r.today == "2026-10-18")
    #expect(r.currency == "EUR")
    #expect(r.items.count == 8)
    #expect(r.totals == SubscriptionTotals(count: 5, monthly: 101.87, yearly: 1222.44, pendingCount: 1, pendingMonthly: 35.67))
    let musica = try #require(r.items.first { $0.key == "musica" })
    #expect(musica.decision == .confermato && musica.activity == .attivo && musica.cadence == .mensile)
    #expect(musica.priceChange == SubscriptionPriceChange(from: 9.99, to: 10.99, since: "2026-07-20"))
    #expect(musica.reasons.contains(.priceChange(from: 9.99, to: 10.99, since: "2026-07-20")))
    #expect(musica.charges.count == 12)
    #expect(musica.logoPath?.hasPrefix("/api/merchant-logos/") == true)
}

@Test func SUB001_decodingIsTolerant() throws {
    let json = #"""
    {"items":[{"key":"x","id":null,"name":"X","origin":"nuovo","decision":"sospeso","activity":"boh","cadence":"bimestrale",
    "amount":"12.50","monthly":null,"lastDate":null,"nextDate":null,"overdueDays":0,"priceChange":null,"charges":[],
    "reasons":[{"kind":"altro"},{"kind":"amount","mode":"variabile-lieve"}],"confidence":null,"categoryId":null}],
    "totals":{"count":0,"monthly":"0","yearly":0,"pendingCount":0,"pendingMonthly":0},"currency":"EUR","today":"2026-10-18"}
    """#
    let r = try SubscriptionsResponse.decode(Data(json.utf8))
    let x = r.items[0]
    #expect(x.origin == .unknown && x.decision == .unknown && x.activity == .unknown && x.cadence == nil)
    #expect(x.amount == 12.5)
    #expect(x.reasons == [.unknown, .amount(constant: false)])
    #expect(italian.reason(.unknown, currency: "EUR", masked: false) == nil)
}

@Test func SUB002_SUB003_SUB004_heroSummarySentences() throws {
    let r = try subscriptionsFixture()
    let runs = italian.heroSummary(r.totals, currency: r.currency, masked: false)
    #expect(runs.map(\.text).joined() == "1222\u{00A0}€ all'anno, in 5 abbonamenti confermati. Altri 1 da confermare valgono circa 36\u{00A0}€ al mese.")
    #expect(runs.first == SubscriptionTextRun("1222\u{00A0}€", .amount))
    let one = italian.heroSummary(SubscriptionTotals(count: 1, monthly: 9.99, yearly: 119.88), currency: "EUR", masked: false)
    #expect(one.map(\.text).joined() == "120\u{00A0}€ all'anno, in 1 abbonamento confermato.")
    let none = italian.heroSummary(SubscriptionTotals(), currency: "EUR", masked: false)
    #expect(none == [SubscriptionTextRun("Conferma quelli che riconosci qui sotto e li sommiamo.")])
    let masked = italian.heroSummary(r.totals, currency: "EUR", masked: true)
    #expect(masked.first?.text == BBFormat.amountMask)
}

@Test func SUB005_nextChargeWithinThirtyDays() throws {
    let r = try subscriptionsFixture()
    let next = try #require(SubscriptionsView.nextCharge(r.items, today: r.today))
    #expect(next.item.key == "musica" && next.date == "2026-10-20")
    #expect(next.count == 5)
    #expect(abs(next.total - 101.87) < 0.001)
    let line = try #require(italian.nextChargeLine(next, today: r.today, currency: "EUR", masked: false))
    #expect(line.main == [SubscriptionTextRun("Prossimo addebito: "), SubscriptionTextRun("Musica", .strong),
                          SubscriptionTextRun(" tra 2 giorni")])
    #expect(line.window == "· nei prossimi 30 giorni 5 addebiti, 102\u{00A0}€")
    // Overdue confirmed items count; beyond 30 days or pending ones do not.
    let items = [item("late", decision: .confermato, nextDate: "2026-10-10"),
                 item("far", decision: .confermato, nextDate: "2026-11-30"),
                 item("pending", nextDate: "2026-10-19")]
    let only = try #require(SubscriptionsView.nextCharge(items, today: "2026-10-18"))
    #expect(only.item.key == "late" && only.count == 1)
    #expect(italian.nextChargeLine(only, today: "2026-10-18", currency: "EUR", masked: false)?.window == nil)
    #expect(SubscriptionsView.nextCharge([items[1], items[2]], today: "2026-10-18") == nil)
}

@Test func SUB006_relativeDates() {
    let today = "2026-10-18"
    #expect(italian.whenPhrase(today: today, date: "2026-10-18") == "oggi")
    #expect(italian.whenPhrase(today: today, date: "2026-10-19") == "domani")
    #expect(italian.whenPhrase(today: today, date: "2026-10-20") == "tra 2 giorni")
    #expect(italian.whenPhrase(today: today, date: "2026-11-01") == "tra 14 giorni")
    #expect(italian.whenPhrase(today: today, date: "2026-11-02") == "il 2 nov")
    #expect(italian.whenPhrase(today: today, date: "2026-11-08") == "l'8 nov")
    #expect(italian.whenPhrase(today: today, date: "2026-11-11") == "l'11 nov")
    #expect(italian.whenPhrase(today: today, date: "2027-10-02") == "il 2 ott 2027")
    #expect(italian.whenPhrase(today: today, date: "2026-10-10") == "il 10 ott")
    #expect(italian.fromDate("2026-07-08") == "dall'8 lug")
    let english = SubscriptionText(locale: .enGB, translate: { ["il {0}": "on {0}", "tra {0} giorni": "in {0} days"][$0] ?? $0 })
    #expect(english.whenPhrase(today: today, date: "2026-11-08") == "on 8 Nov")
    #expect(english.whenPhrase(today: today, date: "2026-10-25") == "in 7 days")
}

@Test func SUB007_emptyWhenNoItems() {
    let state = SubscriptionsUiState(phase: .loaded, response: SubscriptionsResponse(items: [], totals: SubscriptionTotals(),
                                                                                    currency: "EUR", today: "2026-10-18"))
    #expect(state.isEmpty)
    #expect(state.sections == SubscriptionSections())
}

@Test func SUB008_SUB009_SUB010_SUB012_sectionsFromFixture() throws {
    let r = try subscriptionsFixture()
    let s = SubscriptionsView.sections(r.items, today: r.today)
    #expect(s.toConfirm.map(\.key) == ["assicurazione auto"])
    #expect(s.confirmed.map(\.key) == ["musica", "archivio cloud", "palestra", "fibra e mobile", "streaming video"])
    #expect(s.stopped.map(\.key) == ["giornale"])
    #expect(s.excluded.map(\.key) == ["rata mutuo"])
    #expect(s.ended.isEmpty)
    // Terminated items only go to the archive, also when stopped.
    let t = SubscriptionsView.sections([item("a", id: "1", decision: .terminato, activity: .fermo),
                                        item("b", id: "2", decision: .escluso, activity: .fermo)], today: "2026-10-18")
    #expect(t.ended.map(\.key) == ["a"] && t.excluded.map(\.key) == ["b"] && t.stopped.isEmpty)
}

@Test func SUB011_priceRisesLastYearNotArchived() throws {
    let r = try subscriptionsFixture()
    let rises = SubscriptionsView.recentPriceRises(r.items, today: r.today)
    #expect(rises.map(\.key) == ["musica"])
    let change = try #require(rises.first?.priceChange)
    #expect(italian.priceRiseHint(change, currency: "EUR", masked: false) == "Da 9,99\u{00A0}€ a 10,99\u{00A0}€ dal 20 lug")
    #expect(italian.priceRiseDelta(change, currency: "EUR", masked: false) == "+1,00\u{00A0}€")
    let rise = SubscriptionPriceChange(from: 5, to: 6, since: "2025-10-18")
    let old = SubscriptionPriceChange(from: 5, to: 6, since: "2025-10-17")
    let drop = SubscriptionPriceChange(from: 6, to: 5, since: "2026-10-01")
    let items = [item("in", decision: .confermato, priceChange: rise), item("old", decision: .confermato, priceChange: old),
                 item("drop", priceChange: drop), item("ex", decision: .escluso, priceChange: rise),
                 item("end", decision: .terminato, priceChange: rise), item("stop", activity: .fermo, priceChange: rise)]
    #expect(SubscriptionsView.recentPriceRises(items, today: "2026-10-18").map(\.key) == ["in", "stop"])
}

@Test func SUB013_quickActionWithoutAmountOrCadenceOpensDetail() {
    let full = item("netflix", amount: 13.99)
    #expect(SubscriptionsView.quickAction(full, status: .confermato)
        == .save(SubscriptionDecisionInput(key: "netflix", status: .confermato, name: "Netflix", amount: 13.99,
                                           cadence: .mensile, categoryId: nil)))
    #expect(SubscriptionsView.quickAction(item("x", amount: nil), status: .escluso) == .openDetail)
    #expect(SubscriptionsView.quickAction(item("x", cadence: nil), status: .terminato) == .openDetail)
}

@Test func SUB014_rowHintsAndTrailingLines() throws {
    let r = try subscriptionsFixture()
    let byKey = Dictionary(uniqueKeysWithValues: r.items.map { ($0.key, $0) })
    #expect(italian.hint(byKey["musica"]!, today: r.today) == "ogni mese · prossimo tra 2 giorni")
    #expect(italian.hint(byKey["palestra"]!, today: r.today) == "ogni mese · prossimo l'8 nov")
    #expect(italian.hint(byKey["assicurazione auto"]!, today: r.today) == "ogni anno · prossimo il 2 ott 2027")
    #expect(italian.hint(byKey["giornale"]!, today: r.today) == "Ultimo addebito il 12 mag, atteso il 12 giu")
    #expect(italian.hint(byKey["rata mutuo"]!, today: r.today) == "ogni mese · ultimo addebito il 5 ott")
    #expect(italian.hint(item("o", decision: .confermato, nextDate: "2026-10-15"), today: r.today) == "ogni mese · atteso il 15 ott")
    #expect(italian.hint(item("f", activity: .fermo), today: r.today) == "ogni mese · non lo vediamo più tra i movimenti")
    #expect(italian.hint(item("u", cadence: nil), today: r.today) == "cadenza da definire")
    #expect(italian.hint(item("e", decision: .escluso, cadence: .trimestrale), today: r.today) == "ogni 3 mesi")
    // Trailing line: old price after a rise, else monthly equivalent for non-monthly cadences.
    #expect(SubscriptionsView.rise(byKey["musica"]!) != nil)
    #expect(italian.previousPrice(byKey["musica"]!.priceChange!, currency: "EUR", masked: false) == "era 9,99\u{00A0}€")
    #expect(SubscriptionsView.showsMonthlyEquivalent(byKey["assicurazione auto"]!))
    #expect(!SubscriptionsView.showsMonthlyEquivalent(byKey["palestra"]!))
    #expect(italian.monthlySuffix(35.67, currency: "EUR", masked: false) == "35,67\u{00A0}€/mese")
    #expect(SubscriptionsView.avatarSwatches.contains(SubscriptionsView.avatarSwatch("netflix")))
}

@Test func SUB014_avatarSwatchMatchesWebHash() {
    // JS: hash = (hash * 31 + charCode) >>> 0; "a" → 97 → 97 % 8 = 1 → teal; "ab" → 97*31+98 = 3105 → 1 → teal.
    #expect(SubscriptionsView.avatarSwatch("a") == "teal")
    #expect(SubscriptionsView.avatarSwatch("h") == "blue") // 104 % 8 = 0
    #expect(SubscriptionsView.avatarSwatch("netflix") == SubscriptionsView.avatarSwatch("netflix"))
}

@Test func SUB015_quickActionsDisabledWhileSaving() {
    var state = SubscriptionsUiState(phase: .loaded)
    #expect(!state.isSaving)
    state.isSaving = true
    #expect(state.isSaving)
}

@Test func SUB016_detailHistoryAndReasons() throws {
    let r = try subscriptionsFixture()
    let musica = try #require(r.items.first { $0.key == "musica" })
    let history = SubscriptionsView.history(musica)
    #expect(history.count == 12)
    #expect(history.first?.date == "2026-09-21" && history.last?.date == "2025-10-20")
    let many = item("m", charges: (1...20).map { SubscriptionCharge(id: "\($0)", date: String(format: "2025-01-%02d", $0), amount: 1) })
    #expect(SubscriptionsView.history(many).map(\.id) == (9...20).reversed().map(String.init))
    let reasons = musica.reasons.compactMap { italian.reason($0, currency: "EUR", masked: false) }
    #expect(reasons == ["12 addebiti dello stesso esercente", "Tornano ogni mese",
                        "Il prezzo è passato da 9,99\u{00A0}€ a 10,99\u{00A0}€ dal 20 lug 2026", "Sempre intorno al giorno 20 del mese"])
    #expect(italian.reason(.cadence(.annuale, skipped: true), currency: "EUR", masked: false)
        == "Tornano ogni anno (un addebito è saltato, lo abbiamo perdonato)")
    #expect(italian.reason(.amount(constant: true), currency: "EUR", masked: false) == "Importo sempre uguale")
    #expect(italian.monthlyWeight(35.67, currency: "EUR", masked: false) == "Pesa 35,67\u{00A0}€ al mese")
}

@Test func SUB017_allowedActions() {
    typealias A = SubscriptionAllowedActions
    // Pending active detected: exclude, confirm (no terminate, no removal).
    #expect(SubscriptionsView.allowedActions(item("p")) == A(removal: nil, exclude: true, terminate: false, confirm: .yes))
    // Pending stopped: terminate too.
    #expect(SubscriptionsView.allowedActions(item("p", activity: .fermo)) == A(exclude: true, terminate: true, confirm: .yes))
    // Confirmed detected with a saved choice.
    #expect(SubscriptionsView.allowedActions(item("c", id: "1", decision: .confermato))
        == A(removal: .restore, exclude: true, terminate: true, confirm: nil))
    // Excluded: put back, terminate.
    #expect(SubscriptionsView.allowedActions(item("e", id: "1", decision: .escluso))
        == A(removal: .restore, exclude: false, terminate: true, confirm: .putBack))
    // Terminated: put back, exclude.
    #expect(SubscriptionsView.allowedActions(item("t", id: "1", decision: .terminato))
        == A(removal: .restore, exclude: true, terminate: false, confirm: .putBack))
    // Manual confirmed: delete and terminate only.
    #expect(SubscriptionsView.allowedActions(item("m", id: "1", origin: .manuale, decision: .confermato))
        == A(removal: .delete, exclude: false, terminate: true, confirm: nil))
}

@Test func SUB018_patchWhenSavedElsePost() {
    #expect(SubscriptionsView.decisionRoute(item("c", id: "abc", decision: .confermato), status: .terminato)
        == .patch(id: "abc", status: .terminato))
    #expect(SubscriptionsView.decisionRoute(item("p", amount: 4.5), status: .confermato)
        == .post(SubscriptionDecisionInput(key: "p", status: .confermato, name: "P", amount: 4.5, cadence: .mensile, categoryId: nil)))
    #expect(SubscriptionsView.decisionRoute(item("p", amount: nil), status: .confermato) == .missingData)
    // Saved items PATCH even without amount/cadence.
    #expect(SubscriptionsView.decisionRoute(item("s", id: "9", cadence: nil), status: .escluso) == .patch(id: "9", status: .escluso))
}

@Test func SUB019_SUB023_formValidation() {
    #expect(SubscriptionForm.validate(name: "  ", amountText: "5", requireAmount: true) == .invalid("Dai un nome all'abbonamento"))
    #expect(SubscriptionForm.validate(name: String(repeating: "a", count: 81), amountText: "5", requireAmount: true)
        == .invalid("Il nome è troppo lungo"))
    #expect(SubscriptionForm.validate(name: " Palestra ", amountText: "", requireAmount: true)
        == .invalid("Inserisci l'importo di ogni addebito"))
    #expect(SubscriptionForm.validate(name: "Palestra", amountText: "0", requireAmount: true)
        == .invalid("Inserisci l'importo di ogni addebito"))
    #expect(SubscriptionForm.validate(name: "Palestra", amountText: "100000,01", requireAmount: true)
        == .invalid("L'importo è troppo alto"))
    #expect(SubscriptionForm.validate(name: " Palestra ", amountText: "39,90", requireAmount: true)
        == .valid(name: "Palestra", amount: 39.9))
    #expect(SubscriptionForm.validate(name: "Gym", amountText: "39.90", requireAmount: true) == .valid(name: "Gym", amount: 39.9))
    #expect(SubscriptionForm.validate(name: "Gym", amountText: "", requireAmount: false) == .valid(name: "Gym", amount: nil))
    #expect(SubscriptionForm.amountText(13.99, locale: .itIT) == "13,99")
    #expect(SubscriptionForm.amountText(428, locale: .enGB) == "428.00")
    #expect(SubscriptionForm.clampName(String(repeating: "b", count: 90)).count == 80)
}

@Test func SUB019_patchBodyOmitsUnsetAndClearsCategory() throws {
    let edit = SubscriptionPatch(name: "Gym", amount: 40, cadence: .trimestrale, nextDate: "2026-11-01", categoryId: .some(nil))
    let body = try #require(String(data: try SubscriptionsAPI.body(edit.json), encoding: .utf8))
    #expect(body == #"{"amount":40,"cadence":"trimestrale","categoryId":null,"name":"Gym","nextDate":"2026-11-01"}"#)
    let status = try #require(String(data: try SubscriptionsAPI.body(SubscriptionPatch(status: .escluso).json), encoding: .utf8))
    #expect(status == #"{"status":"escluso"}"#)
}

@Test func SUB020_SUB021_pendingRemovalPreview() throws {
    let r = try subscriptionsFixture()
    let musica = try #require(r.items.first { $0.key == "musica" })
    var state = SubscriptionsUiState(phase: .loaded, response: r)
    state.pendingRemovals = [musica.id!]
    // Detected: back to «da confermare» without the saved id; totals follow.
    let restored = try #require(state.item(key: "musica"))
    #expect(restored.decision == .daConfermare && restored.id == nil)
    #expect(state.sections.toConfirm.map(\.key) == ["musica", "assicurazione auto"])
    #expect(state.totals.count == 4 && state.totals.pendingCount == 2)
    #expect(abs(state.totals.monthly - 90.88) < 0.001)
    // Manual: hidden.
    let manual = item("gym", id: "m1", origin: .manuale, decision: .confermato)
    #expect(SubscriptionsView.applyingRemovals([manual], removedIds: ["m1"]).isEmpty)
}

@Test func SUB023_manualAndDecisionBodies() throws {
    let manual = ManualSubscriptionInput(name: "Palestra", amount: 39.9, cadence: .mensile, nextDate: "2026-10-18", categoryId: nil)
    let body = try #require(String(data: try SubscriptionsAPI.body(manual.json), encoding: .utf8))
    #expect(body == #"{"amount":39.9,"cadence":"mensile","categoryId":null,"name":"Palestra","nextDate":"2026-10-18","origin":"manuale"}"#)
    let decision = SubscriptionDecisionInput(key: "musica", status: .confermato, name: "Musica", amount: 10.99, cadence: .mensile,
                                             categoryId: "c1")
    let d = try #require(String(data: try SubscriptionsAPI.body(decision.json), encoding: .utf8))
    #expect(d == #"{"amount":10.99,"cadence":"mensile","categoryId":"c1","key":"musica","name":"Musica","origin":"rilevato","status":"confermato"}"#)
    #expect(italian.cadenceOption(.mensile) == "Ogni mese")
    #expect(SubscriptionCadence.allCases.map { italian.cadenceLabel($0) }
        == ["ogni settimana", "ogni mese", "ogni 3 mesi", "ogni 6 mesi", "ogni anno"])
}

@Test func SUB024_duplicateNameShowsServerMessage() async throws {
    let transport = StubTransport(status: 409, body: #"{"error":"Hai già un abbonamento con questo nome","code":"subscription_exists"}"#)
    let api = SubscriptionsAPI(client: makeClient(transport))
    do {
        try await api.addManual(ManualSubscriptionInput(name: "Palestra", amount: 39, cadence: .mensile, nextDate: "2026-10-18",
                                                        categoryId: nil))
        Issue.record("expected 409")
    } catch let error as APIError {
        #expect(error.status == 409)
        #expect(error.body?.message == "Hai già un abbonamento con questo nome")
    }
    #expect(transport.last?.httpMethod == "POST" && transport.last?.url?.path == "/api/subscriptions")
}

@Test func SUB025_categoryPickerExcludesIncomeAndTransfers() async throws {
    let transport = StubTransport(status: 200, body: String(decoding: try fixture("categories.json"), as: UTF8.self))
    let categories = try await SubscriptionsAPI(client: makeClient(transport)).expenseCategories()
    #expect(!categories.isEmpty)
    #expect(categories.allSatisfy { $0.type != "entrata" && $0.type != "trasferimento" })
    #expect(transport.last?.url?.path == "/api/categories")
}

@Test func SUB026_manualItemsAreConfirmedAndActive() {
    let manual = item("gym", id: "m1", origin: .manuale, decision: .confermato, activity: .attivo, nextDate: "2026-11-01")
    let s = SubscriptionsView.sections([manual], today: "2026-10-18")
    #expect(s.confirmed.map(\.key) == ["gym"])
    #expect(SubscriptionsView.totals([manual]).count == 1)
}

@Test func SUB_apiPathsAndMethods() async throws {
    let transport = StubTransport(status: 200, body: "{}")
    let api = SubscriptionsAPI(client: makeClient(transport))
    try await api.update(id: "abc", SubscriptionPatch(status: .confermato))
    #expect(transport.last?.httpMethod == "PATCH" && transport.last?.url?.path == "/api/subscriptions/abc")
    try await api.delete(id: "abc")
    #expect(transport.last?.httpMethod == "DELETE" && transport.last?.url?.path == "/api/subscriptions/abc")
}
