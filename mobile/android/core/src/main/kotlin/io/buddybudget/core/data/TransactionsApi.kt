package io.buddybudget.core.data

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.liquidity.MovementFields
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

// Transactions, categorize and recategorize (spec: api/endpoints/transactions.md). Same names on iOS (`TransactionsAPI`).

/**
 * Money arrives as a decimal string (`"-42.90"`) or a JSON number (api/README.md); both decode to `Double` with JS
 * `Number(...)` semantics. Unparsable → 0.
 */
object BBAmountSerializer : KSerializer<Double> {
    override val descriptor = PrimitiveSerialDescriptor("BBAmount", PrimitiveKind.DOUBLE)
    override fun deserialize(decoder: Decoder): Double {
        val element = (decoder as? JsonDecoder)?.decodeJsonElement() ?: return decoder.decodeDouble()
        val primitive = element as? JsonPrimitive ?: return 0.0
        if (primitive is JsonNull) return 0.0
        return if (primitive.isString) JSNumber.parse(primitive.content) ?: 0.0 else primitive.doubleOrNull ?: 0.0
    }
    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

/** Nullable variant of [BBAmountSerializer] (`categoryConfidence`, `splitPercentage`). */
object BBOptionalAmountSerializer : KSerializer<Double?> {
    override val descriptor = PrimitiveSerialDescriptor("BBOptionalAmount", PrimitiveKind.DOUBLE)
    override fun deserialize(decoder: Decoder): Double? {
        val element = (decoder as? JsonDecoder)?.decodeJsonElement() ?: return decoder.decodeDouble()
        val primitive = element as? JsonPrimitive ?: return null
        if (primitive is JsonNull) return null
        return if (primitive.isString) JSNumber.parse(primitive.content) else primitive.doubleOrNull
    }
    override fun serialize(encoder: Encoder, value: Double?) {
        if (value == null) encoder.encodeNull() else encoder.encodeDouble(value)
    }
}

/** `categorySource`: who set the category. `null` = legacy or still on the fallback. */
@Serializable
enum class CategorySource {
    regola, storico, assistente, utente, banca, unknown;

    /** The automatic origins (rule, past choices, assistant, bank category from an imported file — web #456). */
    val isAutomatic: Boolean get() = this == regola || this == storico || this == assistente || this == banca
}

/** `manuale` = entered by hand or imported from a file; `auto` = bank sync (read-only fields). */
@Serializable
enum class TransactionOrigin { manuale, auto, unknown }

/** A movement as listed by `GET /api/transactions` (`ListedTransaction`). Amounts are signed (expense < 0). */
@Serializable
data class Movement(
    val id: String,
    override val accountId: String? = null,
    override val categoryId: String? = null,
    override val description: String = "",
    val rawDescription: String? = null,
    override val note: String? = null,
    @Serializable(with = BBAmountSerializer::class) override val amount: Double = 0.0,
    @Serializable(with = BBAmountSerializer::class) override val excludedAmount: Double = 0.0,
    val categorySource: CategorySource? = null,
    @Serializable(with = BBOptionalAmountSerializer::class) val categoryConfidence: Double? = null,
    /** `YYYY-MM-DD`. */
    override val date: String,
    val source: TransactionOrigin = TransactionOrigin.manuale,
    val logoPath: String? = null,
    /** The bank's own category label read from an imported file (origin `banca`, web #456). */
    val bankCategory: String? = null,
    /** Merchant category code from the bank (TX-069). */
    val merchantCategoryCode: String? = null,
    /** ISO timestamp the movement was recorded (`Registrato il`, TX-069). */
    val createdAt: String? = null,
) : MovementFields {
    /** `amount − excludedAmount`: what counts in every total (TX-061). */
    val effectiveAmount: Double get() = JSNumber.round2(amount - excludedAmount)
    val isManual: Boolean get() = source != TransactionOrigin.auto
}

/** Paged response (`limit`/`cursor`). */
@Serializable
data class MovementPage(val items: List<Movement> = emptyList(), val nextCursor: String? = null)

/** `type` filter of the feed (TX-015). */
enum class MovementType { tutte, uscita, entrata }

/** The Movimenti filters (TX-013…017), sent to the paged endpoint. Filters combine with AND. */
data class TransactionQuery(
    val type: MovementType = MovementType.tutte,
    val accountId: String? = null,
    val categoryId: String? = null,
    val search: String = "",
    val uncategorized: Boolean = false,
    val limit: Int = 50,
    /** First day (`YYYY-MM-DD`, inclusive); null = all history. */
    val from: String? = null,
) {
    /** True when any filter beyond the defaults is active (empty-state choice, TX-021/022). */
    val hasFilters: Boolean
        get() = type != MovementType.tutte || accountId != null || categoryId != null || JSNumber.trim(search).isNotEmpty() || uncategorized

    fun queryItems(cursor: String?): Map<String, String> = buildMap {
        put("limit", limit.toString())
        put("type", type.name)
        accountId?.let { put("accountId", it) }
        categoryId?.let { put("categoryId", it) }
        JSNumber.trim(search).takeIf { it.isNotEmpty() }?.let { put("q", it) }
        if (uncategorized) put("uncategorized", "1")
        from?.let { put("from", it) }
        cursor?.let { put("cursor", it) }
    }
}

/** `POST /api/transactions` (TX-042…048). `amount` is the positive magnitude. */
@Serializable
data class CreateTransactionBody(
    val accountId: String,
    val description: String,
    val categoryId: String,
    val amount: Double,
    val direction: String,
    val date: String,
)

/** `PATCH /api/transactions/{id}`; null fields are omitted. `note = ""` clears the note. */
@Serializable
data class TransactionPatch(
    val description: String? = null,
    val categoryId: String? = null,
    val amount: Double? = null,
    val date: String? = null,
    val excludedAmount: Double? = null,
    val note: String? = null,
)

// ---------------------------------------------------------------- Categorize

@Serializable
data class CategorizeSuggestion(
    val suggestedCategoryId: String,
    val source: CategorySource = CategorySource.unknown,
    val confidence: Double = 0.0,
    val suggestedSplitPercentage: Double? = null,
    val history: History? = null,
    val rulePattern: String? = null,
) {
    @Serializable
    data class History(val agreeing: Int, val total: Int)
}

/** Fallback movements of one merchant and direction (`SuggestionGroup`). */
@Serializable
data class SuggestionGroup(
    val groupKey: String,
    val merchantKey: String,
    val label: String,
    val transactionIds: List<String>,
    val transactionDescriptions: List<String> = emptyList(),
    val transactionDates: List<String> = emptyList(),
    val transactionAmounts: List<Double> = emptyList(),
    val totalAmount: Double = 0.0,
    val suggestion: CategorizeSuggestion? = null,
    val hasDivergentSuggestions: Boolean = false,
    val logoPath: String? = null,
) {
    val id: String get() = groupKey
    val isIncome: Boolean get() = groupKey.endsWith("::entrata")
}

@Serializable
data class CategorizeSuggestionsResponse(val groups: List<SuggestionGroup> = emptyList(), val autoApply: AutoApply = AutoApply()) {
    @Serializable
    data class AutoApply(val enabled: Boolean = false, val ready: Int = 0, val readyKeys: List<String> = emptyList())
}

@Serializable
data class CategorizeAutoResult(val applied: Int = 0, val groups: Int = 0)

/** One group of `POST /api/transactions/categorize-apply`. */
@Serializable
data class CategorizeApplyGroup(
    val transactionIds: List<String>,
    val categoryId: String,
    val excludedPercentage: Double,
    val createRule: Boolean,
    val merchantKey: String,
)

@Serializable
data class CategorizeApplyResult(val applied: Int = 0, val rulesCreated: Int = 0)

/** «Messe dall'app» group (merchant + direction + category + origin). */
@Serializable
data class AutoCategorizedGroup(
    val groupKey: String,
    val merchantKey: String,
    val label: String,
    val categoryId: String,
    val source: CategorySource = CategorySource.unknown,
    val confidence: Double? = null,
    val transactionIds: List<String>,
    val transactionDescriptions: List<String> = emptyList(),
    val transactionDates: List<String> = emptyList(),
    val transactionAmounts: List<Double> = emptyList(),
    val totalAmount: Double = 0.0,
    val lastCategorizedAt: String,
    val logoPath: String? = null,
    /** Label the bank wrote in the imported file, for origin `banca`. */
    val bankCategory: String? = null,
) {
    val id: String get() = groupKey
}

/** `GET /api/transactions/auto-categorized`: the last 30 days (web #456: a history, nothing to confirm). */
@Serializable
data class AutoCategorizedResponse(val groups: List<AutoCategorizedGroup> = emptyList(), val total: Int = 0)

// ---------------------------------------------------------------- Movement detail (TX-064…073, web #455)

/** Where a movement came from (`TransactionOrigin` of `lib/transactions/detail.ts`). */
@Serializable
data class MovementOrigin(
    val kind: String = "manuale",
    val institution: String? = null,
    val format: String? = null,
    val broker: String? = null,
)

/** The rule that set the category, when it still points to the same category. */
@Serializable
data class DetailRule(val id: String, val matchType: String = "merchant", val pattern: String = "")

@Serializable
data class MerchantMovement(val id: String, val date: String, @Serializable(with = BBAmountSerializer::class) val amount: Double = 0.0)

/** The same merchant over the last year. */
@Serializable
data class MerchantSummary(val count: Int = 0, @Serializable(with = BBAmountSerializer::class) val total: Double = 0.0, val recent: List<MerchantMovement> = emptyList())

/** `GET /api/transactions/{id}`. */
@Serializable
data class MovementDetail(
    val transaction: Movement,
    val account: Account? = null,
    val origin: MovementOrigin = MovementOrigin(),
    val rule: DetailRule? = null,
    val merchant: MerchantSummary? = null,
) {
    @Serializable
    data class Account(val id: String, val name: String = "")
}

/** `POST /api/transactions/{id}/ai-suggestion`: `ok` (with category and confidence), `disabled`, `no_key`, `blocked`, `limited`, `failed`. */
@Serializable
data class SingleSuggestion(val status: String = "failed", val categoryId: String? = null, val confidence: Double = 0.0)

@Serializable
data class RecategorizeGroup(
    val key: String,
    val label: String,
    val fromCategoryId: String,
    val toCategoryId: String,
    val source: CategorySource = CategorySource.unknown,
    val confidence: Double? = null,
    val count: Int = 0,
    val legacyCount: Int = 0,
    val firstDate: String = "",
    val lastDate: String = "",
    val totalAmount: Double = 0.0,
    val logoPath: String? = null,
) {
    val id: String get() = key
}

@Serializable
data class RecategorizePreview(
    val groups: List<RecategorizeGroup> = emptyList(),
    val changes: Int = 0,
    val legacyChanges: Int = 0,
    val autoApply: Boolean = false,
    val lastRun: LastRun? = null,
) {
    @Serializable
    data class LastRun(val id: String, val changed: Int = 0, val createdAt: String = "")
}

@Serializable
data class RecategorizeBody(
    val scope: String,
    val includeLegacy: Boolean? = null,
    val ruleId: String? = null,
    val groupKeys: List<String>? = null,
)

@Serializable
data class RecategorizeResult(val runId: String? = null, val changed: Int = 0)

// ---------------------------------------------------------------- API

class TransactionsApi(private val client: ApiClient) {
    @Serializable private data class Status(val status: String = "")
    @Serializable private data class Restored(val restored: Int = 0)
    @Serializable private data class ApplyBody(val groups: List<CategorizeApplyGroup>)
    @Serializable private data class UndoBody(val runId: String)

    private fun <T> encode(serializer: KSerializer<T>, value: T): String = client.json.encodeToString(serializer, value)

    /** `GET /api/transactions?limit&cursor&…` (paged mode, TX-007 mobile). */
    suspend fun page(query: TransactionQuery, cursor: String? = null): MovementPage =
        client.get("api/transactions", MovementPage.serializer(), query.queryItems(cursor))

    suspend fun create(body: CreateTransactionBody): Movement =
        client.post("api/transactions", encode(CreateTransactionBody.serializer(), body), Movement.serializer())

    suspend fun update(id: String, patch: TransactionPatch): Movement =
        client.patch("api/transactions/$id", encode(TransactionPatch.serializer(), patch), Movement.serializer())

    suspend fun delete(id: String) = client.sendNoContent("api/transactions/$id", "DELETE")

    /** TX-004: best effort, the caller ignores failures. */
    suspend fun markSeen() = client.sendNoContent("api/transactions/attention/seen", "POST", "{}")

    suspend fun suggestions(): CategorizeSuggestionsResponse =
        client.get("api/transactions/categorize-suggestions", CategorizeSuggestionsResponse.serializer())

    suspend fun categorizeAuto(): CategorizeAutoResult =
        client.post("api/transactions/categorize-auto", "{}", CategorizeAutoResult.serializer())

    suspend fun categorizeApply(groups: List<CategorizeApplyGroup>): CategorizeApplyResult =
        client.post("api/transactions/categorize-apply", encode(ApplyBody.serializer(), ApplyBody(groups)), CategorizeApplyResult.serializer())

    /** `started` | `disabled` | `no_key`. */
    suspend fun generateSuggestions(): String =
        client.post("api/transactions/categorize-suggestions/generate", "{}", Status.serializer()).status

    suspend fun autoCategorized(): AutoCategorizedResponse =
        client.get("api/transactions/auto-categorized", AutoCategorizedResponse.serializer())

    /** TX-064: one movement with origin, account, rule and merchant summary; `ApiError.Http` 404 when it no longer exists. */
    suspend fun detail(id: String): MovementDetail = client.get("api/transactions/$id", MovementDetail.serializer())

    /** TX-068: «Chiedi all'AI», writes nothing. */
    suspend fun aiSuggestion(id: String): SingleSuggestion =
        client.post("api/transactions/$id/ai-suggestion", "{}", SingleSuggestion.serializer())

    suspend fun recategorizePreview(scope: String = "tutto", ruleId: String? = null, legacy: Boolean = true): RecategorizePreview {
        val query = buildMap {
            if (scope == "regola") {
                put("scope", "regola")
                ruleId?.let { put("ruleId", it) }
            } else if (legacy) {
                put("legacy", "1")
            }
        }
        return client.get("api/transactions/recategorize", RecategorizePreview.serializer(), query)
    }

    suspend fun recategorize(body: RecategorizeBody): RecategorizeResult =
        client.post("api/transactions/recategorize", encode(RecategorizeBody.serializer(), body), RecategorizeResult.serializer())

    suspend fun undoRecategorize(runId: String): Int =
        client.post("api/transactions/recategorize/undo", encode(UndoBody.serializer(), UndoBody(runId)), Restored.serializer()).restored

    companion object {
        val listSerializer = ListSerializer(Movement.serializer())
    }
}
