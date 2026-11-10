import BuddyBudgetKit
import SwiftUI

/// The sheet open over Movimenti: one presenter whose content switches (actions → split/note/edit/category).
enum MovementSheet: Identifiable, Equatable {
    case actions(Movement)
    case category(Movement)
    case split(Movement)
    case note(Movement)
    case edit(Movement)

    var id: String {
        switch self {
        case .actions(let m): "actions-\(m.id)"
        case .category(let m): "category-\(m.id)"
        case .split(let m): "split-\(m.id)"
        case .note(let m): "note-\(m.id)"
        case .edit(let m): "edit-\(m.id)"
        }
    }
}

extension View {
    /// Attaches the movement sheets and the delete confirmation (TX-027…041).
    func movementSheets(model: LiquidityModel, sheet: Binding<MovementSheet?>, deleting: Binding<Movement?>) -> some View {
        modifier(MovementSheetsModifier(model: model, sheet: sheet, deleting: deleting))
    }
}

private struct MovementSheetsModifier: ViewModifier {
    let model: LiquidityModel
    @Binding var sheet: MovementSheet?
    @Binding var deleting: Movement?

    func body(content: Content) -> some View {
        content
            .bbSheet(isPresented: Binding(get: { sheet != nil }, set: { if !$0 { sheet = nil } }), title: title) {
                switch sheet {
                case .actions(let m): MovementActionsSheet(model: model, movement: m, sheet: $sheet, deleting: $deleting)
                case .category(let m): MovementCategorySheet(model: model, movement: m) { sheet = nil }
                case .split(let m):
                    MovementSplitPanel(movement: m, currency: model.currency, onSave: { await model.saveSplit(m, excluded: $0) }) { sheet = nil }
                case .note(let m): NoteSheet(model: model, movement: m) { sheet = nil }
                case .edit(let m):
                    MovementEditPanel(movement: m, currency: model.currency, today: model.today, onSave: { await model.saveEdit(m, $0) }) { sheet = nil }
                case nil: EmptyView()
                }
            }
            .bbAlertSheet(isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                          title: L10n.deleteThisTransaction_13a3c1,
                          description: L10n.s0WillBePermanentlyDeleted(deleting?.description ?? ""),
                          confirmLabel: L10n.delete_6b177b, icon: .trash2) {
                if let movement = deleting { Task { _ = await model.delete(movement) } }
            }
    }

    private var title: String? {
        switch sheet {
        case .split(let m): L10n.split0(m.description)
        case .note: L10n.note
        case .edit: L10n.editTransaction_e51824
        case .category: L10n.chooseCategory_bf34fc
        default: nil
        }
    }
}

/// Mobile «⋯» actions (mobile notes): header with description, raw bank text and amount; Categoria, Dividi
/// (not transfers), Nota, and for manual movements Modifica and Elimina (TX-027).
private struct MovementActionsSheet: View {
    let model: LiquidityModel
    let movement: Movement
    @Binding var sheet: MovementSheet?
    @Binding var deleting: Movement?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        let category = model.category(movement.categoryId)
        let kind = MovementKind.of(movement, category: category)
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                CategoryAvatar(category: category)
                VStack(alignment: .leading, spacing: 2) {
                    BBText(movement.description, style: .rowTitle, lineLimit: 2)
                    if let raw = movement.rawDescription, raw != movement.description {
                        BBText(raw, style: BBTypography.caption, color: .bbText3, lineLimit: 3)
                    }
                    BBText(metaLine, style: BBTypography.caption, color: .bbText2, lineLimit: 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                AmountText(value: kind == .transfer ? movement.amount : movement.effectiveAmount, currency: model.currency,
                           tone: kind == .transfer ? .neutral : .signed, signed: true, style: .rowAmount)
            }
            if let note = movement.note, !note.isEmpty {
                BBText(note, style: BBTypography.body, color: .bbText2)
            }
            VStack(spacing: 0) {
                SheetActionRow(icon: .tags, label: L10n.changeCategory) { sheet = .category(movement) }
                if kind != .transfer {
                    SheetActionRow(icon: .split, label: L10n.split_d28d0e) { sheet = .split(movement) }
                }
                SheetActionRow(icon: .notebookPen, label: (movement.note ?? "").isEmpty ? L10n.addNote : L10n.editNote) {
                    sheet = .note(movement)
                }
                if movement.isManual {
                    SheetActionRow(icon: .pencil, label: L10n.edit) { sheet = .edit(movement) }
                    SheetActionRow(icon: .trash2, label: L10n.delete_6b177b, destructive: true) {
                        sheet = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.05) { deleting = movement }
                    }
                }
            }
        }
    }

    private var metaLine: String {
        var parts: [String] = []
        if let date = CalendarDate(iso: movement.date) { parts.append(BBFormat.formatLongDate(date, locale: locale)) }
        if let account = model.account(movement.accountId) { parts.append(account.name) }
        return parts.joined(separator: " · ")
    }
}

/// TX-028…031: category picker with «Ricordala per i prossimi «…»» (only for uncategorized or bank movements).
private struct MovementCategorySheet: View {
    let model: LiquidityModel
    let movement: Movement
    let onClose: () -> Void
    @State private var remember = true

    var body: some View {
        let current = model.category(movement.categoryId)
        let offersRemember = (current?.isFallback ?? true) || movement.source == .auto
        CategorySheetContent(categories: CategoryRules.pickerCategories(model.categories, amount: movement.amount),
                             usage: model.usage, selectedId: movement.categoryId, description: movement.description,
                             searchPlaceholder: L10n.findACategory, mostUsedLabel: L10n.mostUsed, mostUsedLimit: 6,
                             onPick: { picked in
                                 onClose()
                                 guard picked.id != movement.categoryId else { return }
                                 Task { await model.changeCategory(movement, to: picked, remember: offersRemember && remember) }
                             }) {
            if offersRemember {
                BBSwitchRow(label: L10n.rememberItForFuture0(movement.description), isOn: $remember)
            }
        }
    }
}

/// «Dividi» (TX-034…036): shortcuts, amount field and slider bounded to [0, full], live own/excluded shares. Shared by the
/// Movimenti sheet and the movement detail (TX-066); `onSave` sends `excludedAmount` and says whether it succeeded.
struct MovementSplitPanel: View {
    let movement: Movement
    let currency: String
    let onSave: (Double) async -> Bool
    let onClose: () -> Void

    @State private var form: SplitForm
    @State private var text: String
    @State private var saving = false
    @State private var failed = false
    @Environment(\.bbLocale) private var locale

    init(movement: Movement, currency: String, onSave: @escaping (Double) async -> Bool, onClose: @escaping () -> Void) {
        self.movement = movement
        self.currency = currency
        self.onSave = onSave
        self.onClose = onClose
        let form = SplitForm(movement: movement)
        _form = State(initialValue: form)
        _text = State(initialValue: AmountInputText.input(form.ownShare, locale: .itIT))
    }

    var body: some View {
        let isIncome = movement.amount > 0
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            HStack {
                BBText(isIncome ? L10n.howMuchOfThisIncomeIsYours : L10n.howMuchOfThisExpenseIsYours, style: BBTypography.body, color: .bbText2)
                Spacer()
                AmountText(value: form.total, currency: currency, style: .rowAmount)
            }
            HStack(spacing: BBSpacing.space2) {
                ForEach(SplitShare.presets, id: \.key) { preset in
                    BBChip(label: L10n.lookup(italian: preset.label), isSelected: form.matchingPreset?.key == preset.key) {
                        form.applyPreset(preset)
                        text = AmountInputText.input(form.ownShare, locale: locale)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L10n.shortcuts)
            BBTextField(label: L10n.amount_da6661, text: $text, keyboard: .amount,
                        prefix: LocaleRules.currencySymbol(currency), height: 44)
                .onChange(of: text) { _, new in
                    if let value = BBFormat.parseAmount(new) { form.setOwnShare(value) }
                }
            BBSlider(value: Binding(get: { form.ownShare }, set: { value in
                form.setOwnShare(value)
                text = AmountInputText.input(form.ownShare, locale: locale)
            }), range: 0...max(form.total, 0.01), step: 0.01, accessibilityLabel: L10n.amount_da6661)
            VStack(spacing: BBSpacing.space2) {
                HStack {
                    BBText(isIncome ? L10n.countAsYourIncome : L10n.countAsYourExpense, style: BBTypography.body, color: .bbText2)
                    Spacer()
                    AmountText(value: form.ownShare, currency: currency, style: .rowAmount)
                }
                HStack {
                    BBText(L10n.excludedFromTotals_898ddc, style: BBTypography.body, color: .bbText2)
                    Spacer()
                    AmountText(value: form.excluded, currency: currency, style: .rowAmount)
                }
            }
            if failed { BBText(L10n.saveFailedTryAgain, style: BBTypography.body, color: .bbDestructive) }
            VStack(spacing: BBSpacing.space2) {
                BBButton(saving ? L10n.saving_f71782 : L10n.save, size: .touch, fullWidth: true, isLoading: saving) {
                    form.setOwnShare(text: text)
                    saving = true
                    failed = false
                    Task {
                        let ok = await onSave(form.excluded)
                        saving = false
                        if ok { onClose() } else { failed = true }
                    }
                }
                BBButton(L10n.cancel_6c3de5, variant: .outline, size: .touch, fullWidth: true, action: onClose)
            }
        }
        .onAppear { text = AmountInputText.input(form.ownShare, locale: locale) }
    }
}

/// TX-038: note up to 500 characters, saved on «Fatto» only if changed; empty removes it.
private struct NoteSheet: View {
    let model: LiquidityModel
    let movement: Movement
    let onClose: () -> Void

    @State private var text: String
    @State private var saving = false
    @State private var failed = false

    init(model: LiquidityModel, movement: Movement, onClose: @escaping () -> Void) {
        self.model = model
        self.movement = movement
        self.onClose = onClose
        _text = State(initialValue: movement.note ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBTextArea(text: $text, placeholder: L10n.addANoteEGWhatThisExpenseWasFor, maxLength: 500)
            if failed { BBText(L10n.couldNotSaveNoteTryAgain, style: BBTypography.body, color: .bbDestructive) }
            BBButton(L10n.done_33cad7, size: .touch, fullWidth: true, isLoading: saving) {
                saving = true
                failed = false
                Task {
                    let ok = await model.saveNote(movement, text: text)
                    saving = false
                    if ok { onClose() } else { failed = true }
                }
            }
        }
    }
}

/// TX-039: description, date and amount of a manual movement; changed valid fields are saved on «Fatto». Shared with the
/// detail (TX-066).
struct MovementEditPanel: View {
    let movement: Movement
    let currency: String
    let today: CalendarDate
    let onSave: (TransactionPatch) async -> Bool
    let onClose: () -> Void

    @State private var description: String
    @State private var date: CalendarDate
    @State private var amount: String
    @State private var saving = false
    @State private var failed = false
    @Environment(\.bbLocale) private var locale

    init(movement: Movement, currency: String, today: CalendarDate, onSave: @escaping (TransactionPatch) async -> Bool,
         onClose: @escaping () -> Void) {
        self.movement = movement
        self.currency = currency
        self.today = today
        self.onSave = onSave
        self.onClose = onClose
        _description = State(initialValue: movement.description)
        _date = State(initialValue: CalendarDate(iso: movement.date) ?? LiquidityModel.today)
        _amount = State(initialValue: AmountInputText.input(movement.amount, locale: .itIT))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBTextField(label: L10n.description, text: $description, height: 44)
            DateField(label: L10n.date_e5e429, date: $date, today: today)
            BBTextField(label: movement.amount > 0 ? L10n.incomeAmount : L10n.expenseAmount_3e7ed4, text: $amount, keyboard: .amount,
                        prefix: LocaleRules.currencySymbol(currency), height: 44)
            if saving || failed {
                BBText(saving ? L10n.saving_762bad : L10n.saveFailedTryAgain, style: BBTypography.caption,
                       color: failed ? .bbDestructive : .bbText3)
            }
            BBButton(L10n.done_33cad7, size: .touch, fullWidth: true, isLoading: saving) {
                guard let patch = MovementEdit.patch(movement, description: description, date: date, amountText: amount) else {
                    onClose()
                    return
                }
                saving = true
                failed = false
                Task {
                    let ok = await onSave(patch)
                    saving = false
                    if ok { onClose() } else { failed = true }
                }
            }
        }
        .onAppear { amount = AmountInputText.input(movement.amount, locale: locale) }
    }
}

/// Date with the quick choices `Oggi` / `Ieri` and the native date picker (mobile notes).
struct DateField: View {
    let label: String
    @Binding var date: CalendarDate
    let today: CalendarDate
    var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(label, style: BBTypography.bodyStrong.with(lineHeight: 14))
            HStack(spacing: BBSpacing.space2) {
                BBChip(label: L10n.today_6ca109, isSelected: date == today) { date = today }
                BBChip(label: L10n.yesterday_b057ff, isSelected: date == today.adding(days: -1)) { date = today.adding(days: -1) }
                Spacer(minLength: 0)
                DatePicker("", selection: Binding(get: { date.asDate }, set: { date = CalendarDate.of($0, in: .current) }),
                           in: ...today.asDate, displayedComponents: .date)
                    .labelsHidden()
                    .tint(.bbPrimary)
            }
            if let error { BBText(error, style: BBTypography.body, color: .bbDestructive) }
        }
    }
}

extension CalendarDate {
    /// Local midnight of this day (for the native date picker).
    var asDate: Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        return Calendar.current.date(from: components) ?? Date()
    }
}
