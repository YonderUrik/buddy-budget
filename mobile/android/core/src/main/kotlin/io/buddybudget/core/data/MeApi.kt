package io.buddybudget.core.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** Gate the backend asks the app to show (`bootstrap.gate`, spec: api/endpoints/me.md). `null` = app usable. */
@Serializable(with = AccountGateSerializer::class)
enum class AccountGate(val raw: String) {
    AccountDeactivated("account_deactivated"),
    LegalAcceptanceRequired("legal_acceptance_required"),
    OnboardingRequired("onboarding_required"),
    Unknown("unknown"),
}

object AccountGateSerializer : KSerializer<AccountGate> {
    override val descriptor = PrimitiveSerialDescriptor("AccountGate", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): AccountGate {
        val raw = decoder.decodeString()
        return AccountGate.entries.firstOrNull { it.raw == raw } ?: AccountGate.Unknown
    }
    override fun serialize(encoder: Encoder, value: AccountGate) = encoder.encodeString(value.raw)
}

/** `GET /api/me/bootstrap`: everything the app needs at launch to route the signed-in user. Same shape as on iOS. */
@Serializable
data class MeBootstrap(
    val user: User,
    val profile: Profile,
    val onboarding: Onboarding,
    val legal: Legal,
    val account: Account,
    val gate: AccountGate? = null,
    val capabilities: Capabilities,
    val session: Session,
) {
    @Serializable data class User(val id: String, val name: String = "", val email: String, val image: String? = null)

    @Serializable
    data class Profile(
        val productCountry: String,
        val language: String,
        val availableLanguages: List<String> = emptyList(),
        val currency: String,
        val homePage: String,
        val hideAmounts: Boolean = false,
    )

    @Serializable data class Onboarding(val completed: Boolean)

    @Serializable
    data class Legal(
        val currentVersion: String,
        val acceptedVersion: String? = null,
        val acceptedAt: String? = null,
        val needsAcceptance: Boolean,
    )

    @Serializable
    data class Account(val deactivated: Boolean, val deletionScheduledAt: String? = null, val readOnlyDemo: Boolean = false)

    @Serializable
    data class Features(
        val taxes: Boolean = true,
        val pension: Boolean = true,
        val retirement: Boolean = true,
        val incomeForecasts: Boolean = true,
        val inflation: Boolean = true,
    )

    /** `isCountryPathAvailable(country, path)` evaluated by the server: what to show and call. */
    @Serializable
    data class Sections(
        val pension: Boolean = true,
        val analytics: Boolean = true,
        val goals: Boolean = true,
        val investmentTaxes: Boolean = true,
        val investmentIncome: Boolean = true,
        val fire: Boolean = true,
        val financialPlanning: Boolean = true,
    )

    @Serializable data class Capabilities(val features: Features = Features(), val sections: Sections = Sections())

    @Serializable data class Session(val createdAt: String, val expiresAt: String, val recentLoginUntil: String)
}

class MeApi(private val client: ApiClient) {
    suspend fun bootstrap(): MeBootstrap = client.get("api/me/bootstrap", MeBootstrap.serializer())
}
