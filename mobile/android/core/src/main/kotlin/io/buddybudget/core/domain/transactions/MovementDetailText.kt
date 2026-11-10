package io.buddybudget.core.domain.transactions

import io.buddybudget.core.data.CategorySource
import io.buddybudget.core.data.DetailRule
import io.buddybudget.core.data.MovementOrigin
import io.buddybudget.core.data.SingleSuggestion
import io.buddybudget.core.domain.categorization.CategorizationText

/**
 * Sentences of the movement detail (TX-064…073, web #455 `lib/transactions/detail-text.ts`): where the movement came
 * from, who chose its category and what «Chiedi all'AI» answered. Italian catalog sources; `tr` translates a source
 * with its `{0}` values, so every language reads as on the web. Same names on iOS (`MovementDetailText`).
 */
object MovementDetailText {
    /** TX-069: where the movement came from, in one short sentence. */
    fun originText(origin: MovementOrigin, tr: (String, Map<String, String>) -> String): String = when (origin.kind) {
        "banca" -> origin.institution?.takeIf { it.isNotEmpty() }?.let { tr("Dalla banca collegata, {0}", mapOf("0" to it)) }
            ?: tr("Dalla banca collegata", emptyMap())
        "file" -> origin.format?.takeIf { it.isNotEmpty() }?.let { tr("Da un file importato, formato «{0}»", mapOf("0" to it)) }
            ?: tr("Da un file importato", emptyMap())
        "broker" -> tr("Dall'estratto conto di {0}", mapOf("0" to (origin.broker ?: "")))
        "esempio" -> tr("Dai dati d'esempio", emptyMap())
        else -> tr("Aggiunto da te", emptyMap())
    }

    /**
     * TX-067: who chose the category — one of the user's rules (named when it still matches), the bank's category in an
     * imported file, the app from past choices or the AI, or the user. Null when nothing is known (legacy rows) or the
     * movement is still on the fallback, whose name already says so.
     */
    fun categoryOriginText(
        source: CategorySource?,
        confidence: Double?,
        rule: DetailRule?,
        uncategorized: Boolean,
        bankCategory: String?,
        tr: (String, Map<String, String>) -> String,
    ): String? {
        if (uncategorized) return null
        return when (source) {
            CategorySource.utente -> tr("Scelta da te", emptyMap())
            CategorySource.regola -> when {
                rule == null -> CategorizationText.autoOriginDescription(source, null, null, tr)
                rule.matchType == "contains" -> tr("Messa dalla tua regola: il testo contiene «{0}»", mapOf("0" to rule.pattern))
                else -> tr("Messa dalla tua regola per «{0}»", mapOf("0" to rule.pattern))
            }
            CategorySource.banca, CategorySource.storico, CategorySource.assistente ->
                CategorizationText.autoOriginDescription(source, confidence, bankCategory, tr)
            else -> null
        }
    }

    /** TX-071: «12 movimenti nell'ultimo anno». */
    fun merchantCountSource(count: Int): Pair<String, Map<String, String>> = "{0} movimenti nell'ultimo anno" to mapOf("0" to count.toString())

    /** What «Chiedi all'AI» says when it has no category to propose (TX-068); null for an `ok` answer. */
    fun aiNoAnswerSource(status: String): String? = when (status) {
        "ok" -> null
        "blocked" -> "Sembra un trasferimento o un pagamento a una persona: per riservatezza non lo mandiamo all'AI."
        "limited" -> "Hai chiesto molte volte nell'ultima ora: riprova più tardi."
        "disabled" -> "L'assistente per le categorie è spento."
        else -> "L'AI non ha risposto. Riprova tra poco."
    }

    /** The answer of «Chiedi all'AI» as the detail shows it. */
    sealed class AiAnswer {
        /** The AI agrees with the current category. */
        data object Agrees : AiAnswer()
        /** Another category, with its confidence as a whole percentage. */
        data class Proposes(val categoryId: String, val percent: Int) : AiAnswer()
        /** No category: the message source (`aiNoAnswerSource`) and whether to point to the setting. */
        data class Message(val source: String, val offersSettings: Boolean) : AiAnswer()
    }

    /**
     * TX-068: turns a server answer into what the detail shows. An `ok` answer naming a category the movement cannot take
     * (unknown or not selectable) counts as no answer.
     */
    fun aiAnswer(result: SingleSuggestion, currentCategoryId: String?, selectableIds: Set<String>): AiAnswer {
        if (result.status == "ok") {
            val id = result.categoryId
            if (id != null && id in selectableIds) {
                return if (id == currentCategoryId) AiAnswer.Agrees else AiAnswer.Proposes(id, CategorizationText.confidencePercent(result.confidence))
            }
            return AiAnswer.Message(aiNoAnswerSource("failed")!!, false)
        }
        return AiAnswer.Message(aiNoAnswerSource(result.status)!!, result.status == "disabled")
    }

    /** The answer shown without calling the server when the assistant is switched off in Settings. */
    val aiOff: AiAnswer get() = AiAnswer.Message(aiNoAnswerSource("disabled")!!, true)
}
