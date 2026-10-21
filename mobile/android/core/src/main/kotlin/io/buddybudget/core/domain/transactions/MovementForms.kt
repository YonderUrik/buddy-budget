package io.buddybudget.core.domain.transactions

import io.buddybudget.core.data.Account
import io.buddybudget.core.data.isManual
import io.buddybudget.core.data.CreateTransactionBody
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.MovementPage
import io.buddybudget.core.data.TransactionPatch
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.liquidity.MovementDayGroup
import io.buddybudget.core.domain.liquidity.MovementList
import io.buddybudget.core.domain.liquidity.SplitPreset
import io.buddybudget.core.domain.liquidity.SplitShare
import io.buddybudget.core.domain.periods.CalendarDate
import java.util.Locale
import kotlin.math.abs

/** Field of the add-transaction form that can carry an error (TX-045). */
enum class AddTransactionField { Amount, Description, Category, Account, Date }

/**
 * «Nuovo movimento» (TX-042…046), ported from `components/domain/expenses/add-transaction-form.tsx`. Immutable: every
 * change returns a new form. Error values are Italian catalog keys. Same type on iOS.
 */
data class AddTransactionForm(
    val date: CalendarDate,
    val step: Int = 0,
    val isIncome: Boolean = false,
    val amountText: String = "",
    val description: String = "",
    /** null = the default (most used eligible category) until the user chooses. */
    val categoryOverride: String? = null,
    /** null = the first manual account. */
    val accountOverride: String? = null,
    val errors: Map<AddTransactionField, String> = emptyMap(),
    /** Movements added with «Aggiungi e inserisci un altro» in this session (TX-046). */
    val added: Int = 0,
) {
    val amount: Double? get() = BBFormat.parseAmount(amountText)

    /** Changing direction resets an explicit category choice. */
    fun withDirection(income: Boolean): AddTransactionForm =
        if (income == isIncome) this else copy(isIncome = income, categoryOverride = null)

    fun availableCategories(categories: List<MovementCategory>): List<MovementCategory> =
        CategoryRules.addFormCategories(categories, isIncome)

    fun categoryId(categories: List<MovementCategory>, usage: Map<String, Int>): String? =
        categoryOverride ?: CategoryRules.pickDefaultCategoryId(availableCategories(categories), usage)

    fun accountId(accounts: List<Account>): String? = accountOverride ?: accounts.firstOrNull { it.isManual }?.id

    /** The errors of `step` (empty = valid). */
    fun errorsFor(step: Int, categories: List<MovementCategory>, usage: Map<String, Int>, accounts: List<Account>): Map<AddTransactionField, String> =
        buildMap {
            if (step == 0 && !((amount ?: 0.0) > 0)) put(AddTransactionField.Amount, "Scrivi un importo maggiore di zero.")
            if (step == 1) {
                if (JSNumber.trim(description).isEmpty()) put(AddTransactionField.Description, "Scrivi una breve descrizione, per ritrovarlo nell'elenco.")
                if (categoryId(categories, usage) == null) put(AddTransactionField.Category, "Scegli una categoria.")
                if (accountId(accounts) == null) put(AddTransactionField.Account, "Serve un conto manuale su cui registrare il movimento.")
            }
        }

    /** Step 1 → 2 (`Continua`): the next form, with errors when invalid. */
    fun next(categories: List<MovementCategory>, usage: Map<String, Int>, accounts: List<Account>): AddTransactionForm {
        val e = errorsFor(step, categories, usage, accounts)
        return if (e.isEmpty()) copy(step = 1, errors = emptyMap()) else copy(errors = e)
    }

    fun back(): AddTransactionForm = copy(step = 0, errors = emptyMap())

    /** The request body when step 2 validates, else the form with its errors. */
    fun body(categories: List<MovementCategory>, usage: Map<String, Int>, accounts: List<Account>): Pair<AddTransactionForm, CreateTransactionBody?> {
        val e = errorsFor(1, categories, usage, accounts)
        val amount = amount
        val categoryId = categoryId(categories, usage)
        val accountId = accountId(accounts)
        if (e.isNotEmpty() || amount == null || amount <= 0 || categoryId == null || accountId == null) return copy(errors = e) to null
        return copy(errors = emptyMap()) to CreateTransactionBody(
            accountId, JSNumber.trim(description), categoryId, amount, if (isIncome) "entrata" else "uscita", date.iso,
        )
    }

    /** After «Aggiungi e inserisci un altro»: keep date, account and direction; clear the rest; back to step 1 (TX-046). */
    fun didAddAndContinue(): AddTransactionForm =
        copy(description = "", amountText = "", categoryOverride = null, errors = emptyMap(), added = added + 1, step = 0)
}

/** Amount ↔ text for amount fields (decimal keypad, locale separator, no grouping). */
object AmountInputText {
    /** 1250.5 → "1250,5" (it/de) or "1250.5" (en); integers have no decimals. */
    fun input(value: Double, locale: BBLocale): String {
        var text = String.format(Locale.ROOT, "%.2f", JSNumber.round2(abs(value)))
        if (text.endsWith(".00")) text = text.dropLast(3) else if (text.endsWith("0") && text.contains(".")) text = text.dropLast(1)
        return if (locale == BBLocale.EN_GB) text else text.replace(".", ",")
    }
}

/** Split («Dividi») sheet state (TX-034…036) on top of `SplitShare`. */
data class SplitForm(
    /** |amount| of the movement. */
    val total: Double,
    val ownShare: Double,
) {
    val excluded: Double get() = SplitShare.excludedFromOwnShare(total, ownShare)
    val matchingPreset: SplitPreset? get() = SplitShare.matchPreset(total, ownShare)

    fun applyPreset(preset: SplitPreset): SplitForm = copy(ownShare = SplitShare.ownShareForPreset(total, preset.parts))

    /** Slider or committed field value; NaN (non-numeric text) → the full amount. */
    fun withOwnShare(value: Double): SplitForm = copy(ownShare = SplitShare.clampOwnShare(value, total))

    fun withOwnShare(text: String): SplitForm = withOwnShare(BBFormat.parseAmount(text) ?: Double.NaN)

    companion object {
        fun of(movement: Movement): SplitForm {
            val total = abs(movement.amount)
            return SplitForm(total, SplitShare.clampOwnShare(total - abs(movement.excludedAmount), total))
        }
    }
}

/** The edit sheet of a manual movement (TX-039): only changed, non-empty, valid fields are sent. */
object MovementEdit {
    fun patch(movement: Movement, description: String, date: CalendarDate, amountText: String): TransactionPatch? {
        val trimmed = JSNumber.trim(description)
        val amount = BBFormat.parseAmount(amountText)
        val patch = TransactionPatch(
            description = trimmed.takeIf { it.isNotEmpty() && it != movement.description },
            date = date.iso.takeIf { it != movement.date },
            amount = amount?.takeIf { it > 0 && JSNumber.round2(it) != JSNumber.round2(abs(movement.amount)) },
        )
        return if (patch == TransactionPatch()) null else patch
    }

    /** TX-038: the note to send when the editor closes; null = unchanged. Empty → "" (removes it). Max 500. */
    fun notePatch(movement: Movement, text: String): String? {
        val trimmed = JSNumber.trim(text).take(500)
        return if (trimmed == (movement.note ?: "")) null else trimmed
    }
}

/**
 * The Movimenti feed over the paged API (TX-018/019): pages appended in server order, duplicates dropped, grouped by
 * day. While more pages exist the last day may be incomplete, so it is held back until the next page arrives.
 */
data class MovementFeed(
    val items: List<Movement> = emptyList(),
    val nextCursor: String? = null,
    val loadedFirstPage: Boolean = false,
) {
    val hasMore: Boolean get() = nextCursor != null
    val isEmpty: Boolean get() = items.isEmpty()

    fun reset(page: MovementPage): MovementFeed = MovementFeed(loadedFirstPage = true).append(page)

    fun append(page: MovementPage): MovementFeed {
        val seen = items.map { it.id }.toMutableSet()
        val merged = items.toMutableList()
        for (item in page.items) if (seen.add(item.id)) merged += item
        return copy(items = merged, nextCursor = page.nextCursor)
    }

    fun replace(movement: Movement): MovementFeed = copy(items = items.map { if (it.id == movement.id) movement else it })
    fun remove(id: String): MovementFeed = copy(items = items.filterNot { it.id == id })
    fun insert(movement: Movement, index: Int): MovementFeed =
        copy(items = items.toMutableList().apply { add(index.coerceIn(0, size), movement) })
    fun indexOf(id: String): Int? = items.indexOfFirst { it.id == id }.takeIf { it >= 0 }

    /** Day groups to render. With more pages, the trailing day is hidden unless it is the only one. */
    fun groups(today: CalendarDate, locale: BBLocale): List<MovementDayGroup<Movement>> {
        val all = MovementList.groupByDay(items, today, locale)
        return if (hasMore && all.size > 1) all.dropLast(1) else all
    }
}

/** Server sentences (voice, Analisi lead) carry formatted amounts: in privacy mode every number is masked. */
object VoiceText {
    private val number = Regex("[0-9](?:[0-9.,\\u00A0\\u202F]*[0-9])?")
    fun masked(text: String): String = number.replace(text, BBFormat.AMOUNT_MASK)
}

/**
 * «Budget al mese (facoltativo)» of a category (CAT-099…101, web #432 `category-budget-field.tsx`): what leaving the
 * field does, the text it shows and the board tile label. Same names on iOS (`CategoryBudgetField`).
 */
object CategoryBudgetField {
    sealed class Outcome {
        /** Nothing to send (empty with no budget, or the same amount). */
        data object Unchanged : Outcome()
        /** Emptied: `DELETE /api/budgets/{categoryId}`. */
        data object Remove : Outcome()
        /** Not a number or negative: `Scrivi un importo, per esempio 300.` */
        data object Invalid : Outcome()
        /** `PUT /api/budgets/{categoryId}` with the amount rounded to cents. */
        data class Save(val amount: Double) : Outcome()
    }

    /** Only expense groups have a budget (not income, transfers or the fallback). */
    fun appliesTo(type: io.buddybudget.core.data.CategoryType, isFallback: Boolean): Boolean = !isFallback && type.isExpenseGroup

    /** `parseLocaleNumber`: «1.250,50» (it/de) or «1,250.50» (en); null when not a number. */
    fun parse(text: String, locale: io.buddybudget.core.domain.format.BBLocale): Double? {
        val trimmed = JSNumber.trim(text).replace(" ", "").replace(" ", "")
        if (trimmed.isEmpty()) return null
        val normalized = if (locale == io.buddybudget.core.domain.format.BBLocale.EN_GB) trimmed.replace(",", "")
        else trimmed.replace(".", "").replace(",", ".")
        return JSNumber.parse(normalized)?.takeIf { it.isFinite() }
    }

    fun commit(text: String, saved: Double?, locale: io.buddybudget.core.domain.format.BBLocale): Outcome {
        if (JSNumber.trim(text).isEmpty()) return if (saved == null) Outcome.Unchanged else Outcome.Remove
        val value = parse(text, locale)
        if (value == null || value < 0) return Outcome.Invalid
        val rounded = JSNumber.round2(value)
        return if (rounded == saved) Outcome.Unchanged else Outcome.Save(rounded)
    }

    /** The amount as the user would type it (no grouping, at most two decimals); empty without a budget. */
    fun inputText(amount: Double?, locale: io.buddybudget.core.domain.format.BBLocale): String =
        amount?.let { AmountInputText.input(it, locale) } ?: ""
}
