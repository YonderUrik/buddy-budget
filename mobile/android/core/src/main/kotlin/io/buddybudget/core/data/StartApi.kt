package io.buddybudget.core.data

import io.buddybudget.core.domain.overview.StartStepId
import kotlinx.serialization.Serializable

// «Primi passi» and sample data (spec: api/endpoints/start.md) and «Novità» (api/endpoints/meta.md).
// Same names on iOS (`StartAPI`, `WhatsNewAPI`).

/** `GET /api/start` (OV-033…048, web #444/#452). */
@Serializable
data class StartStatus(
    val steps: Steps,
    /** The steps this user is asked for, in order (`startStepsFor`); empty from an older server → the default four. */
    val stepIds: List<String> = emptyList(),
    /** What the user chose to keep an eye on; null = never chosen. */
    val focus: List<String>? = null,
    /** Steps skipped with «Non mi serve». */
    val skipped: List<String> = emptyList(),
    val dismissed: Boolean = false,
    val completed: Boolean = false,
    val demoActive: Boolean = false,
    val justCompleted: Boolean? = null,
) {
    @Serializable
    data class Steps(
        val conto: Boolean = false,
        val import: Boolean = false,
        val investimento: Boolean = false,
        val debito: Boolean = false,
        val pensione: Boolean = false,
        val obiettivo: Boolean = false,
    ) {
        fun isDone(step: StartStepId): Boolean = when (step) {
            StartStepId.Conto -> conto
            StartStepId.Import -> import
            StartStepId.Investimento -> investimento
            StartStepId.Debito -> debito
            StartStepId.Pensione -> pensione
            StartStepId.Obiettivo -> obiettivo
        }
    }

    /** The steps asked, in order (default four when the server sent none). */
    val askedSteps: List<StartStepId>
        get() = stepIds.mapNotNull { StartStepId.of(it) }.ifEmpty { StartStepId.defaults }

    val skippedSteps: List<StartStepId> get() = skipped.mapNotNull { StartStepId.of(it) }
}

/** `POST /api/start/demo` → `201 { accounts, transactions }`. */
@Serializable
data class DemoStartResult(val accounts: Int = 0, val transactions: Int = 0)

class StartApi(private val client: ApiClient) {
    suspend fun status(): StartStatus = client.get("api/start", StartStatus.serializer())

    /** OV-036: `PATCH /api/start {dismissed}` → 204. */
    suspend fun setDismissed(dismissed: Boolean) {
        client.sendNoContent("api/start", "PATCH", """{"dismissed":$dismissed}""")
    }

    /** OV-046: `PATCH /api/start {step, skipped}` → 204 («Non mi serve» / «Rimetti»; never for `conto`). */
    suspend fun setSkipped(step: StartStepId, skipped: Boolean) {
        client.sendNoContent("api/start", "PATCH", """{"step":"${step.raw}","skipped":$skipped}""")
    }

    /** OV-047: `PATCH /api/start {focus}` → 204. */
    suspend fun setFocus(focus: List<String>) {
        client.sendNoContent("api/start", "PATCH", """{"focus":[${focus.joinToString(",") { "\"$it\"" }}]}""")
    }

    /** OV-039: creates the sample data (409 with a message when not allowed, OV-040). */
    suspend fun startDemo(): DemoStartResult {
        val response = client.send("api/start/demo", "POST")
        return runCatching { client.json.decodeFromString(DemoStartResult.serializer(), response.text) }.getOrDefault(DemoStartResult())
    }

    /** OV-042: removes the sample data → 204. */
    suspend fun clearDemo() {
        client.sendNoContent("api/start/demo", "DELETE")
    }
}

// ---------------------------------------------------------------- «Novità»

@Serializable
data class WhatsNewEntry(val id: String, val date: String, val title: String, val summary: String, val href: String, val ctaLabel: String)

/** `GET /api/whats-new` (SHELL-049): fresh entries for the user's country, newest first; `current` = newest not dismissed. */
@Serializable
data class WhatsNew(val maxAgeDays: Int = 45, val entries: List<WhatsNewEntry> = emptyList(), val current: WhatsNewEntry? = null)

class WhatsNewApi(private val client: ApiClient) {
    /** [dismissed] = ids closed on this device (`bb:whats-new-dismissed`), at most 100 sent. */
    suspend fun get(dismissed: List<String>): WhatsNew {
        val ids = dismissed.take(100)
        return client.get("api/whats-new", WhatsNew.serializer(), if (ids.isEmpty()) emptyMap() else mapOf("dismissed" to ids.joinToString(",")))
    }
}
