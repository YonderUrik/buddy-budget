package io.buddybudget.core.domain.transactions

import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.domain.format.JSNumber
import java.text.Collator
import java.text.Normalizer
import java.util.Locale

/**
 * Category rules shared by Movimenti, the add form and Categorizza (`lib/categorization/match-rule.ts`,
 * `lib/categories/picker.ts`). Same names on iOS.
 */
object CategoryRules {
    /** CAT-004 (`isDirectionCompatible`): fallback and transfers accept both signs, `entrata` only income, the rest only expenses. */
    fun isDirectionCompatible(type: CategoryType, isIncome: Boolean, isFallback: Boolean): Boolean {
        if (isFallback || type == CategoryType.trasferimento) return true
        return (type == CategoryType.entrata) == isIncome
    }

    /** TX-028: the fallback, every transfer category and the categories of the movement's direction. */
    fun pickerCategories(categories: List<MovementCategory>, amount: Double): List<MovementCategory> {
        val isIncome = amount > 0
        return categories.filter { c ->
            if (c.isFallback || c.type == CategoryType.trasferimento) true
            else if (isIncome) c.type == CategoryType.entrata else c.type != CategoryType.entrata
        }
    }

    /** Add form (web `availableCategories`): transfer categories plus the direction's categories. */
    fun addFormCategories(categories: List<MovementCategory>, isIncome: Boolean): List<MovementCategory> =
        categories.filter { c ->
            c.type == CategoryType.trasferimento || (if (isIncome) c.type == CategoryType.entrata else c.type != CategoryType.entrata)
        }

    /** Categorizza card sheet (CAT-059): non-fallback, same direction, without the proposed one. */
    fun categorizeCategories(categories: List<MovementCategory>, isIncome: Boolean, excluding: String?): List<MovementCategory> =
        categories.filter { c ->
            !c.isFallback && c.id != excluding && c.type != CategoryType.trasferimento &&
                isDirectionCompatible(c.type, isIncome, false)
        }

    /** TX-043 (`pickDefaultCategoryId`): the most used, else the first by name; never the fallback if an alternative exists. */
    fun pickDefaultCategoryId(categories: List<MovementCategory>, usage: Map<String, Int>): String? {
        val regular = categories.filter { !it.isFallback }
        val pool = regular.ifEmpty { categories }
        return CategoryPicker.sortedByUsageThenName(pool, usage).firstOrNull()?.id
    }
}

/** How a movement row looks (TX-023…026). */
enum class MovementKind {
    /** Category type `trasferimento`: full amount in neutral colour + «Escluso dai conteggi»; no «Dividi». */
    Transfer,

    /** On the fallback category: highlighted row, category name in the negative colour. */
    Uncategorized,

    /** Part excluded with «Dividi»: effective amount + the full amount struck through. */
    Split,
    Plain;

    companion object {
        fun of(movement: Movement, category: MovementCategory?): MovementKind = when {
            category?.isTransfer == true -> Transfer
            category?.isFallback == true -> Uncategorized
            movement.excludedAmount != 0.0 -> Split
            else -> Plain
        }
    }
}

/** One section of the category sheet / picker (`CategoryPickerSection`). */
data class CategoryPickerSection(
    /** `most-used`, `type-<type>`, `type-other`, `fallback`, `results`. */
    val key: String,
    /** Italian label (translate through the catalog); null = no header (search results, fallback). */
    val label: String?,
    val categories: List<MovementCategory>,
)

/** Category picker logic, ported 1:1 from `lib/categories/picker.ts` (CAT-090…092, TX-028). Same as Swift. */
object CategoryPicker {
    const val MOST_USED_LIMIT = 5
    const val MOST_USED_MIN_TOTAL = 8

    private val italian: Collator get() = Collator.getInstance(Locale.ITALIAN).apply { strength = Collator.TERTIARY }

    /** `a.localeCompare(b, "it")`. */
    fun localeCompareIt(a: String, b: String): Int = italian.compare(a, b)

    /** Lower case, no accents, trimmed: "Caffè " → "caffe" (`normalizeForSearch`). */
    fun normalizeForSearch(value: String): String =
        JSNumber.trim(Normalizer.normalize(value, Normalizer.Form.NFD).filterNot { it.code in 0x0300..0x036F }.lowercase())

    fun sortedByUsageThenName(categories: List<MovementCategory>, usage: Map<String, Int>): List<MovementCategory> =
        categories.sortedWith { a, b ->
            val diff = (usage[b.id] ?: 0) - (usage[a.id] ?: 0)
            if (diff != 0) diff else localeCompareIt(a.name, b.name)
        }

    /** Relevance of a category for a query (lower = better), null when it does not match (CAT-091). */
    internal fun searchRank(category: MovementCategory, normalizedQuery: String): Int? {
        val name = normalizeForSearch(category.name)
        val terms = normalizedQuery.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (terms.all { name.contains(it) }) {
            if (name.startsWith(normalizedQuery)) return 0
            val words = name.split(Regex("[^a-z0-9]+"))
            if (terms.all { term -> words.any { it.startsWith(term) } }) return 1
            return 2
        }
        if (category.isFallback) return null
        val group = if (category.type == CategoryType.unknown) "" else normalizeForSearch(category.type.label)
        if (group.isNotEmpty() && group.startsWith(normalizedQuery)) return 3
        return null
    }

    /**
     * Sections to show (`buildCategoryPickerSections`). With a query: one unnamed section ranked by relevance, then usage,
     * then name. Without: most-used (≥ 8 categories and some usage), one section per group (alphabetical), unknown types
     * under «Altre», the fallback last without a header.
     */
    fun sections(
        categories: List<MovementCategory>,
        usage: Map<String, Int>,
        query: String,
        mostUsedLimit: Int = MOST_USED_LIMIT,
    ): List<CategoryPickerSection> {
        val normalizedQuery = normalizeForSearch(query)
        if (normalizedQuery.isNotEmpty()) {
            val ranked = categories.mapNotNull { c -> searchRank(c, normalizedQuery)?.let { c to it } }
                .sortedWith { a, b ->
                    if (a.second != b.second) {
                        a.second - b.second
                    } else {
                        val diff = (usage[b.first.id] ?: 0) - (usage[a.first.id] ?: 0)
                        if (diff != 0) diff else localeCompareIt(a.first.name, b.first.name)
                    }
                }.map { it.first }
            return if (ranked.isEmpty()) emptyList() else listOf(CategoryPickerSection("results", null, ranked))
        }
        val sections = mutableListOf<CategoryPickerSection>()
        val regular = categories.filter { !it.isFallback }
        if (categories.size >= MOST_USED_MIN_TOTAL) {
            val mostUsed = sortedByUsageThenName(regular.filter { (usage[it.id] ?: 0) > 0 }, usage).take(mostUsedLimit)
            if (mostUsed.isNotEmpty()) sections += CategoryPickerSection("most-used", "Più usate", mostUsed)
        }
        val alphabetical = regular.sortedWith { a, b -> localeCompareIt(a.name, b.name) }
        val groupTypes = CategoryType.expenseGroups + listOf(CategoryType.entrata, CategoryType.trasferimento)
        for (type in groupTypes) {
            val inGroup = alphabetical.filter { it.type == type }
            if (inGroup.isEmpty()) continue
            val label = when (type) {
                CategoryType.entrata -> "Entrate"
                CategoryType.trasferimento -> "Esclusi da entrate e spese"
                else -> type.label
            }
            sections += CategoryPickerSection("type-${type.raw}", label, inGroup)
        }
        val unknown = alphabetical.filter { it.type !in groupTypes }
        if (unknown.isNotEmpty()) sections += CategoryPickerSection("type-other", "Altre", unknown)
        val fallback = categories.filter { it.isFallback }
        if (fallback.isNotEmpty()) sections += CategoryPickerSection("fallback", null, fallback)
        return sections
    }
}

/** One section of the Categorie board (`groupCategoriesByType`, CAT-006/007). */
data class CategoryBoardSection(
    /** `dovuta` … `saltuaria`, `entrata`, `trasferimento`, `fallback`. */
    val key: String,
    /** Type given to categories added in this section; null for «Da categorizzare» (no add, no moves). */
    val addType: CategoryType?,
    val categories: List<MovementCategory>,
)

object CategoryBoard {
    /** Four expense groups (always), Entrate and Trasferimenti tra conti (always), «Da categorizzare» only with the fallback. */
    fun sections(categories: List<MovementCategory>): List<CategoryBoardSection> {
        val groups = mutableMapOf<CategoryType, MutableList<MovementCategory>>()
        val income = mutableListOf<MovementCategory>()
        val transfers = mutableListOf<MovementCategory>()
        val uncategorized = mutableListOf<MovementCategory>()
        for (c in categories) {
            when {
                c.isFallback || !(c.type.isExpenseGroup || c.type == CategoryType.entrata || c.type == CategoryType.trasferimento) ->
                    uncategorized += c
                c.type == CategoryType.trasferimento -> transfers += c
                c.type == CategoryType.entrata -> income += c
                else -> groups.getOrPut(c.type) { mutableListOf() } += c
            }
        }
        val out = CategoryType.expenseGroups.map { CategoryBoardSection(it.raw, it, groups[it].orEmpty()) }.toMutableList()
        out += CategoryBoardSection("entrata", CategoryType.entrata, income)
        out += CategoryBoardSection("trasferimento", CategoryType.trasferimento, transfers)
        if (uncategorized.any { it.isFallback }) out += CategoryBoardSection("fallback", null, uncategorized)
        return out
    }
}
