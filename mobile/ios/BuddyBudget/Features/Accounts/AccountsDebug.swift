#if DEBUG
import BuddyBudgetKit
import Foundation

/// DEBUG-only states for screenshots (`-BBAccounts <mode>` on iOS, `--es bbAccounts <mode>` on Android):
/// sheets and screens the local backend cannot reach (no GoCardless credentials). Never in release builds.
@MainActor
enum AccountsDebug {
    static let institutions = [
        Institution(id: "FINECO_FEBIITM2XXX", name: "FinecoBank", transactionTotalDays: "730"),
        Institution(id: "INTESA_SANPAOLO_BCITITMM", name: "Intesa Sanpaolo", transactionTotalDays: "540"),
        Institution(id: "N26_NTSBDEB1", name: "N26", transactionTotalDays: "90"),
        Institution(id: "UNICREDIT_UNCRITMM", name: "UniCredit", transactionTotalDays: "180"),
    ]

    /// Same data as `gocardless-native-flow.json` › complete.
    static let found = ConnectionAccounts(
        externalAccounts: [
            ExternalBankAccount(externalAccountId: "8d1e5a3c-0f6b-4e2a-9c7d-1b2a3c4d5e6f",
                                details: .init(iban: "IT60X0542811101000000123456", name: "Conto principale")),
            ExternalBankAccount(externalAccountId: "9e2f6b4d-1a7c-4f3b-8d8e-2c3b4d5e6f70", details: .init(name: "Carta")),
        ],
        existingAutoAccounts: [ExistingAutoAccount(id: "1d7e4c2b-5a6f-4b8c-9d0e-1f2a3b4c5d6e", name: "Conto corrente")])

    static func apply(_ mode: String, to model: AccountsModel) {
        switch mode {
        case "new": model.openNewAccount(renew: false)
        case "renew": model.openNewAccount(renew: true)
        case "bank", "bankError", "bankList":
            model.openNewAccount(renew: false)
            model.newAccount?.choose(.bank)
            if mode == "bankList" { model.newAccount?.debugSet(institutions: institutions) }
            if mode == "bankError" {
                model.newAccount?.debugSet(institutions: institutions,
                                           error: L10n.lookup(italian: "Impossibile avviare il collegamento con la banca"))
            }
        case "manual", "manual2":
            model.openNewAccount(renew: false)
            model.newAccount?.choose(.manual)
            if mode == "manual2" {
                model.newAccount?.draft.name = "Conto Intesa"
                model.newAccount?.manualStep = 1
            }
        case "detail", "detailManual", "delete":
            let linked = mode == "detail"
            model.detailId = model.list.first { $0.isLinked == linked }?.id
        case "found": model.found = FoundAccountsModel(env: model.env, connectionId: "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b", accounts: found)
        case "foundEmpty":
            model.found = FoundAccountsModel(env: model.env, connectionId: "x", accounts: ConnectionAccounts(externalAccounts: [], existingAutoAccounts: []))
        case "job":
            let id = model.list.first { $0.isLinked }?.id ?? "a"
            model.debugApply(jobs: [
                SyncJob(id: "j1", kind: .initialImport, status: .running, accounts: [
                    SyncJobAccount(accountId: id, name: "Conto corrente", phase: .saving, total: 412, processed: 200),
                    SyncJobAccount(accountId: "b", name: "Carta", phase: .fetching),
                ]),
                SyncJob(id: "j2", status: .done, accounts: [
                    SyncJobAccount(accountId: "c", name: "Conto principale", phase: .done, inserted: 12, categorized: 9, uncategorized: 3),
                ]),
            ])
        default: break
        }
    }
}
#endif
