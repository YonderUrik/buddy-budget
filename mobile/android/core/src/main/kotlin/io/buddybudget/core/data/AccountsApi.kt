package io.buddybudget.core.data

import io.buddybudget.core.domain.liquidity.ConnectionHealthState
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.jsonPrimitive

// Accounts (spec: api/endpoints/accounts.md). Same names on iOS (`AccountsAPI`, `Account`, …).

/** `manuale`: kept by the user; `auto`: linked to a bank through GoCardless. */
enum class AccountSource(val key: String) {
    Manuale("manuale"), Auto("auto");

    companion object {
        fun of(key: String?): AccountSource = entries.firstOrNull { it.key == key } ?: Manuale
    }
}

/** Tone of the status line under an account name (`AccountExtras.status.tone`). */
enum class AccountStatusTone(val key: String) {
    Ok("ok"), Warning("warning"), Progress("progress"), Neutral("neutral");

    companion object {
        fun of(key: String?): AccountStatusTone = entries.firstOrNull { it.key == key } ?: Neutral
    }
}

/** Localized status line computed by the server (`include=health`), e.g. «Aggiornato 3 ore fa», «Da riconnettere». */
data class AccountStatusLine(val tone: AccountStatusTone, val label: String)

/** Bank-connection health of a linked account (`AccountExtras.health`): consent state and manual-sync availability. */
data class AccountHealth(
    val connectionId: String,
    val institutionName: String,
    val state: ConnectionHealthState,
    val needsRenewal: Boolean,
    val daysLeft: Int? = null,
    val consentExpiresAt: String? = null,
    val lastSyncedAt: String? = null,
    val syncing: Boolean = false,
    val eligible: Boolean = false,
    val nextEligibleAt: String? = null,
    val syncsRemainingToday: Int = 0,
)

/** An account row (`Account & AccountExtras` with `include=trend,health`). `balance` arrives as a decimal string. */
data class Account(
    val id: String,
    val name: String,
    val type: String,
    val balance: Double,
    val color: String = "slate",
    val icon: String = "wallet",
    val source: AccountSource = AccountSource.Manuale,
    val isDemo: Boolean = false,
    val createdAt: String = "",
    val updatedAt: String = "",
    /** Institution of a linked account; null for manual ones (and linked ones without a connection). */
    val bankName: String? = null,
    /** 31 end-of-day balances (oldest first), linked accounts only. */
    val trend: List<Double>? = null,
    val health: AccountHealth? = null,
    val status: AccountStatusLine? = null,
    /** The balance moves with the transactions (linked bank or file import, web #447); null when the server omits it. */
    val followsTransactions: Boolean? = null,
) {
    val isLinked: Boolean get() = source == AccountSource.Auto
}

/** A JSON money value sent as a number or a decimal string ("1234.50"). */
object MoneyValueSerializer : KSerializer<Double> {
    override val descriptor = PrimitiveSerialDescriptor("MoneyValue", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        val element = (decoder as? JsonDecoder)?.decodeJsonElement()?.jsonPrimitive ?: return decoder.decodeDouble()
        return element.content.trim().toDoubleOrNull() ?: throw IllegalArgumentException("Not a money value: ${element.content}")
    }

    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

@Serializable
internal data class AccountStatusRaw(val tone: String = "neutral", val label: String = "")

@Serializable
internal data class AccountHealthRaw(
    val connectionId: String,
    val institutionName: String = "",
    val state: String = "ok",
    val needsRenewal: Boolean = false,
    val daysLeft: Int? = null,
    val consentExpiresAt: String? = null,
    val lastSyncedAt: String? = null,
    val syncing: Boolean = false,
    val eligible: Boolean = false,
    val nextEligibleAt: String? = null,
    val syncsRemainingToday: Int = 0,
)

@Serializable
internal data class AccountRaw(
    val id: String,
    val name: String,
    val type: String = "",
    @Serializable(with = MoneyValueSerializer::class) val balance: Double = 0.0,
    val color: String = "slate",
    val icon: String = "wallet",
    val source: String = "manuale",
    val isDemo: Boolean = false,
    val createdAt: String = "",
    val updatedAt: String = "",
    val bankName: String? = null,
    val trend: List<@Serializable(with = MoneyValueSerializer::class) Double>? = null,
    val health: AccountHealthRaw? = null,
    val status: AccountStatusRaw? = null,
    val followsTransactions: Boolean? = null,
) {
    fun toAccount() = Account(
        id = id, name = name, type = type, balance = balance, color = color, icon = icon, source = AccountSource.of(source),
        isDemo = isDemo, createdAt = createdAt, updatedAt = updatedAt, bankName = bankName, trend = trend,
        health = health?.let { h ->
            AccountHealth(
                h.connectionId, h.institutionName, ConnectionHealthState.entries.firstOrNull { it.key == h.state } ?: ConnectionHealthState.OK,
                h.needsRenewal, h.daysLeft, h.consentExpiresAt, h.lastSyncedAt, h.syncing, h.eligible, h.nextEligibleAt, h.syncsRemainingToday,
            )
        },
        status = status?.let { AccountStatusLine(AccountStatusTone.of(it.tone), it.label) },
        followsTransactions = followsTransactions,
    )
}

/** `GET /api/accounts` decoder (also used by tests with the fixtures). */
object AccountListSerializer : KSerializer<List<Account>> {
    private val raw = ListSerializer(AccountRaw.serializer())
    override val descriptor = raw.descriptor
    override fun deserialize(decoder: Decoder): List<Account> = raw.deserialize(decoder).map { it.toAccount() }
    override fun serialize(encoder: Encoder, value: List<Account>) = throw UnsupportedOperationException()
}

object AccountSerializer : KSerializer<Account> {
    private val raw = AccountRaw.serializer()
    override val descriptor = raw.descriptor
    override fun deserialize(decoder: Decoder): Account = raw.deserialize(decoder).toAccount()
    override fun serialize(encoder: Encoder, value: Account) = throw UnsupportedOperationException()
}

/** `POST /api/accounts` (ACC-030). `balance` is a JSON number. */
@Serializable
data class NewAccountRequest(val name: String, val type: String, val balance: Double, val color: String?, val icon: String?)

/** `PATCH /api/accounts/{id}`: only the set fields are sent (linked accounts must never send `type`/`balance`, ACC-035). */
@Serializable
data class AccountPatch(
    val name: String? = null,
    val type: String? = null,
    val balance: Double? = null,
    val color: String? = null,
    val icon: String? = null,
)

class AccountsApi(private val client: ApiClient) {
    /** `GET /api/accounts?include=trend,health&today=<device day>` (ACC-001…004). */
    suspend fun list(today: CalendarDate): List<Account> =
        client.get("api/accounts", AccountListSerializer, mapOf("include" to "trend,health", "today" to today.iso))

    suspend fun create(request: NewAccountRequest): Account =
        client.post("api/accounts", client.json.encodeToString(NewAccountRequest.serializer(), request), AccountSerializer)

    suspend fun update(id: String, patch: AccountPatch): Account =
        client.patch("api/accounts/$id", client.json.encodeToString(AccountPatch.serializer(), patch), AccountSerializer)

    /** Deletes a manual account or unlinks a bank one, with all its movements (ACC-041). */
    suspend fun delete(id: String) = client.sendNoContent("api/accounts/$id", "DELETE")
}
