package io.buddybudget.core.data

import io.buddybudget.core.domain.format.JSNumber
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.jsonPrimitive

// Bank linking and manual sync through GoCardless (spec: api/endpoints/gocardless.md, native flow R6).
// Same names on iOS (`GoCardlessAPI`, …).

/** Why a new bank cannot be linked (`GET /api/gocardless/capacity`). */
enum class BankCapacityReason(val key: String) {
    UserLimit("user_limit"), UserAttempts("user_attempts"), GlobalLimit("global_limit"), ProviderLimit("provider_limit");

    companion object {
        fun of(key: String?): BankCapacityReason? = entries.firstOrNull { it.key == key }
    }
}

@Serializable
data class BankCapacity(
    val canConnectNew: Boolean = false,
    @SerialName("reason") private val reasonKey: String? = null,
    val renewableInstitutionIds: List<String> = emptyList(),
) {
    val reason: BankCapacityReason? get() = BankCapacityReason.of(reasonKey)

    companion object {
        fun of(canConnectNew: Boolean, reason: BankCapacityReason?) = BankCapacity(canConnectNew, reason?.key)
    }
}

/** `transaction_total_days` kept as sent (a number as string; numbers are accepted too). */
object DaysTextSerializer : KSerializer<String> {
    override val descriptor = PrimitiveSerialDescriptor("DaysText", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String {
        val p = (decoder as? JsonDecoder)?.decodeJsonElement()?.jsonPrimitive ?: return decoder.decodeString()
        if (p.isString) return p.content
        val number = p.content.toDoubleOrNull() ?: return ""
        return if (number == Math.rint(number)) number.toLong().toString() else number.toString()
    }

    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
}

/** A bank of a country (`GET /api/gocardless/institutions`). */
@Serializable
data class Institution(
    val id: String,
    val name: String = "",
    @SerialName("transaction_total_days") @Serializable(with = DaysTextSerializer::class) val transactionTotalDays: String = "",
    val logo: String? = null,
)

/** `POST /api/gocardless/connections` answer: the consent link and the connection id (returned as `ref`). */
@Serializable
data class BankConnectionStart(val link: String, val connectionId: String? = null)

/** A bank account the user shared during the consent. */
@Serializable
data class ExternalBankAccount(val externalAccountId: String, val details: Details = Details()) {
    @Serializable
    data class Details(val iban: String? = null, val name: String? = null, val product: String? = null)
}

/** A linked account of the user that a shared bank account can be re-linked to (renewal). */
@Serializable
data class ExistingAutoAccount(val id: String, val name: String)

/** `GET …/connections/{id}/accounts`, also embedded in the `…/complete` answer. */
@Serializable
data class ConnectionAccounts(
    val externalAccounts: List<ExternalBankAccount> = emptyList(),
    val existingAutoAccounts: List<ExistingAutoAccount> = emptyList(),
)

/** `POST …/connections/{id}/complete` (R6) → `linked` with the accounts to select. */
@Serializable
data class ConnectionCompletion(
    val connectionId: String = "",
    val status: String = "linked",
    val institutionName: String? = null,
    val externalAccounts: List<ExternalBankAccount> = emptyList(),
    val existingAutoAccounts: List<ExistingAutoAccount> = emptyList(),
) {
    val accounts: ConnectionAccounts get() = ConnectionAccounts(externalAccounts, existingAutoAccounts)
}

/** One line of `POST …/finalize` (ACC-026). */
@Serializable
data class FinalizeSelection(
    val externalAccountId: String,
    val name: String,
    val type: String,
    val mode: String,
    val existingAccountId: String? = null,
)

/** `{ jobId }` of a started import (201) or manual sync (202). */
@Serializable
data class SyncJobStarted(val jobId: String)

class GoCardlessApi(private val client: ApiClient) {
    @Serializable
    private data class StartBody(val institutionId: String, val institutionName: String, val transactionTotalDays: Int, val client: String)

    @Serializable
    private data class FinalizeBody(val selections: List<FinalizeSelection>)

    suspend fun capacity(): BankCapacity = client.get("api/gocardless/capacity", BankCapacity.serializer())

    suspend fun institutions(country: String): List<Institution> =
        client.get("api/gocardless/institutions", ListSerializer(Institution.serializer()), mapOf("country" to country))

    /** ACC-021: starts a native connection; open `link` in the auth browser session. */
    suspend fun startConnection(institution: Institution): BankConnectionStart {
        val days = (JSNumber.parse(institution.transactionTotalDays) ?: 0.0).toInt()
        val body = client.json.encodeToString(StartBody.serializer(), StartBody(institution.id, institution.name, days, NATIVE_CLIENT))
        return client.post("api/gocardless/connections", body, BankConnectionStart.serializer())
    }

    /** R6: checks the requisition after the browser came back and answers the accounts to select. */
    suspend fun complete(connectionId: String): ConnectionCompletion =
        client.post("api/gocardless/connections/$connectionId/complete", "{}", ConnectionCompletion.serializer())

    suspend fun connectionAccounts(connectionId: String): ConnectionAccounts =
        client.get("api/gocardless/connections/$connectionId/accounts", ConnectionAccounts.serializer())

    /** Not idempotent: never retried automatically. */
    suspend fun finalize(connectionId: String, selections: List<FinalizeSelection>): SyncJobStarted =
        client.post(
            "api/gocardless/connections/$connectionId/finalize",
            client.json.encodeToString(FinalizeBody.serializer(), FinalizeBody(selections)), SyncJobStarted.serializer(),
        )

    /** ACC-043: manual sync of one linked account (202 `{ jobId }`). */
    suspend fun syncAccount(id: String): SyncJobStarted =
        client.post("api/gocardless/accounts/$id/sync", "{}", SyncJobStarted.serializer())

    companion object {
        /** Who completes the consent: the native return (`buddybudget://bank/return`) instead of the web callback. */
        const val NATIVE_CLIENT = "native"
    }
}
