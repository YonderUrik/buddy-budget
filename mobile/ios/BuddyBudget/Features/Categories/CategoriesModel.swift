import BuddyBudgetKit
import Foundation
import Observation

/// State of «Categorie e regole» (CAT-001…035). Same fields as `CategoriesModel` on Android.
@MainActor @Observable
final class CategoriesModel {
    private(set) var categories: Loadable<[MovementCategory]> = .loading
    private(set) var usage: [String: Int] = [:]
    private(set) var rules: Loadable<[CategorizationRule]> = .loading
    /// CAT-099…101: monthly budget per category id (only categories that have one).
    private(set) var budgets: [String: Double] = [:]
    /// Categories with a save in flight (tile dimmed, CAT-010).
    private(set) var pending: Set<String> = []
    var remoteLogoShown = false

    @ObservationIgnored let env: AppEnvironment
    /// Called after any change so Movimenti refreshes (CAT-023).
    @ObservationIgnored var onChanged: (() async -> Void)?

    init(env: AppEnvironment) {
        self.env = env
    }

    var list: [MovementCategory] { categories.value ?? [] }
    func category(_ id: String?) -> MovementCategory? { list.first { $0.id == id } }

    func load() async {
        async let c: Void = loadCategories()
        async let r: Void = loadRules()
        _ = await (c, r)
    }

    func loadCategories() async {
        do {
            async let list = env.categoriesAPI.list()
            async let use = env.categoriesAPI.usage()
            async let rows = try? env.budgets.list()
            let (l, u) = try await (list, use)
            usage = u
            if let rows = await rows {
                budgets = Dictionary(rows.filter { $0.monthlyAmount > 0 }.map { ($0.categoryId, $0.monthlyAmount) }, uniquingKeysWith: { a, _ in a })
            }
            categories = .loaded(l)
        } catch {
            if categories.value == nil { categories = .failed }
        }
    }

    /// CAT-099/100: saves or removes the monthly budget; returns the error to show (the caller restores the field), or nil
    /// on success.
    func saveBudget(_ category: MovementCategory, _ outcome: CategoryBudgetField.Outcome) async -> String? {
        switch outcome {
        case .unchanged:
            return nil
        case .invalid:
            return L10n.lookup(italian: "Scrivi un importo, per esempio 300.")
        case .remove:
            do {
                try await env.budgets.remove(categoryId: category.id)
                budgets[category.id] = nil
                await onChanged?()
                return nil
            } catch {
                return L10n.lookup(italian: "Non è stato possibile togliere il budget, riprova.")
            }
        case .save(let amount):
            do {
                let saved = try await env.budgets.upsert(categoryId: category.id, monthlyAmount: amount)
                budgets[category.id] = saved.monthlyAmount > 0 ? saved.monthlyAmount : nil
                await onChanged?()
                return nil
            } catch {
                return L10n.lookup(italian: "Non è stato possibile salvare il budget, riprova.")
            }
        }
    }

    func loadRules() async {
        do {
            rules = .loaded(try await env.rulesAPI.list())
        } catch {
            if rules.value == nil { rules = .failed }
        }
    }

    private func replace(_ category: MovementCategory) {
        guard case .loaded(var items) = categories, let i = items.firstIndex(where: { $0.id == category.id }) else { return }
        items[i] = category
        categories = .loaded(items)
    }

    private func changed() {
        Task { await onChanged?() }
    }

    // MARK: Categories

    /// CAT-011: returns the server message on failure (e.g. «Categoria già esistente»).
    func create(name: String, type: CategoryType) async -> String? {
        let trimmed = JSNumber.trim(name)
        guard !trimmed.isEmpty else { return nil }
        do {
            let created = try await env.categoriesAPI.create(CategoryCreateBody(name: trimmed, type: type))
            categories = .loaded(list + [created])
            changed()
            return nil
        } catch {
            return (error as? APIError)?.body?.message ?? L10n.genericError
        }
    }

    /// CAT-010/015/017…019: one field at a time; returns the server message on failure (the caller reverts).
    @discardableResult
    func update(_ category: MovementCategory, _ patch: CategoryPatch) async -> String? {
        pending.insert(category.id)
        defer { pending.remove(category.id) }
        do {
            let updated = try await env.categoriesAPI.update(id: category.id, patch)
            // The PATCH answer carries the stored (not localized) name: keep the shown one unless it was renamed.
            replace(patch.name == nil ? updated.with(name: category.name) : updated)
            changed()
            return nil
        } catch {
            return (error as? APIError)?.body?.message ?? L10n.genericError
        }
    }

    /// CAT-021.
    func delete(_ category: MovementCategory) async -> Bool {
        do {
            try await env.categoriesAPI.delete(id: category.id)
            categories = .loaded(list.filter { $0.id != category.id })
            changed()
            return true
        } catch {
            return false
        }
    }

    /// CAT-012.
    func distributeColors() async -> Bool {
        do {
            try await env.categoriesAPI.distributeColors()
            await loadCategories()
            changed()
            return true
        } catch {
            return false
        }
    }

    // MARK: Rules

    /// CAT-030: returns the server message on failure.
    func createRule(pattern: String, matchType: RuleMatchType, categoryId: String) async -> String? {
        do {
            let result = try await env.rulesAPI.create(RuleCreateBody(matchType: matchType, pattern: JSNumber.trim(pattern), categoryId: categoryId))
            await loadRules()
            feedback(result)
            return nil
        } catch {
            return (error as? APIError)?.body?.message ?? L10n.genericError
        }
    }

    /// CAT-027.
    func updateRule(_ rule: CategorizationRule, _ patch: RulePatch) async -> String? {
        do {
            let result = try await env.rulesAPI.update(id: rule.id, patch)
            await loadRules()
            feedback(result)
            return nil
        } catch {
            return (error as? APIError)?.body?.message ?? L10n.genericError
        }
    }

    /// CAT-029 (after the confirmation).
    func deleteRule(_ rule: CategorizationRule) async {
        do {
            try await env.rulesAPI.delete(id: rule.id)
            if case .loaded(let items) = rules { rules = .loaded(items.filter { $0.id != rule.id }) }
        } catch {
            env.toasts.show(.error, L10n.deletionFailedTryAgain)
        }
    }

    /// CAT-034/035.
    private func feedback(_ result: RuleSaveResult) {
        if result.applied > 0 {
            env.toasts.show(.success, result.applied == 1 ? L10n.ruleAppliedImmediatelyToOneUncatego
                : L10n.ruleAppliedImmediatelyTo0Uncategori(String(result.applied)))
            changed()
        }
        RuleFeedback.offerPastMatches(result, env: env) { [weak self] in await self?.onChanged?() }
    }
}
