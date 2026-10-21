import BuddyBudgetKit
import SwiftUI

enum CategoriesTab: Hashable { case categories, rules }

/// «Categorie e regole» (CAT-005…035), phone layout of the mobile notes: Categorie | Regole switch, the board as a
/// vertical list of section cards with wrapping tiles, the category detail and rule editor as sheets.
/// Android: CategoriesScreen.kt.
struct CategoriesScreen: View {
    var initialTab: CategoriesTab = .categories

    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back
    @State private var model: CategoriesModel?
    @State private var tab: CategoriesTab?
    @State private var newRule = false

    var body: some View {
        let current = tab ?? initialTab
        // Web: «Categorie e regole» is a Liquidità view, so the heading is the Liquidità views sheet with the yellow add
        // button; Categorie | Regole is an inline segmented control under it.
        BBScreen(title: nil, onBack: back, onRefresh: { await model?.load() }) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                SectionViewsHeading(sectionTitle: L10n.cash_84f6d5, items: LiquiditySegment.allCases.map { view in
                    SectionViewItem(id: view.rawValue, label: L10n.lookup(italian: view.title),
                                    description: L10n.lookup(italian: view.viewDescription), icon: BBIcon.forKey(view.iconKey)) {
                        shell.open(view.destination)
                    }
                } + [SectionViewItem(id: "categorie", label: L10n.categoriesAndRules,
                                     description: L10n.lookup(italian: "Gruppi di spesa e regole automatiche"), icon: .tags, isActive: true) {}]) {
                    LiquidityTopActions(model: shell.liquidity)
                }
                .padding(.top, BBSpacing.space4)
                SegmentedControl(options: [(CategoriesTab.categories, L10n.categories_790d98), (CategoriesTab.rules, L10n.rules)],
                                 selection: Binding(get: { current }, set: { tab = $0 }))
                if let model {
                    if current == .categories {
                        CategoryBoardView(model: model)
                    } else {
                        RulesView(model: model, newRule: $newRule)
                    }
                }
            }
        }
        .task {
            if model == nil {
                let m = CategoriesModel(env: env)
                m.onChanged = { [weak shell] in
                    guard let shell else { return }
                    await shell.liquidity.refresh()
                }
                model = m
            }
            await model?.load()
        }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model?.load() } }
    }
}

// MARK: - Board

private struct CategoryBoardView: View {
    let model: CategoriesModel
    @State private var detail: MovementCategory?
    @State private var confirmColors = false

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(L10n.yourCategories, style: .sectionHeading)
                BBText(L10n.tapACategoryToEditItOrMoveItTo, style: BBTypography.body, color: .bbMutedForeground)
            }
            BBButton(L10n.assignColours, icon: .palette, variant: .outline, size: .sm) { confirmColors = true }
            switch model.categories {
            case .loading:
                VStack(spacing: BBSpacing.space3) { ForEach(0..<3, id: \.self) { _ in BBSkeleton(height: 140, radius: BBRadius.xl) } }
            case .failed:
                LoadError(message: L10n.unableToLoadCategories) { Task { await model.loadCategories() } }
            case .loaded(let categories):
                ForEach(CategoryBoard.sections(categories)) { section in
                    SectionCard(model: model, section: section) { detail = $0 }
                }
            }
        }
        .bbSheet(isPresented: Binding(get: { detail != nil }, set: { if !$0 { detail = nil } })) {
            if let category = detail {
                CategoryDetailSheet(model: model, categoryId: category.id) { detail = nil }
            }
        }
        .bbAlertSheet(isPresented: $confirmColors, title: L10n.assignColoursAutomatically, description: L10n.eachCategoryExceptUncategorisedWill,
                      confirmLabel: L10n.distribute, confirmVariant: .default, icon: .palette) {
            Task {
                if !(await model.distributeColors()) { model.env.toasts.show(.error, L10n.colourAssignmentFailedTryAgain) }
            }
        }
    }
}

/// Title, color and description of a board section (CAT-006).
enum BoardSectionText {
    static func title(_ key: String) -> String {
        switch key {
        case "entrata": L10n.income_5a21be
        case "trasferimento": L10n.transfersBetweenAccounts
        case "fallback": L10n.toCategorise_f267aa
        default: L10n.lookup(italian: CategoryType(rawValue: key)?.label ?? key)
        }
    }

    static func description(_ key: String) -> String {
        switch key {
        case "entrata": L10n.salaryRefundsAndAllOtherIncome
        case "trasferimento": L10n.transfersBetweenYourAccountsDoNotC
        case "fallback": L10n.transactionsWithoutACategoryReviewT
        default: CategoryType(rawValue: key)?.groupDescription.map { L10n.lookup(italian: $0) } ?? ""
        }
    }
}

private struct SectionCard: View {
    let model: CategoriesModel
    let section: CategoryBoardSection
    let onOpen: (MovementCategory) -> Void

    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    @State private var adding = false
    @State private var name = ""
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        // Web `CategoryGroupColumn`: a soft `--muted @ 40%` panel, header, then the categories as wrapping chips.
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                HStack(spacing: BBSpacing.space2) {
                    Circle().fill(Color.bbGroup(section.key)).frame(width: 10, height: 10)
                    BBText(BoardSectionText.title(section.key), style: BBTypography.cardTitle)
                    BBText(String(section.categories.count), style: BBTypography.caption, color: .bbText3)
                    Spacer(minLength: 0)
                }
                BBText(BoardSectionText.description(section.key), style: BBTypography.caption, color: .bbMutedForeground)
            }
            FlowLayout(spacing: BBSpacing.space2) {
                ForEach(section.categories) { category in
                    Button { onOpen(category) } label: {
                        HStack(spacing: BBSpacing.space2) {
                            CategoryAvatar(category: category, diameter: 28)
                            BBText(category.name, style: BBTypography.body.with(weight: 500), lineLimit: 1)
                            // CAT-101: the monthly budget, when set.
                            if let budget = model.budgets[category.id] {
                                BBText(L10n.s0Month_b9ba41(BBFormat.formatCurrency(budget, currency: model.env.session.currency, locale: locale,
                                                                                   maximumFractionDigits: 0, masked: hideAmounts)),
                                       style: BBTypography.caption, color: .bbText2).monospacedDigit().fixedSize()
                            }
                            if let count = model.usage[category.id], count > 0 {
                                BBText(String(count), style: BBTypography.caption, color: .bbText3).monospacedDigit().fixedSize()
                            }
                        }
                        .padding(.leading, BBSpacing.space1)
                        .padding(.trailing, BBSpacing.space3)
                        .padding(.vertical, BBSpacing.space1)
                        .frame(minHeight: 40)
                        .background(Capsule().fill(Color.bbCard))
                        .overlay(Capsule().strokeBorder(Color.bbBorder, lineWidth: 1))
                        .contentShape(Capsule())
                        .opacity(model.pending.contains(category.id) ? 0.5 : 1)
                    }
                    .buttonStyle(BBPressableStyle(translate: false))
                    .accessibilityLabel(L10n.lookup(italian: "Modifica {0}", ["0": category.name]))
                }
                if let _ = section.addType, !adding {
                    Button {
                        adding = true
                        error = nil
                    } label: {
                        HStack(spacing: BBSpacing.space1_5) {
                            BBIconView(.plus, points: 14, color: .bbMutedForeground)
                            BBText(L10n.add, style: BBTypography.body, color: .bbMutedForeground)
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(minHeight: 40)
                        .overlay(Capsule().strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(BBPressableStyle(translate: false))
                }
            }
            if let type = section.addType, adding {
                BBTextField(text: $name, placeholder: L10n.nameThenEnter, error: error, height: 44, submitLabel: .done,
                            onSubmit: { submit(type) }, autofocus: true)
            }
        }
        .padding(BBSpacing.space4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbMuted.opacity(0.4)))
    }

    private func submit(_ type: CategoryType) {
        guard !JSNumber.trim(name).isEmpty else {
            adding = false
            return
        }
        Task {
            let result = await model.create(name: name, type: type)
            if let result {
                error = result
            } else {
                name = ""
                adding = false
            }
        }
    }
}

// MARK: - Category detail (CAT-014…022)

private struct CategoryDetailSheet: View {
    let model: CategoriesModel
    let categoryId: String
    let onClose: () -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var nameError: String?
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteFailed = false
    @State private var loaded = false

    private let swatchColumns = Array(repeating: GridItem(.flexible(), spacing: BBSpacing.space2), count: 8)

    var body: some View {
        if let category = model.category(categoryId) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                HStack(spacing: BBSpacing.space3) {
                    CategoryAvatar(category: category, diameter: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        BBText(category.name, style: BBTypography.cardTitle, lineLimit: 2)
                        let count = model.usage[category.id] ?? 0
                        BBText(count > 0 ? L10n.s0TransactionsInTheLastYear_5fe23f(String(count)) : L10n.noTransactionsInTheLastYear,
                               style: BBTypography.caption, color: .bbText2)
                    }
                }
                BBTextField(label: L10n.name_13030d, text: $name, error: nameError, isDisabled: category.isFallback, height: 44,
                            onSubmit: { saveName(category) })
                if !category.isFallback {
                    VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                        BBTextField(label: L10n.whatBelongsHereOptional, text: $description, placeholder: L10n.eGSupermarketGroceries,
                                    height: 44, onSubmit: { saveDescription(category) })
                            .onChange(of: description) { _, new in if new.count > 120 { description = String(new.prefix(120)) } }
                        BBText(L10n.helpTheAssistantSuggestThisCategory, style: BBTypography.caption, color: .bbText3)
                    }
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        BBText(L10n.group_6f8314, style: BBTypography.bodyStrong)
                        FlowChips(items: CategoryType.selectable, selected: category.type,
                                  label: { L10n.lookup(italian: $0.label) }) { type in
                            Task { await model.update(category, CategoryPatch(type: type)) }
                        }
                    }
                    if CategoryBudgetField.appliesTo(type: category.type, isFallback: category.isFallback) {
                        CategoryBudgetFieldView(model: model, category: category).id(category.id)
                    }
                }
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.colour, style: BBTypography.bodyStrong)
                    LazyVGrid(columns: swatchColumns, spacing: BBSpacing.space2) {
                        ForEach(BBSwatch.pickerKeys, id: \.self) { key in
                            Button { Task { await model.update(category, CategoryPatch(color: key)) } } label: {
                                Circle().fill(Color.bbSwatch(key)).frame(width: 28, height: 28)
                                    .overlay(Circle().stroke(Color.bbForeground, lineWidth: category.color == key ? 2 : 0).padding(-3))
                                    .bbHitArea(height: 28, width: 28)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(key)
                            .accessibilityAddTraits(category.color == key ? .isSelected : [])
                        }
                    }
                }
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.icon, style: BBTypography.bodyStrong)
                    LazyVGrid(columns: swatchColumns, spacing: BBSpacing.space2) {
                        ForEach(BBIcon.categoryKeys, id: \.self) { key in
                            let selected = category.icon == key
                            Button { Task { await model.update(category, CategoryPatch(icon: key)) } } label: {
                                BBIconView(BBIcon.category(key), size: .lg, color: selected ? .bbSwatch(category.color) : .bbText2)
                                    .frame(width: 36, height: 36)
                                    .background(RoundedRectangle.bb(BBRadius.md).fill(selected ? Color.bbSwatch(category.color).opacity(0.16) : .clear))
                                    .overlay(RoundedRectangle.bb(BBRadius.md).strokeBorder(selected ? Color.bbSwatch(category.color) : .clear, lineWidth: 1.5))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(key)
                        }
                    }
                }
                if !category.isFallback {
                    if confirmDelete {
                        VStack(alignment: .leading, spacing: BBSpacing.space2) {
                            BBText(L10n.linkedTransactionsBecomeUncategorised, style: BBTypography.body, color: .bbText2)
                            if deleteFailed { BBText(L10n.deletionFailedTryAgain, style: BBTypography.body, color: .bbDestructive) }
                            HStack(spacing: BBSpacing.space2) {
                                BBButton(L10n.cancel_6c3de5, variant: .outline, size: .touch, fullWidth: true) { confirmDelete = false }
                                BBButton(deleting ? L10n.deleting_159671 : L10n.deleteCategory, variant: .destructive, size: .touch,
                                         fullWidth: true, isLoading: deleting) {
                                    deleting = true
                                    deleteFailed = false
                                    Task {
                                        let ok = await model.delete(category)
                                        deleting = false
                                        if ok { onClose() } else { deleteFailed = true }
                                    }
                                }
                            }
                        }
                    } else {
                        BBButton(L10n.deleteCategory, icon: .trash2, variant: .destructive, size: .touch, fullWidth: true) { confirmDelete = true }
                    }
                }
                BBButton(L10n.done_33cad7, variant: .outline, size: .touch, fullWidth: true) {
                    saveName(category)
                    saveDescription(category)
                    onClose()
                }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                name = category.name
                description = category.description ?? ""
            }
        }
    }

    private func saveName(_ category: MovementCategory) {
        let trimmed = JSNumber.trim(name)
        guard !category.isFallback, !trimmed.isEmpty, trimmed != category.name else {
            name = category.name
            return
        }
        nameError = nil
        Task {
            if let error = await model.update(category, CategoryPatch(name: trimmed)) {
                nameError = error
                name = category.name
            }
        }
    }

    private func saveDescription(_ category: MovementCategory) {
        let trimmed = JSNumber.trim(description)
        guard !category.isFallback, trimmed != (category.description ?? "") else { return }
        Task { await model.update(category, CategoryPatch(description: trimmed)) }
    }
}

/// Wrapping single-choice chips (group selector).
struct FlowChips<Item: Hashable>: View {
    let items: [Item]
    let selected: Item?
    let label: (Item) -> String
    let onSelect: (Item) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: BBSpacing.space2), GridItem(.flexible(), spacing: BBSpacing.space2)],
                  alignment: .leading, spacing: BBSpacing.space2) {
            ForEach(items, id: \.self) { item in
                BBChip(label: label(item), isSelected: item == selected) { onSelect(item) }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Rules (CAT-025…035)

private struct RulesView: View {
    let model: CategoriesModel
    @Binding var newRule: Bool
    @State private var editing: CategorizationRule?
    @State private var deleting: CategorizationRule?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(L10n.automaticRules, style: .sectionHeading)
                BBText(L10n.rulesAutomaticallyAssignCategoriesTo, style: BBTypography.body, color: .bbMutedForeground)
            }
            BBCard(size: .sm) {
                BBCardHeader(title: L10n.categorisationRules, description: L10n.rulesApplyAutomaticallyToNewTransac_8cf2be, size: .sm)
                BBButton(L10n.addRule, icon: .plus, size: .sm) { newRule = true }
            }
            switch model.rules {
            case .loading:
                BBSkeletonRows(rows: 4)
            case .failed:
                LoadError(message: L10n.couldNotLoadRules) { Task { await model.loadRules() } }
            case .loaded(let rules):
                if rules.isEmpty {
                    BBText(L10n.noRulesYetCreateRulesWhenCategoris, style: BBTypography.body, color: .bbMutedForeground)
                } else {
                    VStack(spacing: 0) {
                        ForEach(rules.sorted { $0.hitCount > $1.hitCount }) { rule in
                            BBSwipeToDelete(onDelete: { deleting = rule }) {
                                RuleRow(model: model, rule: rule) { editing = rule }
                            }
                        }
                    }
                    if model.remoteLogoShown { LogoCredit() }
                }
            }
        }
        .bbSheet(isPresented: Binding(get: { editing != nil || newRule }, set: { if !$0 { editing = nil; newRule = false } }),
                 title: editing == nil ? L10n.newRule : L10n.editRule) {
            RuleSheet(model: model, rule: editing, onDelete: { rule in
                editing = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.05) { deleting = rule }
            }) {
                editing = nil
                newRule = false
            }
        }
        .bbAlertSheet(isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), title: L10n.deleteThisRule,
                      description: L10n.thePattern0WillNoLongerBeApplied(deleting?.pattern ?? ""), confirmLabel: L10n.delete_6b177b,
                      icon: .trash2) {
            if let rule = deleting { Task { await model.deleteRule(rule) } }
        }
    }
}

private struct RuleRow: View {
    let model: CategoriesModel
    let rule: CategorizationRule
    let onTap: () -> Void

    var body: some View {
        let category = model.category(rule.categoryId)
        BBListRow(title: rule.pattern,
                  subtitle: "\(L10n.lookup(italian: rule.matchType.label)) · \(rule.categoryName ?? category?.name ?? "")",
                  onClick: onTap) {
            if let logoPath = rule.logoPath {
                MerchantLogo(name: rule.pattern, logoPath: logoPath, onRemoteLogo: { model.remoteLogoShown = true })
            } else {
                CategoryAvatar(category: category)
            }
        } trailing: {
            VStack(alignment: .trailing, spacing: BBSpacing.space1) {
                BBBadge(rule.isLearned ? L10n.learned : L10n.manual_58ab84, variant: .outline)
                BBText(L10n.used0Times(String(rule.hitCount)), style: BBTypography.caption, color: .bbText3)
            }
        }
    }
}

/// New rule (CAT-030) or edit (CAT-027): pattern, type, category; save; delete for an existing rule.
private struct RuleSheet: View {
    let model: CategoriesModel
    let rule: CategorizationRule?
    let onDelete: (CategorizationRule) -> Void
    let onClose: () -> Void

    @State private var pattern = ""
    @State private var matchType: RuleMatchType = .contains
    @State private var categoryId: String?
    @State private var picking = false
    @State private var saving = false
    @State private var patternError: String?
    @State private var categoryError: String?
    @State private var formError: String?
    @State private var loaded = false

    var body: some View {
        let options = model.list.filter { !$0.isFallback }
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            if picking {
                BBButton(L10n.back, icon: .chevronLeft, variant: .ghost, size: .sm) { picking = false }
                CategorySheetContent(categories: options, usage: model.usage, selectedId: categoryId) { picked in
                    categoryId = picked.id
                    categoryError = nil
                    picking = false
                }
            } else {
                BBTextField(label: L10n.pattern, text: $pattern, placeholder: L10n.eGSupermarket, error: patternError, height: 44)
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.type, style: BBTypography.bodyStrong.with(lineHeight: 14))
                    SegmentedControl(options: [(RuleMatchType.merchant, L10n.exact), (RuleMatchType.contains, L10n.contains)],
                                     selection: $matchType, stretch: true)
                }
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.category_5966b0, style: BBTypography.bodyStrong.with(lineHeight: 14))
                    let category = model.category(categoryId)
                    Button { picking = true } label: {
                        HStack(spacing: BBSpacing.space3) {
                            CategoryAvatar(category: category, diameter: 28)
                            BBText(category?.name ?? L10n.selectACategory, style: BBTypography.bodyLarge, lineLimit: 1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(height: 44)
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(categoryError != nil ? Color.bbDestructive : Color.bbInput, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if let categoryError { BBText(categoryError, style: BBTypography.body, color: .bbDestructive) }
                }
                if let formError { BBText(formError, style: BBTypography.body, color: .bbDestructive) }
                BBButton(rule == nil ? (saving ? L10n.adding_91047c : L10n.addRule) : (saving ? L10n.saving_f71782 : L10n.save),
                         size: .touch, fullWidth: true, isLoading: saving) { save() }
                if let rule {
                    BBButton(L10n.deleteRule, icon: .trash2, variant: .destructive, size: .touch, fullWidth: true) { onDelete(rule) }
                }
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            if let rule {
                pattern = rule.pattern
                matchType = rule.matchType
                categoryId = rule.categoryId
            } else {
                categoryId = options.first?.id
            }
        }
    }

    private func save() {
        patternError = JSNumber.trim(pattern).isEmpty ? L10n.patternIsRequired : nil
        categoryError = categoryId == nil ? L10n.selectACategory : nil
        guard patternError == nil, categoryError == nil, let categoryId else { return }
        saving = true
        formError = nil
        Task {
            let error: String?
            if let rule {
                var patch = RulePatch()
                if JSNumber.trim(pattern) != rule.pattern { patch.pattern = JSNumber.trim(pattern) }
                if matchType != rule.matchType { patch.matchType = matchType }
                if categoryId != rule.categoryId { patch.categoryId = categoryId }
                error = patch == RulePatch() ? nil : await model.updateRule(rule, patch)
            } else {
                error = await model.createRule(pattern: pattern, matchType: matchType, categoryId: categoryId)
            }
            saving = false
            if let error { formError = error } else { onClose() }
        }
    }
}

/// CAT-099/100: «Budget al mese (facoltativo)», saved when the field loses focus; emptied removes it.
private struct CategoryBudgetFieldView: View {
    let model: CategoriesModel
    let category: MovementCategory
    @State private var text = ""
    @State private var error: String?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let saved = model.budgets[category.id]
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBTextField(label: L10n.monthlyBudgetOptional, text: $text, placeholder: L10n.noBudget, keyboard: .amount,
                        prefix: LocaleRules.currencySymbol(model.env.session.currency), height: 44,
                        onSubmit: { commit(saved) }, onBlur: { commit(saved) })
                .onChange(of: text) { _, _ in error = nil }
            if let error {
                BBText(error, style: BBTypography.caption, color: .bbDestructive)
            } else {
                BBText(L10n.leaveItEmptyForNoLimitYouSeeItI, style: BBTypography.caption, color: .bbText3)
            }
        }
        .onAppear { text = CategoryBudgetField.inputText(saved, locale: locale) }
        .onChange(of: saved) { _, next in text = CategoryBudgetField.inputText(next, locale: locale) }
    }

    private func commit(_ saved: Double?) {
        let outcome = CategoryBudgetField.commit(text, saved: saved, locale: locale)
        Task {
            let problem = await model.saveBudget(category, outcome)
            error = problem
            if problem != nil, outcome != .invalid { text = CategoryBudgetField.inputText(saved, locale: locale) }
        }
    }
}
