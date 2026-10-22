package io.buddybudget.core.data

import kotlinx.serialization.Serializable

@Serializable
data class HealthStatus(val status: String)

/** `GET /api/health` — used by the app shell to tell "offline" from "server down". */
class HealthApi(private val client: ApiClient) {
    suspend fun check(): HealthStatus = client.get("api/health", HealthStatus.serializer())
}
