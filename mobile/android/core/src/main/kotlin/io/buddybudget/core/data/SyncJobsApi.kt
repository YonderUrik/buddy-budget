package io.buddybudget.core.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

// Background bank imports / syncs (spec: api/endpoints/sync-jobs.md). Same names on iOS (`SyncJobsAPI`, …).

enum class SyncJobKind(val key: String) {
    InitialImport("initial-import"), ManualSync("manual-sync");

    companion object {
        fun of(key: String?) = entries.firstOrNull { it.key == key } ?: ManualSync
    }
}

enum class SyncJobStatus(val key: String) {
    Running("running"), Done("done"), Failed("failed");

    companion object {
        fun of(key: String?) = entries.firstOrNull { it.key == key } ?: Running
    }
}

enum class SyncAccountPhase(val key: String) {
    Queued("queued"), Balance("balance"), Fetching("fetching"), Saving("saving"),
    Done("done"), Limited("limited"), Expired("expired"), Error("error");

    /** `FINAL_PHASES`: the account will not change any more. */
    val isFinal: Boolean get() = this == Done || this == Limited || this == Expired || this == Error

    companion object {
        fun of(key: String?) = entries.firstOrNull { it.key == key } ?: Error
    }
}

@Serializable
data class SyncJobAccount(
    val accountId: String,
    val name: String = "",
    @SerialName("phase") private val phaseKey: String = "error",
    val total: Int? = null,
    val processed: Int = 0,
    val inserted: Int = 0,
    val categorized: Int = 0,
    val uncategorized: Int = 0,
    /** `already-running` when another sync held the account's lock. */
    val errorReason: String? = null,
) {
    val phase: SyncAccountPhase get() = SyncAccountPhase.of(phaseKey)

    companion object {
        fun of(
            accountId: String, name: String, phase: SyncAccountPhase, total: Int? = null, processed: Int = 0, inserted: Int = 0,
            categorized: Int = 0, uncategorized: Int = 0, errorReason: String? = null,
        ) = SyncJobAccount(accountId, name, phase.key, total, processed, inserted, categorized, uncategorized, errorReason)
    }
}

@Serializable
data class SyncJob(
    val id: String,
    @SerialName("kind") private val kindKey: String = "manual-sync",
    @SerialName("status") private val statusKey: String = "running",
    val startedAt: String = "",
    val updatedAt: String = "",
    /** Running without a heartbeat for more than 60 s (evaluated by the server, ACC-048). */
    val interrupted: Boolean = false,
    val accounts: List<SyncJobAccount> = emptyList(),
) {
    val kind: SyncJobKind get() = SyncJobKind.of(kindKey)
    val status: SyncJobStatus get() = SyncJobStatus.of(statusKey)

    companion object {
        fun of(
            id: String, status: SyncJobStatus, accounts: List<SyncJobAccount>, kind: SyncJobKind = SyncJobKind.ManualSync,
            interrupted: Boolean = false,
        ) = SyncJob(id, kind.key, status.key, interrupted = interrupted, accounts = accounts)
    }
}

class SyncJobsApi(private val client: ApiClient) {
    /** Non-dismissed jobs of the last 24 h, newest first. */
    suspend fun list(): List<SyncJob> = client.get("api/sync-jobs", ListSerializer(SyncJob.serializer()))

    /** ACC-049: hides the summary on every device. */
    suspend fun dismiss(id: String) = client.sendNoContent("api/sync-jobs/$id/dismiss", "POST", "{}")
}
