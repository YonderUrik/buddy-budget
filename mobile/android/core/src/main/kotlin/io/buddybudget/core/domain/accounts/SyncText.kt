package io.buddybudget.core.domain.accounts

import io.buddybudget.core.data.AccountHealth
import io.buddybudget.core.data.SyncAccountPhase
import io.buddybudget.core.data.SyncJob
import io.buddybudget.core.data.SyncJobAccount
import io.buddybudget.core.data.SyncJobStatus
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import java.time.Instant
import java.time.ZoneId

// Manual sync availability, start errors and background-job texts (ACC-036, 044, 046…050;
// web `account-status.ts`, `sync-messages.ts`, `describe-account-progress.ts`, `lib/sync-jobs/view.ts`).

/** `HH:mm` of an ISO instant in the device time zone. */
object SyncClock {
    fun parse(iso: String): Instant? = runCatching { Instant.parse(iso) }.getOrNull()

    fun time(iso: String, locale: BBLocale, zone: ZoneId): String? {
        val instant = parse(iso) ?: return null
        val local = instant.atZone(zone)
        return BBFormat.formatTime(local.hour, local.minute, locale)
    }
}

object SyncAvailability {
    /** Syncs per account per rolling 24 h (shared by manual and automatic syncs). */
    const val DAILY_LIMIT = 4

    /** The sentence next to «Sincronizza ora» (ACC-036). */
    fun sentence(health: AccountHealth?, syncing: Boolean, locale: BBLocale, zone: ZoneId): AccountsText {
        if (syncing || health?.syncing == true) return AccountsText("Sincronizzazione in corso.")
        if (health?.needsRenewal == true) return AccountsText("Riconnetti la banca per sincronizzare.")
        if (health == null) return AccountsText("Informazioni di sincronizzazione non disponibili.")
        if (health.eligible) return AccountsText("Puoi sincronizzare adesso.")
        val time = health.nextEligibleAt?.let { SyncClock.time(it, locale, zone) } ?: return AccountsText("Sincronizzazione non disponibile.")
        if (health.syncsRemainingToday == 0) {
            return AccountsText(
                "Hai raggiunto il limite di {0} sincronizzazioni al giorno. Prossima alle {1}.",
                mapOf("0" to DAILY_LIMIT.toString(), "1" to time),
            )
        }
        return AccountsText("Prossima sincronizzazione disponibile alle {0}.", mapOf("0" to time))
    }

    /** ACC-037: «Sincronizza ora» is enabled only when eligible, idle and not waiting for a renewal. */
    fun canSync(health: AccountHealth?, syncing: Boolean, starting: Boolean): Boolean =
        health != null && health.eligible && !health.needsRenewal && !syncing && !health.syncing && !starting
}

object SyncStartError {
    /** Toast for a failed `POST …/accounts/{id}/sync` (ACC-044). `nextEligibleAt` from the 429 body or the account. */
    fun message(status: Int?, nextEligibleAt: String?, locale: BBLocale, zone: ZoneId): AccountsText = when (status) {
        429 -> nextEligibleAt?.let { SyncClock.time(it, locale, zone) }
            ?.let { AccountsText("Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle {0}.", mapOf("0" to it)) }
            ?: AccountsText("Sync non disponibile al momento. Riprova più tardi.")
        409 -> AccountsText("Sincronizzazione già in corso per questo conto.")
        503 -> AccountsText("Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.")
        404 -> AccountsText("Conto non trovato o non collegato")
        else -> AccountsText("Impossibile completare la sincronizzazione. Riprova più tardi.")
    }
}

// ---------------------------------------------------------------------------------------------------------- Jobs

sealed class SyncBar {
    data object None : SyncBar()
    data object Indeterminate : SyncBar()
    data class Determinate(val value: Double, val max: Double) : SyncBar()
}

enum class SyncTone { Normal, Success, Error }

data class SyncAccountProgress(
    val text: AccountsText,
    val bar: SyncBar,
    val tone: SyncTone,
    /** Balance, download or save in progress (text shimmers on the web). */
    val working: Boolean,
)

object SyncJobs {
    const val POLL_INTERVAL_MS = 1000L

    private fun active(job: SyncJob) = job.status == SyncJobStatus.Running && !job.interrupted

    /** ACC-046: poll only while some job runs. */
    fun shouldPoll(jobs: List<SyncJob>): Boolean = jobs.any(::active)

    /** `isAccountSyncing`. */
    fun isSyncing(jobs: List<SyncJob>, accountId: String): Boolean =
        jobs.any { job -> active(job) && job.accounts.any { it.accountId == accountId && !it.phase.isFinal } }

    /** Ids of running jobs, to compare two polls. */
    fun runningIds(jobs: List<SyncJob>): Set<String> = jobs.filter(::active).map { it.id }.toSet()

    /** ACC-051: a job that was running is no longer running → refresh the data. */
    fun finishedSince(previous: Set<String>, current: List<SyncJob>): Boolean {
        val now = runningIds(current)
        return previous.any { it !in now }
    }

    /** Movements left to categorize by a finished job (ACC-050 `Categorizza`). */
    fun uncategorized(job: SyncJob): Int = job.accounts.sumOf { it.uncategorized }

    fun isFinished(job: SyncJob): Boolean = job.status != SyncJobStatus.Running || job.interrupted

    fun hasErrors(job: SyncJob): Boolean =
        job.status == SyncJobStatus.Failed || job.interrupted || job.accounts.any { it.phase == SyncAccountPhase.Error }

    /** Ring/overall bar: determinate only when every active account knows its total. */
    fun overallProgress(job: SyncJob): SyncBar {
        if (job.status != SyncJobStatus.Running) return SyncBar.Determinate(1.0, 1.0)
        var processed = 0
        var total = 0
        for (account in job.accounts) {
            val t = account.total
            if (t == null) {
                if (account.phase.isFinal) continue
                return SyncBar.Indeterminate
            }
            processed += account.processed
            total += t
        }
        return if (total == 0) SyncBar.Indeterminate else SyncBar.Determinate(processed.toDouble(), total.toDouble())
    }

    /** Job title (ACC-047). */
    fun title(job: SyncJob): AccountsText {
        if (job.interrupted) return AccountsText("Sincronizzazione interrotta")
        return when (job.status) {
            SyncJobStatus.Done -> AccountsText("Sincronizzazione completata")
            SyncJobStatus.Failed -> AccountsText("Sincronizzazione non riuscita")
            SyncJobStatus.Running -> {
                val n = job.accounts.size
                AccountsText(if (n == 1) "Sincronizzazione in corso · {0} conto" else "Sincronizzazione in corso · {0} conti", mapOf("0" to n.toString()))
            }
        }
    }

    /** Phase text, bar and tone of one account (ACC-047 / ACC-048). */
    fun describe(account: SyncJobAccount, interrupted: Boolean): SyncAccountProgress = when (account.phase) {
        SyncAccountPhase.Queued -> SyncAccountProgress(AccountsText("In attesa"), SyncBar.None, SyncTone.Normal, false)
        SyncAccountPhase.Balance -> SyncAccountProgress(AccountsText("Aggiorno il saldo…"), SyncBar.Indeterminate, SyncTone.Normal, !interrupted)
        SyncAccountPhase.Fetching ->
            SyncAccountProgress(AccountsText("Scarico i movimenti dalla banca…"), SyncBar.Indeterminate, SyncTone.Normal, !interrupted)
        SyncAccountPhase.Saving -> {
            val total = account.total ?: 0
            val source = if (total == 1) "Importati {0} di {1} movimento" else "Importati {0} di {1} movimenti"
            SyncAccountProgress(
                AccountsText(source, mapOf("0" to account.processed.toString(), "1" to total.toString())),
                SyncBar.Determinate(account.processed.toDouble(), maxOf(total, 1).toDouble()), SyncTone.Normal, !interrupted,
            )
        }
        SyncAccountPhase.Done -> SyncAccountProgress(
            summary(account.inserted, account.categorized, account.uncategorized), SyncBar.Determinate(1.0, 1.0), SyncTone.Success, false,
        )
        SyncAccountPhase.Limited -> SyncAccountProgress(
            AccountsText("La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."), SyncBar.None, SyncTone.Error, false,
        )
        SyncAccountPhase.Expired -> SyncAccountProgress(
            AccountsText("Sessione con la banca scaduta. Riconnetti il conto per sincronizzare."), SyncBar.None, SyncTone.Error, false,
        )
        SyncAccountPhase.Error ->
            if (account.errorReason == "already-running") {
                SyncAccountProgress(AccountsText("Sincronizzazione già in corso per questo conto."), SyncBar.None, SyncTone.Error, false)
            } else {
                val source = if (interrupted) "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì."
                else "Sincronizzazione non riuscita. Riprova più tardi."
                SyncAccountProgress(AccountsText(source), SyncBar.None, SyncTone.Error, false)
            }
    }

    /** `buildSyncSummaryMessage`. */
    fun summary(inserted: Int, categorized: Int, uncategorized: Int): AccountsText {
        if (inserted == 0) return AccountsText("Nessuna nuova transazione trovata. Saldo aggiornato.")
        val parts = buildList {
            if (categorized > 0) {
                add(AccountsText(if (categorized == 1) "{0} categorizzata da sola" else "{0} categorizzate da sole", mapOf("0" to categorized.toString())))
            }
            if (uncategorized > 0) add(AccountsText("{0} da decidere", mapOf("0" to uncategorized.toString())))
        }
        val one = inserted == 1
        if (parts.isEmpty()) {
            return AccountsText(
                if (one) "{0} nuova transazione. Saldo aggiornato." else "{0} nuove transazioni. Saldo aggiornato.",
                mapOf("0" to inserted.toString()),
            )
        }
        return AccountsText(
            if (one) "{0} nuova transazione ({1}). Saldo aggiornato." else "{0} nuove transazioni ({1}). Saldo aggiornato.",
            mapOf("0" to inserted.toString()), mapOf("1" to parts),
        )
    }
}
