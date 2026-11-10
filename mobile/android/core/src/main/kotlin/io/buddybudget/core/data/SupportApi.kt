package io.buddybudget.core.data

import io.buddybudget.core.domain.support.ClientErrorReport
import io.buddybudget.core.domain.support.ReportInput
import io.buddybudget.core.domain.support.Support
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable

// Help & support endpoints (api/endpoints/support.md, client-errors.md). Same names on iOS (`SupportAPI`,
// `ClientErrorsAPI`).

/** Why sending a report failed: the server's message (validation, 429, 502) or none (network, unknown). */
data class ReportSendError(
    /** Server text as returned (Italian source when the catalog has it; translate before showing). */
    val serverMessage: String?,
) : Exception(serverMessage ?: Support.SEND_FAILED) {
    /** SUP-015: the message shown above `Puoi anche scrivere a support@buddybudget.io.` (Italian source). */
    override val message: String get() = serverMessage ?: Support.SEND_FAILED
}

class SupportApi(private val client: ApiClient) {
    @Serializable
    private data class Reply(val reference: String? = null)

    /** SUP-013: `POST /api/support` → the `SUP-XXXXXX` reference. A 2xx without `reference` is a failure (open question 8). */
    suspend fun send(input: ReportInput): String {
        val reply = try {
            client.post("api/support", client.json.encodeToString(ReportInput.serializer(), input), Reply.serializer())
        } catch (e: ApiError) {
            throw ReportSendError(e.errorBody?.message)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            throw ReportSendError(null)
        }
        return reply.reference?.takeIf { it.isNotEmpty() } ?: throw ReportSendError(null)
    }
}

class ClientErrorsApi(private val client: ApiClient) {
    /** SUP-024 / SUP-025: best effort and silent — every failure is swallowed. */
    suspend fun report(report: ClientErrorReport) {
        runCatching { client.sendNoContent("api/client-errors", "POST", client.json.encodeToString(ClientErrorReport.serializer(), report)) }
    }
}

/** Sends each distinct crash report once per app run (the web's boundary sends once per error), then stays silent. */
class ClientErrorReporter(private val api: ClientErrorsApi) {
    private val mutex = Mutex()
    private val sent = mutableSetOf<String>()

    /** Returns true when the report was sent (first time for this area/name/message). */
    suspend fun report(report: ClientErrorReport): Boolean {
        val key = "${report.area.raw}|${report.name.orEmpty()}|${report.message}"
        val first = mutex.withLock { sent.add(key) }
        if (!first) return false
        api.report(report)
        return true
    }
}
