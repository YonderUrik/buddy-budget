package io.buddybudget.core.data

import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Account, preferences and lifecycle (spec: api/endpoints/user.md). Same names on iOS (`UserAPI`).

@Serializable
data class UserSettings(
    val name: String = "",
    val email: String,
    val image: String? = null,
    val productCountry: String = "IT",
    val language: String = "it",
    val currency: String = "EUR",
    val homePage: String = "/panoramica",
    val hideAmounts: Boolean = false,
    val legalAcceptedAt: String? = null,
    val legalAcceptedVersion: String? = null,
    val createdAt: String,
    val googleLinked: Boolean = false,
    val recentLoginUntil: String,
)

/** `PATCH /api/user/settings` (strict, at least one field). Null fields are omitted. */
@Serializable
data class UserSettingsPatch(
    val name: String? = null,
    val productCountry: String? = null,
    val language: String? = null,
    val currency: String? = null,
    val hideAmounts: Boolean? = null,
    val homePage: String? = null,
)

@Serializable
enum class DigestFrequency { settimanale, mensile }

@Serializable
data class NotificationPreferences(
    val digestEnabled: Boolean = false,
    val digestFrequency: DigestFrequency = DigestFrequency.mensile,
    val budgetAlertsEnabled: Boolean = false,
    val deadlineAlertsEnabled: Boolean = false,
    val goalAlertsEnabled: Boolean = false,
) {
    companion object {
        /** Defaults: everything off, monthly digest (AUTH-036, SET-023). */
        val Defaults = NotificationPreferences()
    }
}

/** Partial update of the notification preferences (`PATCH /api/user/notifications`). */
@Serializable
data class NotificationPreferencesPatch(
    val digestEnabled: Boolean? = null,
    val digestFrequency: DigestFrequency? = null,
    val budgetAlertsEnabled: Boolean? = null,
    val deadlineAlertsEnabled: Boolean? = null,
    val goalAlertsEnabled: Boolean? = null,
)

@Serializable
data class AiCategorizationState(
    val enabled: Boolean = false,
    val instructions: String = "",
    val available: Boolean = false,
    val autoApply: Boolean = false,
)

@Serializable
data class AiCategorizationPatch(val enabled: Boolean? = null, val instructions: String? = null, val autoApply: Boolean? = null)

@Serializable
data class UserSessionView(
    val id: String,
    val device: String = "",
    val browser: String = "",
    val os: String = "",
    val mobile: Boolean = false,
    val createdAt: String,
    val lastActiveAt: String,
    val expiresAt: String,
    val current: Boolean = false,
)

@Serializable
data class UserDataSummary(
    val accounts: Int = 0,
    val bankConnections: Int = 0,
    val transactions: Int = 0,
    val categories: Int = 0,
    val rules: Int = 0,
    val budgets: Int = 0,
    val investmentOperations: Int = 0,
    val debts: Int = 0,
    val pensionFunds: Int = 0,
    val netWorthDays: Int = 0,
)

/** Category choice sent with onboarding (`categorySetupSchema`). `key` is an explicit null for user-added ones. */
data class CategorySetupItem(val key: String?, val name: String, val type: String, val enabled: Boolean)

/** `POST /api/user/onboarding` body (AUTH-039). */
data class OnboardingRequest(
    val currency: String,
    val productCountry: String,
    val language: String,
    val legal: LegalAcceptance,
    val notifications: NotificationPreferences,
    val categories: List<CategorySetupItem>?,
    val aiCategorization: Boolean?,
    /** AUTH-058: the «Interessi» answer (possibly empty), already filtered to the country's options. */
    val focus: List<String> = emptyList(),
) {
    /** JSON with absent optional fields omitted and `key: null` kept (kotlinx can't mix both rules in one Json). */
    fun toJson(client: ApiClient): String = buildJsonObject {
        put("currency", currency)
        put("productCountry", productCountry)
        put("language", language)
        put("legal", client.json.encodeToJsonElement(LegalAcceptance.serializer(), legal))
        put("notifications", client.json.encodeToJsonElement(NotificationPreferences.serializer(), notifications))
        categories?.let { list ->
            put("categories", buildJsonArray {
                list.forEach { item ->
                    add(buildJsonObject {
                        put("key", item.key?.let(::JsonPrimitive) ?: JsonNull)
                        put("name", item.name)
                        put("type", item.type)
                        put("enabled", item.enabled)
                    })
                }
            })
        }
        aiCategorization?.let { put("aiCategorization", it) }
        put("focus", buildJsonArray { focus.forEach { add(JsonPrimitive(it)) } })
    }.toString()
}

/** A downloaded export archive. */
class DataExport(val bytes: ByteArray, val fileName: String)

class UserApi(private val client: ApiClient) {
    @Serializable private data class Confirmation(val confirmation: String)
    @Serializable private data class EmailConfirmation(val email: String)
    @Serializable private data class DeactivateResponse(val deletionScheduledAt: String)
    @Serializable private data class RevokedResponse(val revoked: Int = 0)

    private fun <T> encode(serializer: kotlinx.serialization.KSerializer<T>, value: T): String =
        client.json.encodeToString(serializer, value)

    suspend fun settings(): UserSettings = client.get("api/user/settings", UserSettings.serializer())

    suspend fun updateSettings(patch: UserSettingsPatch) =
        client.sendNoContent("api/user/settings", "PATCH", encode(UserSettingsPatch.serializer(), patch))

    suspend fun completeOnboarding(request: OnboardingRequest) =
        client.sendNoContent("api/user/onboarding", "POST", request.toJson(client))

    suspend fun acceptLegal(acceptance: LegalAcceptance) =
        client.sendNoContent("api/user/legal-acceptance", "POST", encode(LegalAcceptance.serializer(), acceptance))

    suspend fun notifications(): NotificationPreferences = client.get("api/user/notifications", NotificationPreferences.serializer())

    suspend fun updateNotifications(patch: NotificationPreferencesPatch): NotificationPreferences =
        client.patch("api/user/notifications", encode(NotificationPreferencesPatch.serializer(), patch), NotificationPreferences.serializer())

    suspend fun sendNotificationExample() = client.sendNoContent("api/user/notifications/test", "POST", "{}")

    suspend fun aiCategorization(): AiCategorizationState = client.get("api/user/ai-categorization", AiCategorizationState.serializer())

    suspend fun updateAiCategorization(patch: AiCategorizationPatch): AiCategorizationState =
        client.patch("api/user/ai-categorization", encode(AiCategorizationPatch.serializer(), patch), AiCategorizationState.serializer())

    suspend fun sessions(): List<UserSessionView> = client.get("api/user/sessions", ListSerializer(UserSessionView.serializer()))

    suspend fun revokeSession(id: String) = client.sendNoContent("api/user/sessions/$id", "DELETE")

    suspend fun revokeOtherSessions(): Int = client.delete("api/user/sessions", RevokedResponse.serializer()).revoked

    suspend fun dataSummary(): UserDataSummary = client.get("api/user/data-summary", UserDataSummary.serializer())

    /** `GET /api/user/export` (ZIP, recent login). File name from `Content-Disposition`, else the web's pattern. */
    suspend fun export(today: CalendarDate): DataExport {
        val response = client.send("api/user/export", "GET", accept = "application/zip")
        val name = fileName(response.header("Content-Disposition")) ?: "buddybudget-export-${today.iso}.zip"
        return DataExport(response.bytes, name)
    }

    suspend fun reset(confirmation: String) =
        client.sendNoContent("api/user/reset", "POST", encode(Confirmation.serializer(), Confirmation(confirmation)))

    /** Returns `deletionScheduledAt` (ISO). */
    suspend fun deactivate(): String = client.post("api/user/deactivate", "{}", DeactivateResponse.serializer()).deletionScheduledAt

    suspend fun reactivate() = client.sendNoContent("api/user/reactivate", "POST", "{}")

    suspend fun deleteAccount(email: String) =
        client.sendNoContent("api/user/account", "DELETE", encode(EmailConfirmation.serializer(), EmailConfirmation(email)))

    companion object {
        /** `attachment; filename="buddybudget-export-2026-10-18.zip"` → the file name. */
        fun fileName(contentDisposition: String?): String? {
            val value = contentDisposition ?: return null
            val index = value.indexOf("filename=")
            if (index < 0) return null
            return value.substring(index + "filename=".length).split(";").first().trim('"', ' ').ifEmpty { null }
        }
    }
}

/** `GET /api/transactions/attention` — only `uncategorizedCount` is used by the shell (SHELL-016). */
@Serializable
data class AttentionCounts(val newCount: Int = 0, val uncategorizedCount: Int = 0, val totalCount: Int = 0)

class AttentionApi(private val client: ApiClient) {
    suspend fun counts(): AttentionCounts = client.get("api/transactions/attention", AttentionCounts.serializer())
}
