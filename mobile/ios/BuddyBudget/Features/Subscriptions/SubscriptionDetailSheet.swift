import BuddyBudgetKit
import SwiftUI

/// Field height of the subscription forms on phone (web `h-11`).
let subscriptionFieldHeight: CGFloat = 44

/// Detail of a subscription (SUB-016…022), body of the full-screen form dialog. The decision actions are pinned in
/// the footer (`SubscriptionDetailActions`). Twin of `SubscriptionDetailBody` on Android.
struct SubscriptionDetailBody: View {
    @Bindable var model: SubscriptionsModel
    let item: SubscriptionItem
    let text: SubscriptionText

    @State private var name = ""
    @State private var amountText = ""
    @State private var cadence: SubscriptionCadence = .mensile
    @State private var nextDate = ""
    @State private var categoryId: String?
    @State private var prefilled = false
    /// SUB-016 / TX-064: a charge's movement detail, presented over this dialog.
    @State private var movement: MovementDetailRequest?
    @Environment(ShellModel.self) private var shell
    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    private static let amountStyle = BBTextStyle(role: .sans, size: 30, lineHeight: 36, weight: 500, letterSpacingEm: 0,
                                                 tabularNums: true, uppercase: false, anchor: .title)
    private static let historyAmountStyle = BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 400, letterSpacingEm: 0,
                                                        tabularNums: true, uppercase: false, anchor: .subheadline)

    var body: some View {
        let currency = model.state.currency
        FormDialogHeader(icon: .repeat, title: item.name,
                         description: L10n.lookup(italian: item.isManual ? "Aggiunto da te" : "Trovato nei tuoi movimenti"))
            .movementDetailHost(request: $movement,
                                openSettings: {
                                    movement = nil
                                    model.detailOpen = false
                                    shell.open(path: "/impostazioni?sezione=notifiche")
                                },
                                onChanged: { shell.dataChanged() })

        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            if let amount = item.amount {
                AmountText(value: amount, currency: currency, style: Self.amountStyle)
            } else {
                BBText("—", style: Self.amountStyle)
            }
            BBText(text.hint(item, today: model.state.today), style: BBTypography.body, color: .bbText2)
            if let monthly = item.monthly, item.cadence != .mensile {
                BBText(text.monthlyWeight(monthly, currency: currency, masked: hideAmounts), style: BBTypography.body, color: .bbText2)
            }
        }

        let reasons = item.reasons.compactMap { text.reason($0, currency: currency, masked: hideAmounts) }
        let history = SubscriptionsView.history(item)
        VStack(alignment: .leading, spacing: BBSpacing.space5) {
            if !reasons.isEmpty {
                FormDialogSection(title: L10n.lookup(italian: "Perché lo vediamo qui"), icon: .info,
                                  description: L10n.lookup(italian: "Il riconoscimento è un calcolo sui tuoi movimenti, senza AI: la decisione resta tua.")) {
                    VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                        ForEach(Array(reasons.enumerated()), id: \.offset) { _, sentence in
                            HStack(alignment: .top, spacing: BBSpacing.space2) {
                                BBIconView(.check, size: .md, color: .bbPos).padding(.top, 2)
                                BBText(sentence, style: BBTypography.body)
                            }
                        }
                    }
                }
            }
            if !history.isEmpty {
                if !reasons.isEmpty { BBSeparator() }
                FormDialogSection(title: L10n.lookup(italian: "Ultimi addebiti"), icon: .history) {
                    VStack(spacing: 0) {
                        ForEach(Array(history.enumerated()), id: \.offset) { index, charge in
                            if index > 0 { BBSeparator().opacity(0.6) }
                            // SUB-016 / TX-064: each charge opens its movement's detail.
                            Button { movement = MovementDetailRequest(id: charge.id) } label: {
                                HStack {
                                    BBText(BBFormat.formatDateWithYear(charge.date, locale: locale), style: BBTypography.body, color: .bbText2)
                                    Spacer(minLength: BBSpacing.space3)
                                    AmountText(value: charge.amount, currency: currency, style: Self.historyAmountStyle)
                                    BBIconView(.chevronRight, size: .md, color: .bbText3).padding(.leading, BBSpacing.space2)
                                }
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
                        }
                    }
                }
            }
            if item.id != nil {
                if !reasons.isEmpty || !history.isEmpty { BBSeparator() }
                FormDialogSection(title: L10n.lookup(italian: "Modifica"), icon: .repeat) {
                    editForm
                }
            }
        }

        if let error = model.detailError {
            BBText(error, style: BBTypography.body, color: .bbNeg).accessibilityAddTraits(.isStaticText)
        }

        Color.clear.frame(height: 0)
            .onAppear(perform: prefill)
    }

    @ViewBuilder private var editForm: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBTextField(label: L10n.lookup(italian: "Nome"), text: $name, height: subscriptionFieldHeight)
                .onChange(of: name) { _, new in
                    let clamped = SubscriptionForm.clampName(new)
                    if clamped != new { name = clamped }
                }
            if item.isManual {
                HStack(alignment: .top, spacing: BBSpacing.space3) {
                    BBTextField(label: L10n.lookup(italian: "Importo"), text: $amountText, keyboard: .amount,
                                height: subscriptionFieldHeight)
                    CadencePicker(cadence: $cadence, text: text)
                }
                BBDateField(label: L10n.lookup(italian: "Prossimo addebito"), date: $nextDate, height: subscriptionFieldHeight)
            }
            SubscriptionCategoryPicker(categories: model.categories, categoryId: $categoryId)
            BBButton(L10n.lookup(italian: "Salva le modifiche"), variant: .outline, size: .touch, isDisabled: model.detailBusy) {
                Task {
                    await model.saveEdits(item, name: name, amountText: amountText, cadence: cadence, nextDate: nextDate,
                                          categoryId: categoryId)
                }
            }
        }
    }

    private func prefill() {
        guard !prefilled else { return }
        prefilled = true
        name = item.name
        amountText = SubscriptionForm.amountText(item.amount, locale: locale)
        cadence = item.cadence ?? .mensile
        nextDate = item.nextDate ?? model.state.today
        categoryId = item.categoryId
    }
}

/// Pinned footer of the detail (SUB-017, SUB-020, SUB-021): only the allowed actions, primary on top, full width.
struct SubscriptionDetailActions: View {
    @Bindable var model: SubscriptionsModel
    let item: SubscriptionItem

    var body: some View {
        let allowed = SubscriptionsView.allowedActions(item)
        let busy = model.detailBusy
        VStack(spacing: BBSpacing.space2) {
            if let confirm = allowed.confirm {
                BBButton(L10n.lookup(italian: confirm == .putBack ? "Rimettilo tra i miei" : "Sì, è un abbonamento"), icon: .check,
                         size: .touch, fullWidth: true, isDisabled: busy) {
                    Task { await model.decide(item, .confermato) }
                }
            }
            if allowed.terminate {
                BBButton(L10n.lookup(italian: "È terminato"), variant: .outline, size: .touch, fullWidth: true, isDisabled: busy) {
                    Task { await model.decide(item, .terminato) }
                }
            }
            if allowed.exclude {
                BBButton(L10n.lookup(italian: "Non è un abbonamento"), icon: .x, variant: .outline, size: .touch, fullWidth: true,
                         isDisabled: busy) {
                    Task { await model.decide(item, .escluso) }
                }
            }
            if let removal = allowed.removal {
                BBButton(L10n.lookup(italian: removal == .delete ? "Elimina" : "Ripristina com'era"),
                         icon: removal == .delete ? .trash2 : .undo, variant: .ghost, size: .touch, fullWidth: true,
                         isDisabled: busy) {
                    model.remove(item)
                }
            }
        }
    }
}

/// `Ogni quanto` select with the capitalized cadence labels; monthly by default.
struct CadencePicker: View {
    @Binding var cadence: SubscriptionCadence
    let text: SubscriptionText

    var body: some View {
        BBSelect(label: L10n.lookup(italian: "Ogni quanto"),
                 options: SubscriptionCadence.allCases.map { ($0, text.cadenceOption($0)) },
                 selection: $cadence, height: subscriptionFieldHeight)
    }
}

/// `Categoria` select over expense categories (SUB-025), clearable with `Nessuna categoria`.
struct SubscriptionCategoryPicker: View {
    let categories: [SubscriptionCategory]
    @Binding var categoryId: String?

    var body: some View {
        let none: [(value: String?, label: String)] = [(nil, L10n.lookup(italian: "Nessuna categoria"))]
        let options = none + categories.map { (value: Optional($0.id), label: $0.name) }
        BBSelect(label: L10n.lookup(italian: "Categoria"), options: options, selection: $categoryId, height: subscriptionFieldHeight)
    }
}
