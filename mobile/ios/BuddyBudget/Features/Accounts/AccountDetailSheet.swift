import BuddyBudgetKit
import SwiftUI

private func t(_ source: String, _ values: [String: String] = [:]) -> String { L10n.lookup(italian: source, values) }

/// Account detail (ACC-032…042): rename on exit, icon/colour saved immediately, manual type and balance, linked sync
/// box, movements, delete/unlink with confirmation. Twin of `AccountDetailSheet` on Android.
struct AccountDetailSheet: View {
    let model: AccountsModel
    let account: Account

    @State private var name: String
    @State private var typePreset: String?
    @State private var customType: String
    @State private var balance: String
    @State private var picker = false
    @State private var confirm = false
    @Environment(\.bbLocale) private var locale

    init(model: AccountsModel, account: Account) {
        self.model = model
        self.account = account
        _name = State(initialValue: account.name)
        let preset = AccountOptions.typePresets.contains(account.type) ? account.type : nil
        _typePreset = State(initialValue: preset)
        _customType = State(initialValue: preset == nil ? account.type : "")
        _balance = State(initialValue: AccountDetailSheet.editableAmount(account.balance))
    }

    /// Balance as typed text with the Italian decimal comma ("1234,5"); `AmountInput` normalizes later edits.
    static func editableAmount(_ value: Double) -> String {
        let rounded = (value * 100).rounded() / 100
        var text = rounded == rounded.rounded() ? String(Int(rounded)) : String(rounded)
        text = text.replacingOccurrences(of: ".", with: ",")
        return text
    }

    var body: some View {
        let status = model.status(account)
        let syncing = model.isSyncing(account)
        let copy = AccountRemoval.copy(for: account)
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            HStack(spacing: BBSpacing.space3) {
                Button { picker = true } label: {
                    BBIconBadge(icon: BBIcon.account(account.icon), color: .bbSwatch(account.color), diameter: 48, iconSize: 22)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t("Cambia icona e colore"))
                VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                    BBText(account.name, style: BBTypography.cardTitle.with(size: 18, lineHeight: 24), lineLimit: 1)
                        .accessibilityAddTraits(.isHeader)
                    BBText("\(t(account.isLinked ? "Collegato alla banca" : "Conto manuale")) · \(t(status.label))",
                           style: BBTypography.body, color: .bbMutedForeground, lineLimit: 2)
                }
            }

            BBTextField(label: t("Nome"), text: $name, height: 44, submitLabel: .done, onSubmit: commitName, onBlur: commitName)

            if account.isLinked {
                linkedFacts
                syncBox(syncing: syncing)
            } else {
                manualFields
            }

            BBButton(t("Vedi i movimenti di questo conto"), icon: .listOrdered, variant: .outline, size: .touch, fullWidth: true) {
                model.showMovements(account)
            }
            BBButton(t(copy.action), icon: account.isLinked ? .link2Off : .trash2, variant: .destructive, size: .touch, fullWidth: true) {
                confirm = true
            }
        }
        .onDisappear {
            commitName()
            if !account.isLinked { commitBalance() }
        }
        .bbSheet(isPresented: $picker) {
            AppearancePicker(color: account.color, icon: account.icon) { color, icon in
                model.update(account, AccountEdits.appearance(account, color: color, icon: icon))
            }
        }
        #if DEBUG
        .task { if DebugLaunch.value("-BBAccounts") == "delete" { confirm = true } }
        #endif
        .bbAlertSheet(isPresented: $confirm, title: t(copy.title), description: accountsText(copy.message),
                      confirmLabel: t(copy.confirm), icon: account.isLinked ? .link2Off : .trash2) {
            model.remove(account)
        }
    }

    private func commitType() { model.update(account, AccountEdits.retype(account, draft: customType)) }

    private func commitBalance() { model.update(account, AccountEdits.rebalance(account, draft: balance)) }

    private func commitName() {
        if let patch = AccountEdits.rename(account, draft: name) {
            model.update(account, patch)
        } else if name.trimmingCharacters(in: .whitespaces) != account.name {
            name = account.name
        }
    }

    private var linkedFacts: some View {
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            VStack(alignment: .leading, spacing: 0) {
                BBText(t("Tipo"), style: BBTypography.body, color: .bbText2)
                BBText(account.type, style: BBTypography.bodyStrong)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 0) {
                BBText(t("Saldo dalla banca"), style: BBTypography.body, color: .bbText2)
                AmountText(value: account.balance, currency: model.currency, style: BBTextStyle.rowAmount.with(size: 14, lineHeight: 20))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(BBSpacing.space3)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbMuted.opacity(0.4)))
    }

    private func syncBox(syncing: Bool) -> some View {
        let starting = model.syncStarting.contains(account.id)
        let health = account.health
        return VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(accountsText(SyncAvailability.sentence(health: health, syncing: syncing, locale: locale, timeZone: .current)),
                   style: BBTypography.body, color: .bbText2)
            HStack(spacing: BBSpacing.space2) {
                BBButton(t("Sincronizza ora"), icon: .refreshCw, variant: .outline, size: .touch, fullWidth: true,
                         isLoading: starting || syncing,
                         isDisabled: !SyncAvailability.canSync(health: health, syncing: syncing, starting: starting)) {
                    model.sync(account)
                }
                if health?.needsRenewal == true {
                    BBButton(t("Riconnetti la banca"), size: .touch, fullWidth: true) { model.openNewAccount(renew: true) }
                }
            }
        }
        .padding(BBSpacing.space3)
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
    }

    @ViewBuilder private var manualFields: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBSelect(label: t("Tipo"), options: AccountOptions.typePresets.map { (Optional($0), t($0)) } + [(nil, t("Altro…"))],
                     selection: $typePreset, height: 44) { next in
                if let next { model.update(account, AccountEdits.retype(account, draft: next)) }
            }
            if typePreset == nil {
                BBTextField(text: $customType, placeholder: t("Es. Wallet crypto"), height: 44, submitLabel: .done,
                            onSubmit: commitType, onBlur: commitType)
            }
        }
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBTextField(label: t("Saldo"), text: $balance, keyboard: .signedAmount,
                        prefix: BBFormat.getCurrencySymbol(model.currency, locale: locale), height: 44, submitLabel: .done,
                        onSubmit: commitBalance, onBlur: commitBalance)
            BBText(t("Lo aggiorni tu: si salva quando esci dal campo."), style: BBTypography.body, color: .bbText2)
        }
    }
}
