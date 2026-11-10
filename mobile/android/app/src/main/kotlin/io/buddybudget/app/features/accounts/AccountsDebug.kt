package io.buddybudget.app.features.accounts

import io.buddybudget.core.data.ConnectionAccounts
import io.buddybudget.core.data.ExistingAutoAccount
import io.buddybudget.core.data.ExternalBankAccount
import io.buddybudget.core.data.Institution
import io.buddybudget.core.data.SyncAccountPhase
import io.buddybudget.core.data.SyncJob
import io.buddybudget.core.data.SyncJobAccount
import io.buddybudget.core.data.SyncJobKind
import io.buddybudget.core.data.SyncJobStatus

/**
 * DEBUG-only states for screenshots (`--es bbAccounts <mode>`; iOS `-BBAccounts <mode>`): sheets and screens the local
 * backend cannot reach (no GoCardless credentials). Only called when `BuildConfig.DEBUG`.
 */
object AccountsDebug {
    val institutions = listOf(
        Institution("FINECO_FEBIITM2XXX", "FinecoBank", "730"),
        Institution("INTESA_SANPAOLO_BCITITMM", "Intesa Sanpaolo", "540"),
        Institution("N26_NTSBDEB1", "N26", "90"),
        Institution("UNICREDIT_UNCRITMM", "UniCredit", "180"),
    )

    /** Same data as `gocardless-native-flow.json` › complete. */
    val found = ConnectionAccounts(
        listOf(
            ExternalBankAccount("8d1e5a3c-0f6b-4e2a-9c7d-1b2a3c4d5e6f", ExternalBankAccount.Details(iban = "IT60X0542811101000000123456", name = "Conto principale")),
            ExternalBankAccount("9e2f6b4d-1a7c-4f3b-8d8e-2c3b4d5e6f70", ExternalBankAccount.Details(name = "Carta")),
        ),
        listOf(ExistingAutoAccount("1d7e4c2b-5a6f-4b8c-9d0e-1f2a3b4c5d6e", "Conto corrente")),
    )

    fun apply(mode: String, model: AccountsModel) {
        when (mode) {
            "new" -> model.openNewAccount(false)
            "renew" -> model.openNewAccount(true)
            "bank", "bankError", "bankList" -> {
                model.openNewAccount(false)
                model.newAccount?.choose(NewAccountModel.Step.Bank)
                if (mode == "bankList") model.newAccount?.debugSet(institutions)
                if (mode == "bankError") {
                    model.newAccount?.debugSet(institutions, model.env.session.strings().lookup("Impossibile avviare il collegamento con la banca"))
                }
            }
            "manual", "manual2" -> {
                model.openNewAccount(false)
                model.newAccount?.choose(NewAccountModel.Step.Manual)
                if (mode == "manual2") model.newAccount?.let {
                    it.draft = it.draft.copy(name = "Conto Intesa")
                    it.manualStep = 1
                }
            }
            "detail", "detailManual", "delete" -> {
                val linked = mode == "detail"
                model.detailId = model.list.firstOrNull { it.isLinked == linked }?.id
            }
            "found" -> model.found = FoundAccountsModel(model.env, "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b", found)
            "foundEmpty" -> model.found = FoundAccountsModel(model.env, "x", ConnectionAccounts())
            "job" -> {
                val id = model.list.firstOrNull { it.isLinked }?.id ?: "a"
                model.debugApply(
                    listOf(
                        SyncJob.of(
                            "j1", SyncJobStatus.Running, kind = SyncJobKind.InitialImport,
                            accounts = listOf(
                                SyncJobAccount.of(id, "Conto corrente", SyncAccountPhase.Saving, total = 412, processed = 200),
                                SyncJobAccount.of("b", "Carta", SyncAccountPhase.Fetching),
                            ),
                        ),
                        SyncJob.of(
                            "j2", SyncJobStatus.Done,
                            listOf(SyncJobAccount.of("c", "Conto principale", SyncAccountPhase.Done, inserted = 12, categorized = 9, uncategorized = 3)),
                        ),
                    ),
                )
            }
        }
    }
}
