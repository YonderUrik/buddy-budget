import BuddyBudgetKit
import SwiftUI

private func t(_ source: String, _ values: [String: String] = [:]) -> String { L10n.lookup(italian: source, values) }

/// «Conti trovati» after the bank consent (ACC-023…028): one card per shared account, «Crea nuovo conto» or
/// «Ricollega a "…"», «Conferma» → initial import job, back to Conti. Twin of `FoundAccountsScreen` on Android.
struct FoundAccountsScreen: View {
    @Bindable var model: FoundAccountsModel
    /// `true` when the import started.
    let onClose: (Bool) -> Void

    var body: some View {
        BBScreen(title: t("Conti trovati"), onBack: { onClose(false) }) {
            VStack(alignment: .leading, spacing: BBSpacing.space4) {
                switch model.accounts {
                case .loading:
                    BBText(t("Caricamento conti trovati…"), style: BBTypography.body, color: .bbMutedForeground)
                case .failed:
                    LoadError(message: t("Impossibile caricare i conti trovati.")) { Task { await model.load() } }
                case .loaded(let data) where data.externalAccounts.isEmpty:
                    BBText(t("La banca non ha condiviso nessun conto. Riprova il collegamento se pensi sia un errore."),
                           style: BBTypography.body, color: .bbMutedForeground)
                case .loaded(let data):
                    BBText(t("Seleziona quali conti importare. Puoi crearne di nuovi o ricollegarli a un conto già esistente."),
                           style: BBTypography.body, color: .bbMutedForeground)
                        .padding(.top, -BBSpacing.space3)
                    VStack(spacing: BBSpacing.space3) {
                        ForEach(data.externalAccounts) { account in
                            FoundAccountCard(model: model, account: account, existing: data.existingAutoAccounts)
                        }
                    }
                    BBButton(t(model.finalizing ? "Avvio…" : "Conferma"), size: .touch, fullWidth: true, isDisabled: model.finalizing) {
                        Task { if await model.confirm() { onClose(true) } }
                    }
                    if let error = model.error {
                        BBText(error, style: BBTypography.body, color: .bbDestructive)
                    }
                }
            }
        }
        .task { await model.load() }
    }
}

private struct FoundAccountCard: View {
    @Bindable var model: FoundAccountsModel
    let account: ExternalBankAccount
    let existing: [ExistingAutoAccount]

    var body: some View {
        let id = account.externalAccountId
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            Button { model.toggle(id) } label: {
                HStack(spacing: BBSpacing.space3) {
                    BBCheckbox(isOn: Binding(get: { model.selected.contains(id) }, set: { _ in model.toggle(id) }),
                               accessibilityLabel: FoundAccounts.displayName(account))
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(FoundAccounts.displayName(account), style: BBTypography.bodyStrong)
                        if let iban = account.details.iban {
                            BBText(iban, style: BBTypography.caption.with(lineHeight: 16), color: .bbMutedForeground)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            BBSelect(options: [(String?.none, t("Crea nuovo conto"))] + existing.map { (Optional($0.id), t("Ricollega a \"{0}\"", ["0": $0.name])) },
                     selection: Binding(get: { model.targets[id] }, set: { model.targets[id] = $0 }), height: 44)
        }
        .padding(BBSpacing.space3)
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, lineWidth: 1))
    }
}
