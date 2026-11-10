import Foundation

/// Field of the add-transaction form that can carry an error (TX-045).
public enum AddTransactionField: String, Sendable {
    case amount, description, category, account, date
}

/// «Nuovo movimento» (TX-042…046), ported from `components/domain/expenses/add-transaction-form.tsx`.
/// Error values are Italian catalog keys. Same type on Android.
public struct AddTransactionForm: Equatable, Sendable {
    public var step = 0
    public var isIncome = false {
        didSet { if oldValue != isIncome { categoryOverride = nil } }
    }
    public var amountText = ""
    public var description = ""
    /// nil = the default (most used eligible category) until the user chooses.
    public var categoryOverride: String?
    public var date: CalendarDate
    /// nil = the first manual account.
    public var accountOverride: String?
    public var errors: [AddTransactionField: String] = [:]
    /// Movements added with «Aggiungi e inserisci un altro» in this session (TX-046).
    public var added = 0

    public init(today: CalendarDate) {
        date = today
    }

    public var amount: Double? { BBFormat.parseAmount(amountText) }

    public func availableCategories(_ categories: [MovementCategory]) -> [MovementCategory] {
        CategoryRules.addFormCategories(categories, isIncome: isIncome)
    }

    public func categoryId(_ categories: [MovementCategory], usage: [String: Int]) -> String? {
        categoryOverride ?? CategoryRules.pickDefaultCategoryId(availableCategories(categories), usage: usage)
    }

    public func accountId(_ accounts: [Account]) -> String? {
        accountOverride ?? accounts.first(where: \.isManual)?.id
    }

    /// Checks the fields of `step` and stores the errors; true when valid.
    public mutating func validate(step: Int, categories: [MovementCategory], usage: [String: Int], accounts: [Account]) -> Bool {
        var next: [AddTransactionField: String] = [:]
        if step == 0, !((amount ?? 0) > 0) { next[.amount] = "Scrivi un importo maggiore di zero." }
        if step == 1 {
            if JSNumber.trim(description).isEmpty { next[.description] = "Scrivi una breve descrizione, per ritrovarlo nell'elenco." }
            if categoryId(categories, usage: usage) == nil { next[.category] = "Scegli una categoria." }
            if accountId(accounts) == nil { next[.account] = "Serve un conto manuale su cui registrare il movimento." }
        }
        errors = next
        return next.isEmpty
    }

    /// Step 1 → 2 (`Continua`).
    public mutating func next(categories: [MovementCategory], usage: [String: Int], accounts: [Account]) -> Bool {
        guard validate(step: step, categories: categories, usage: usage, accounts: accounts) else { return false }
        step = 1
        return true
    }

    public mutating func back() {
        errors = [:]
        step = 0
    }

    /// The request body when step 2 validates; nil otherwise (errors set).
    public mutating func body(categories: [MovementCategory], usage: [String: Int], accounts: [Account]) -> CreateTransactionBody? {
        guard validate(step: 1, categories: categories, usage: usage, accounts: accounts), let amount, amount > 0,
              let categoryId = categoryId(categories, usage: usage), let accountId = accountId(accounts) else { return nil }
        return CreateTransactionBody(accountId: accountId, description: JSNumber.trim(description), categoryId: categoryId,
                                     amount: amount, direction: isIncome ? "entrata" : "uscita", date: date.iso)
    }

    /// After a successful «Aggiungi e inserisci un altro»: keep date, account and direction; clear the rest and go
    /// back to step 1 (TX-046).
    public mutating func didAddAndContinue() {
        description = ""
        amountText = ""
        categoryOverride = nil
        errors = [:]
        added += 1
        step = 0
    }
}

/// Amount ↔ text for amount fields (decimal keypad, locale separator, no grouping).
public enum AmountInputText {
    /// 1250.5 → "1250,5" (it/de) or "1250.5" (en); integers have no decimals.
    public static func input(_ value: Double, locale: BBLocale) -> String {
        let rounded = JSNumber.round2(abs(value))
        var text = String(format: "%.2f", rounded)
        if text.hasSuffix(".00") { text.removeLast(3) } else if text.hasSuffix("0"), text.contains(".") { text.removeLast() }
        return locale == .enGB ? text : text.replacingOccurrences(of: ".", with: ",")
    }
}

/// Split («Dividi») sheet state (TX-034…036) on top of `SplitShare`.
public struct SplitForm: Equatable, Sendable {
    /// |amount| of the movement.
    public let total: Double
    public private(set) var ownShare: Double

    public init(movement: Movement) {
        total = abs(movement.amount)
        ownShare = SplitShare.clampOwnShare(abs(movement.amount) - abs(movement.excludedAmount), total: abs(movement.amount))
    }

    public var excluded: Double { SplitShare.excludedFromOwnShare(total: total, ownShare: ownShare) }
    public var matchingPreset: SplitPreset? { SplitShare.matchPreset(total: total, ownShare: ownShare) }

    public mutating func applyPreset(_ preset: SplitPreset) {
        ownShare = SplitShare.ownShareForPreset(total: total, parts: preset.parts)
    }

    /// Slider or committed field value; non-numeric text → the full amount.
    public mutating func setOwnShare(_ value: Double) {
        ownShare = SplitShare.clampOwnShare(value, total: total)
    }

    public mutating func setOwnShare(text: String) {
        setOwnShare(BBFormat.parseAmount(text) ?? .nan)
    }
}

/// The edit sheet of a manual movement (TX-039): only changed, non-empty, valid fields are sent.
public enum MovementEdit {
    public static func patch(_ movement: Movement, description: String, date: CalendarDate, amountText: String) -> TransactionPatch? {
        var patch = TransactionPatch()
        let trimmed = JSNumber.trim(description)
        if !trimmed.isEmpty, trimmed != movement.description { patch.description = trimmed }
        if date.iso != movement.date { patch.date = date.iso }
        if let amount = BBFormat.parseAmount(amountText), amount > 0, JSNumber.round2(amount) != JSNumber.round2(abs(movement.amount)) {
            patch.amount = amount
        }
        return patch == TransactionPatch() ? nil : patch
    }

    /// TX-038: the note to send when the editor closes; nil = unchanged. Empty → "" (removes it). Max 500.
    public static func notePatch(_ movement: Movement, text: String) -> String? {
        let trimmed = String(JSNumber.trim(text).prefix(500))
        let current = movement.note ?? ""
        return trimmed == current ? nil : trimmed
    }
}

/// Server sentences (voice, Analisi lead) carry formatted amounts: in privacy mode every number is masked.
public enum VoiceText {
    public static func masked(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "[0-9](?:[0-9.,\\u00A0\\u202F]*[0-9])?") else { return text }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, range: range, withTemplate: BBFormat.amountMask)
    }
}

/// «Budget al mese (facoltativo)» of a category (CAT-099…101, web #432 `category-budget-field.tsx`): what leaving the
/// field does and the text it shows. Same names on Android (`CategoryBudgetField`).
public enum CategoryBudgetField {
    public enum Outcome: Equatable, Sendable {
        /// Nothing to send (empty with no budget, or the same amount).
        case unchanged
        /// Emptied: `DELETE /api/budgets/{categoryId}`.
        case remove
        /// Not a number or negative: `Scrivi un importo, per esempio 300.`
        case invalid
        /// `PUT /api/budgets/{categoryId}` with the amount rounded to cents.
        case save(Double)
    }

    /// Only expense groups have a budget (not income, transfers or the fallback).
    public static func appliesTo(type: CategoryType, isFallback: Bool) -> Bool { !isFallback && type.isExpenseGroup }

    /// `parseLocaleNumber`: «1.250,50» (it/de) or «1,250.50» (en); nil when not a number.
    public static func parse(_ text: String, locale: BBLocale) -> Double? {
        let trimmed = JSNumber.trim(text).replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\u{00A0}", with: "")
        if trimmed.isEmpty { return nil }
        let normalized = locale == .enGB ? trimmed.replacingOccurrences(of: ",", with: "")
            : trimmed.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        guard let value = JSNumber.parse(normalized), value.isFinite else { return nil }
        return value
    }

    public static func commit(_ text: String, saved: Double?, locale: BBLocale) -> Outcome {
        if JSNumber.trim(text).isEmpty { return saved == nil ? .unchanged : .remove }
        guard let value = parse(text, locale: locale), value >= 0 else { return .invalid }
        let rounded = JSNumber.round2(value)
        return rounded == saved ? .unchanged : .save(rounded)
    }

    /// The amount as the user would type it (no grouping, at most two decimals); empty without a budget.
    public static func inputText(_ amount: Double?, locale: BBLocale) -> String {
        amount.map { AmountInputText.input($0, locale: locale) } ?? ""
    }
}
