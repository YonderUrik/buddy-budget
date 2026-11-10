package io.buddybudget.core.data

import kotlinx.serialization.Serializable

/**
 * `GET /api/legal` (public): current legal version, clauses approved specifically, document links
 * (spec: api/endpoints/legal.md). Same shape as `LegalMeta` on iOS.
 */
@Serializable
data class LegalMeta(
    val version: String,
    val language: String,
    val specificClauseSections: List<String> = emptyList(),
    val documents: List<Document> = emptyList(),
    val privacyEmail: String = "privacy@buddybudget.io",
) {
    @Serializable data class Document(val id: String, val label: String, val url: String)

    fun document(id: String): Document? = documents.firstOrNull { it.id == id }
}

class LegalApi(private val client: ApiClient) {
    suspend fun get(language: String): LegalMeta = client.get("api/legal", LegalMeta.serializer(), mapOf("language" to language))
}

/** The three declarations of onboarding and of the re-acceptance screen (`legalAcceptanceSchema`). */
@Serializable
data class LegalAcceptance(
    val version: String,
    val ageConfirmed: Boolean = true,
    val termsAccepted: Boolean = true,
    val specificClausesAccepted: Boolean = true,
)

/** UI state of the three checkboxes (AUTH-038, AUTH-044): the payload exists only when all are ticked. */
data class LegalConsent(
    val ageConfirmed: Boolean = false,
    val termsAccepted: Boolean = false,
    val specificClausesAccepted: Boolean = false,
) {
    val isComplete: Boolean get() = ageConfirmed && termsAccepted && specificClausesAccepted

    fun payload(version: String): LegalAcceptance? = if (isComplete) LegalAcceptance(version) else null
}
