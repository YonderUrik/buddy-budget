package io.buddybudget.core.data

import kotlinx.serialization.Serializable

// «Dall'ultima visita» (SHELL-058…059, web #457; spec: api/endpoints/welcome.md). Same names on iOS (`WelcomeAPI`).

/** One counted item: `movements`, `price_alerts`, `price_rises` (happened) or `to_decide`, `subscriptions`, `import_review` (waiting). */
@Serializable
data class WelcomeItem(val kind: String, val count: Int = 0, val jobId: String? = null)

@Serializable
data class WelcomeSummary(val since: String = "", val happened: List<WelcomeItem> = emptyList(), val waiting: List<WelcomeItem> = emptyList())

/** `GET /api/welcome`: null when there is nothing to say (first visit, already shown in this visit, nothing new). */
@Serializable
data class WelcomeResponse(val summary: WelcomeSummary? = null)

@Serializable
data class VisitResult(val newVisit: Boolean = false)

class WelcomeApi(private val client: ApiClient) {
    /** SHELL-059: records the visit and returns the summary. */
    suspend fun summary(): WelcomeResponse = client.get("api/welcome", WelcomeResponse.serializer())

    /** SHELL-059: the toast appeared; not again until the next visit, on any device (best effort). */
    suspend fun markShown() = client.sendNoContent("api/welcome", "PATCH", """{"shown":true}""")

    /** SHELL-058: heartbeat of the open app. */
    suspend fun heartbeat(): VisitResult = client.post("api/visits", "{}", VisitResult.serializer())
}
