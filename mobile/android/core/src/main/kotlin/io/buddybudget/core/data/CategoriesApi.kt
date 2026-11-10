package io.buddybudget.core.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

// Categories and categorization rules (spec: api/endpoints/categories.md, categorization-rules.md).
// Same names on iOS (`CategoriesAPI`, `CategorizationRulesAPI`).

/** `CategoryType` verbatim, with an `unknown` fallback for legacy values (shown under «Altre»). */
@Serializable(with = CategoryTypeSerializer::class)
enum class CategoryType(val raw: String) {
    dovuta("dovuta"), voluta("voluta"), futuro("futuro"), saltuaria("saltuaria"), entrata("entrata"),
    trasferimento("trasferimento"), unknown("unknown");

    val isExpenseGroup: Boolean get() = this in expenseGroups

    /** Italian label (`CATEGORY_TYPE_LABELS`); translate through the catalog. */
    val label: String
        get() = when (this) {
            dovuta -> "Dovute"
            voluta -> "Volute"
            futuro -> "Te futuro"
            saltuaria -> "Saltuarie"
            entrata -> "Entrata"
            trasferimento -> "Trasferimenti tra conti"
            unknown -> "Altre"
        }

    /** Short group description (`EXPENSE_GROUPS.shortDescription`); null for non-expense types. */
    val groupDescription: String?
        get() = when (this) {
            dovuta -> "Necessarie per vivere: senza queste avresti problemi pratici o legali."
            voluta -> "Migliorano la qualità della vita, ma potresti farne a meno."
            futuro -> "Risparmio e investimenti come spesa prioritaria, non come avanzo."
            saltuaria -> "Necessarie ma non mensili: tasse annuali, manutenzioni, regali."
            else -> null
        }

    companion object {
        /** The four spending groups, in display order. */
        val expenseGroups = listOf(dovuta, voluta, futuro, saltuaria)
        /** The six types the user can pick (CAT-018), in display order. */
        val selectable = listOf(dovuta, voluta, futuro, saltuaria, entrata, trasferimento)
    }
}

object CategoryTypeSerializer : KSerializer<CategoryType> {
    override val descriptor = PrimitiveSerialDescriptor("CategoryType", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): CategoryType {
        val raw = decoder.decodeString()
        return CategoryType.entries.firstOrNull { it.raw == raw } ?: CategoryType.unknown
    }
    override fun serialize(encoder: Encoder, value: CategoryType) = encoder.encodeString(value.raw)
}

@Serializable
data class MovementCategory(
    val id: String,
    /** Display name, already localized by the server for default categories (G11): show as is. */
    val name: String,
    val defaultKey: String? = null,
    val type: CategoryType = CategoryType.unknown,
    val color: String = "slate",
    val icon: String = "package",
    val description: String? = null,
    val isFallback: Boolean = false,
    val createdAt: String = "",
) {
    val isTransfer: Boolean get() = !isFallback && type == CategoryType.trasferimento
}

@Serializable
data class CategoryCreateBody(val name: String, val type: CategoryType)

/** `PATCH /api/categories/{id}`; null fields omitted, `description = ""` clears it. */
@Serializable
data class CategoryPatch(
    val name: String? = null,
    val type: CategoryType? = null,
    val color: String? = null,
    val icon: String? = null,
    val description: String? = null,
)

class CategoriesApi(private val client: ApiClient) {
    private fun <T> encode(serializer: KSerializer<T>, value: T): String = client.json.encodeToString(serializer, value)

    suspend fun list(): List<MovementCategory> = client.get("api/categories", ListSerializer(MovementCategory.serializer()))

    /** Movements per category id in the last 365 days (CAT-008). */
    suspend fun usage(): Map<String, Int> = client.get("api/categories/usage", MapSerializer(String.serializer(), Int.serializer()))

    suspend fun create(body: CategoryCreateBody): MovementCategory =
        client.post("api/categories", encode(CategoryCreateBody.serializer(), body), MovementCategory.serializer())

    suspend fun update(id: String, patch: CategoryPatch): MovementCategory =
        client.patch("api/categories/$id", encode(CategoryPatch.serializer(), patch), MovementCategory.serializer())

    suspend fun delete(id: String) = client.sendNoContent("api/categories/$id", "DELETE")

    suspend fun distributeColors() = client.sendNoContent("api/categories/distribute-colors", "POST", "{}")
}

// ---------------------------------------------------------------- Rules

@Serializable
enum class RuleMatchType {
    /** Exact match on the normalized merchant key («Esatta»). */
    merchant,

    /** Substring of the key («Contiene»). */
    contains;

    val label: String get() = if (this == merchant) "Esatta" else "Contiene"
}

@Serializable
data class CategorizationRule(
    val id: String,
    val matchType: RuleMatchType = RuleMatchType.contains,
    val pattern: String,
    val categoryId: String,
    @Serializable(with = BBOptionalAmountSerializer::class) val splitPercentage: Double? = null,
    /** `appresa` | `manuale`. */
    val source: String = "manuale",
    val hitCount: Int = 0,
    val categoryName: String? = null,
    val logoPath: String? = null,
) {
    val isLearned: Boolean get() = source == "appresa"
}

/** POST/PATCH response: the rule plus how many movements it categorized now and how many past ones it would change. */
@Serializable
data class RuleSaveResult(val id: String, val applied: Int = 0, val pastMatches: Int = 0)

@Serializable
data class RuleCreateBody(val matchType: RuleMatchType, val pattern: String, val categoryId: String, val replaceExisting: Boolean? = null)

@Serializable
data class RulePatch(val matchType: RuleMatchType? = null, val pattern: String? = null, val categoryId: String? = null)

class CategorizationRulesApi(private val client: ApiClient) {
    private fun <T> encode(serializer: KSerializer<T>, value: T): String = client.json.encodeToString(serializer, value)

    suspend fun list(): List<CategorizationRule> = client.get("api/categorization-rules", ListSerializer(CategorizationRule.serializer()))

    suspend fun create(body: RuleCreateBody): RuleSaveResult =
        client.post("api/categorization-rules", encode(RuleCreateBody.serializer(), body), RuleSaveResult.serializer())

    suspend fun update(id: String, patch: RulePatch): RuleSaveResult =
        client.patch("api/categorization-rules/$id", encode(RulePatch.serializer(), patch), RuleSaveResult.serializer())

    suspend fun delete(id: String) = client.sendNoContent("api/categorization-rules/$id", "DELETE")
}

// ---------------------------------------------------------------- Budgets (CAT-099…101, web #432; api/endpoints/budgets.md)

/** A monthly budget of one category (`monthlyAmount` arrives as a decimal string). */
@Serializable
data class Budget(
    val id: String = "",
    val categoryId: String,
    @Serializable(with = BBAmountSerializer::class) val monthlyAmount: Double = 0.0,
)

class BudgetsApi(private val client: ApiClient) {
    @Serializable private data class UpsertBody(val monthlyAmount: Double)

    suspend fun list(): List<Budget> = client.get("api/budgets", ListSerializer(Budget.serializer()))

    /** `PUT /api/budgets/{categoryId}` (upsert). */
    suspend fun upsert(categoryId: String, monthlyAmount: Double): Budget =
        client.send("api/budgets/$categoryId", "PUT", body = client.json.encodeToString(UpsertBody.serializer(), UpsertBody(monthlyAmount)))
            .let { client.json.decodeFromString(Budget.serializer(), it.text) }

    /** `DELETE /api/budgets/{categoryId}` → 204 (idempotent). */
    suspend fun remove(categoryId: String) = client.sendNoContent("api/budgets/$categoryId", "DELETE")
}
