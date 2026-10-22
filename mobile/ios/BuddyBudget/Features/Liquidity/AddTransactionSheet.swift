import BuddyBudgetKit
import SwiftUI

/// «Nuovo movimento» (TX-042…048): step 1 direction + amount, step 2 description, category and the collapsible
/// date/account summary; «Aggiungi e inserisci un altro» keeps date, account and direction. Android: AddTransactionSheet.kt.
struct AddTransactionSheet: View {
    let model: LiquidityModel
    let onClose: () -> Void
    let onAddAccount: () -> Void

    @State private var form = AddTransactionForm(today: LiquidityModel.today)
    @State private var pickingCategory = false
    @State private var showDetails = false
    @State private var submitting = false
    @State private var formError: String?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            BBText(L10n.anExpenseOrIncomeOnAManualAccount, style: BBTypography.body, color: .bbMutedForeground)
                .padding(.top, -BBSpacing.space2)
            StepBars(index: form.step, count: 2)
                .accessibilityLabel(L10n.newTransactionSteps_77b627)
            if pickingCategory {
                categoryPicker
            } else if form.step == 0 {
                stepOne
            } else {
                stepTwo
            }
        }
    }

    // MARK: Step 1

    private var stepOne: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.howMuchWasIt, style: BBTypography.sectionTitle)
            SegmentedControl(options: [(false, L10n.expense), (true, L10n.income_91651a)],
                             selection: $form.isIncome, accessibilityLabel: L10n.transactionType_2b7af3, stretch: true)
            BBTextField(label: L10n.amount_da6661, text: $form.amountText, error: form.errors[.amount].map { L10n.lookup(italian: $0) },
                        keyboard: .amount, prefix: LocaleRules.currencySymbol(model.currency), height: 44, autofocus: true)
            if !added.isEmpty {
                BBText(added, style: BBTypography.body, color: .bbPos)
            }
            BBButton(L10n.continue_, size: .touch, fullWidth: true) {
                _ = form.next(categories: model.categories, usage: model.usage, accounts: model.accounts ?? [])
            }
        }
    }

    private var added: String {
        guard form.added > 0 else { return "" }
        let first = form.added == 1 ? L10n.transactionAdded : L10n.s0TransactionsAdded(String(form.added))
        return "\(first) \(L10n.youCanAddAnother)"
    }

    // MARK: Step 2

    private var stepTwo: some View {
        let categoryId = form.categoryId(model.categories, usage: model.usage)
        let category = model.category(categoryId)
        let available = form.availableCategories(model.categories)
        let manual = model.manualAccounts
        let noAccount = manual.isEmpty
        return VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(form.isIncome ? L10n.whereIsItFrom : L10n.whatIsItFor, style: BBTypography.sectionTitle)
            BBTextField(label: L10n.description, text: $form.description,
                        placeholder: form.isIncome ? L10n.eGOctoberSalary : L10n.eGSupermarketShopping,
                        error: form.errors[.description].map { L10n.lookup(italian: $0) }, height: 44, autofocus: true)
            VStack(alignment: .leading, spacing: BBSpacing.space2) {
                BBText(L10n.category_5966b0, style: BBTypography.bodyStrong.with(lineHeight: 14))
                if available.isEmpty {
                    BBText(form.isIncome ? L10n.noIncomeCategoryAvailableAddOneUnd : L10n.noCategoriesAvailableAddOneBeforeR,
                           style: BBTypography.body, color: .bbDestructive)
                } else {
                    Button { pickingCategory = true } label: {
                        HStack(spacing: BBSpacing.space3) {
                            CategoryAvatar(category: category, diameter: 28)
                            BBText(category?.name ?? L10n.chooseACategory_d79b33, style: BBTypography.bodyLarge, lineLimit: 1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            BBIconView(.chevronDown, size: .md, color: .bbMutedForeground)
                        }
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(height: 44)
                        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(form.errors[.category] != nil ? Color.bbDestructive : Color.bbInput, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if let error = form.errors[.category] { BBText(L10n.lookup(italian: error), style: BBTypography.body, color: .bbDestructive) }
            }
            if noAccount {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    BBText(L10n.transactionsAreRecordedInManualAcco, style: BBTypography.body, color: .bbText2)
                    BBButton(L10n.addAnAccount, icon: .plus, variant: .outline, size: .sm, action: onAddAccount)
                }
            } else if showDetails || form.errors[.account] != nil {
                DateField(label: L10n.date_e5e429, date: $form.date, today: model.today)
                BBSelect(label: L10n.account_9f27c0, options: manual.map { ($0.id, $0.name) },
                         selection: Binding(get: { form.accountId(manual) ?? "" }, set: { form.accountOverride = $0 }),
                         title: L10n.account_9f27c0, height: 44)
            } else {
                HStack {
                    BBText(summary(manual), style: BBTypography.body, color: .bbText2, lineLimit: 1)
                    Spacer()
                    BBButton(L10n.change, variant: .link, size: .sm) { showDetails = true }
                }
            }
            if let formError { ErrorWithReport(area: .movimento, error: formError) }
            VStack(spacing: BBSpacing.space2) {
                HStack(spacing: BBSpacing.space2) {
                    BBButton(L10n.back, variant: .outline, size: .touch, fullWidth: true) { form.back() }
                    BBButton(submitting ? L10n.adding_5b1f1e : L10n.add, size: .touch, fullWidth: true, isLoading: submitting,
                             isDisabled: noAccount) { submit(keepOpen: false) }
                }
                BBButton(L10n.addAndEnterAnother, variant: .ghost, size: .touch, fullWidth: true, isDisabled: noAccount || submitting) {
                    submit(keepOpen: true)
                }
            }
        }
    }

    private func summary(_ manual: [Account]) -> String {
        let day: String
        if form.date == model.today { day = L10n.today_6ca109 } else if form.date == model.today.adding(days: -1) {
            day = L10n.yesterday_b057ff
        } else { day = form.date.iso }
        let account = manual.first { $0.id == form.accountId(manual) }?.name ?? ""
        return "\(day) · \(account)"
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBButton(L10n.back, icon: .chevronLeft, variant: .ghost, size: .sm) { pickingCategory = false }
            CategorySheetContent(categories: form.availableCategories(model.categories), usage: model.usage,
                                 selectedId: form.categoryId(model.categories, usage: model.usage),
                                 searchPlaceholder: L10n.findACategory, mostUsedLabel: L10n.mostUsed, mostUsedLimit: 6) { picked in
                form.categoryOverride = picked.id
                pickingCategory = false
            }
        }
    }

    private func submit(keepOpen: Bool) {
        formError = nil
        guard let body = form.body(categories: model.categories, usage: model.usage, accounts: model.accounts ?? []) else { return }
        submitting = true
        Task {
            let error = await model.create(body)
            submitting = false
            if let error {
                formError = error
                return
            }
            if keepOpen {
                form.didAddAndContinue()
            } else {
                onClose()
            }
        }
    }
}

/// Step progress of a two-step form (web `StepProgress`): «Passo N di M» over one capsule per step.
struct StepBars: View {
    let index: Int
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(L10n.lookup(italian: "Passo {0} di {1}", ["0": String(index + 1), "1": String(count)]),
                   style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
            HStack(spacing: BBSpacing.space1_5) {
                ForEach(0..<count, id: \.self) { i in
                    Capsule().fill(i <= index ? Color.bbPrimary : Color.bbBorder).frame(height: 4)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityValue(L10n.lookup(italian: "Passo {0} di {1}", ["0": String(index + 1), "1": String(count)]))
    }
}
