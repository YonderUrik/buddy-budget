import BuddyBudgetKit
import SwiftUI

/// `Aggiungi un abbonamento` (SUB-023…025), body of a full-screen form dialog. Twin of `AddSubscriptionBody` on Android.
struct AddSubscriptionBody: View {
    @Bindable var model: SubscriptionsModel
    let text: SubscriptionText

    @State private var name = ""
    @State private var amountText = ""
    @State private var cadence: SubscriptionCadence = .mensile
    @State private var nextDate = ""
    @State private var categoryId: String?
    @Environment(\.bbLocale) private var locale

    var body: some View {
        FormDialogHeader(icon: .repeat, title: L10n.lookup(italian: "Aggiungi un abbonamento"),
                         description: L10n.lookup(italian: "Se compare tra i movimenti lo collegheremo da soli e ne seguiremo gli addebiti."))
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBTextField(label: L10n.lookup(italian: "Nome"), text: $name,
                        placeholder: L10n.lookup(italian: "Es. Palestra, Assicurazione casa"), height: subscriptionFieldHeight,
                        contentType: nil)
                .onChange(of: name) { _, new in
                    let clamped = SubscriptionForm.clampName(new)
                    if clamped != new { name = clamped }
                }
            HStack(alignment: .top, spacing: BBSpacing.space3) {
                BBTextField(label: L10n.lookup(italian: "Importo di ogni addebito"), text: $amountText,
                            placeholder: BBFormat.formatNumber(0, minimumFractionDigits: 2, maximumFractionDigits: 2, locale: locale),
                            keyboard: .amount, height: subscriptionFieldHeight)
                CadencePicker(cadence: $cadence, text: text)
            }
            BBDateField(label: L10n.lookup(italian: "Prossimo addebito"), date: $nextDate, height: subscriptionFieldHeight)
            SubscriptionCategoryPicker(categories: model.categories, categoryId: $categoryId)
            if let error = model.addError {
                BBErrorBox(message: error, reportArea: .abbonamento)
            }
            BBButton(model.addBusy ? L10n.lookup(italian: "Salvo…") : L10n.lookup(italian: "Aggiungi"), size: .touch,
                     fullWidth: true, isDisabled: model.addBusy) {
                Task {
                    await model.add(name: name, amountText: amountText, cadence: cadence, nextDate: nextDate,
                                    categoryId: categoryId)
                }
            }
        }
        .onAppear { if nextDate.isEmpty { nextDate = model.state.today } }
    }
}

#if DEBUG
/// DEBUG-only: `-BBSubscriptions add` or `-BBSubscriptions <key>` opens the add dialog or an item's detail
/// (screenshots for the parity check).
@MainActor
enum DebugSubscriptions {
    private static var applied = false

    static func apply(to model: SubscriptionsModel) {
        guard !applied, let value = DebugLaunch.value("-BBSubscriptions") else { return }
        Task {
            for _ in 0..<50 where model.state.phase != .loaded { try? await Task.sleep(for: .milliseconds(100)) }
            applied = true
            if value == "add" {
                model.startAdding()
            } else if value == "archive" || value == "bottom" {
                model.endedExpanded = true
                model.excludedExpanded = true
                if value == "bottom" {
                    try? await Task.sleep(for: .milliseconds(300))
                    model.debugScrollToBottom = true
                }
            } else if let item = model.state.item(key: value) {
                model.open(item)
            }
        }
    }
}
#endif
