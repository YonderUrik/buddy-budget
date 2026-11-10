package io.buddybudget.core.domain.accounts

import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountPatch
import io.buddybudget.core.data.AccountStatusLine
import io.buddybudget.core.data.AccountStatusTone
import io.buddybudget.core.data.NewAccountRequest
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.liquidity.ConnectionHealth
import io.buddybudget.core.domain.liquidity.ConnectionHealthState
import java.text.Collator
import java.util.Locale

// Liquidità · Conti logic (spec: features/04-accounts-bank-sync.md). Same names and behaviour as BuddyBudgetKit
// (`Domain/Accounts`). Copy is returned as Italian catalog sources (`AccountsText`), translated by the UI with `tr()`.

/**
 * A sentence to show: an Italian catalog source with `{name}` values. [lists] are placeholders filled with other texts,
 * each translated and joined with ", " (e.g. the sync summary's details).
 */
data class AccountsText(
    val source: String,
    val values: Map<String, String> = emptyMap(),
    val lists: Map<String, List<AccountsText>> = emptyMap(),
)

// ---------------------------------------------------------------------------------------------------------- Options

object AccountOptions {
    /** Type presets of the select (free text otherwise, `Altro…`). */
    val typePresets = listOf("Conto corrente", "Conto risparmio", "Conto deposito", "Contanti")
    /** `ACCOUNT_ICONS`, picker order. */
    val icons = listOf(
        "wallet", "credit-card", "banknote", "building-2", "piggy-bank", "trending-up", "home", "car", "plane", "shopping-cart",
        "briefcase", "dollar-sign", "bitcoin", "landmark", "coins", "receipt", "package", "gift", "heart", "star", "zap", "coffee",
        "shopping-bag", "user", "globe", "smartphone", "watch", "graduation-cap", "flame", "music",
    )
    /** `SWATCH_BASE_COLORS`: the only colours offered by the picker. */
    val colors = listOf(
        "slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
        "pink", "indigo", "cyan", "lime", "amber", "rose", "violet", "emerald",
    )
    const val DEFAULT_COLOR = "slate"
    const val DEFAULT_ICON = "wallet"
    const val NAME_MAX_LENGTH = 80
    /** Type given to accounts created from a bank (web `Conto corrente`). */
    const val LINKED_ACCOUNT_TYPE = "Conto corrente"

    private val colorNames = mapOf(
        "slate" to "grigio", "blue" to "blu", "green" to "verde", "yellow" to "giallo", "purple" to "viola",
        "orange" to "arancione", "red" to "rosso", "teal" to "verde acqua", "pink" to "rosa", "indigo" to "indaco",
        "cyan" to "azzurro", "lime" to "lime", "amber" to "ambra", "rose" to "rosa scuro", "violet" to "violetto",
        "emerald" to "smeraldo",
    )

    /** Italian colour names read by screen readers (`Colore {0}`), as the web does. */
    fun colorName(key: String): String = colorNames[key] ?: key
}

// ---------------------------------------------------------------------------------------------------------- Grouping (ACC-001)

/** One section of the Conti list: a bank, or the manual accounts. */
data class AccountGroup(
    val key: String,
    /** Bank name (verbatim), `Banca collegata` or `Manuali` (Italian sources; translate with lookup like the web). */
    val label: String,
    /** `Si aggiorna da solo` / `Li aggiorni tu`. */
    val hint: String,
    val isManual: Boolean,
    val accounts: List<Account>,
) {
    /** Sum of the group's balances (header amount). */
    val total: Double get() = accounts.fold(0.0) { sum, a -> sum + a.balance }
}

object AccountGrouping {
    const val UNKNOWN_BANK = "Banca collegata"
    const val MANUAL_KEY = "manuali"

    /** Banks in alphabetical order (Italian collation), accounts in the received order; manual accounts last. */
    fun group(accounts: List<Account>): List<AccountGroup> {
        val banks = LinkedHashMap<String, MutableList<Account>>()
        val manual = mutableListOf<Account>()
        for (account in accounts) {
            if (!account.isLinked) { manual += account; continue }
            val bank = account.bankName ?: account.health?.institutionName ?: UNKNOWN_BANK
            banks.getOrPut(bank) { mutableListOf() } += account
        }
        val collator = Collator.getInstance(Locale.ITALIAN)
        val groups = banks.keys.sortedWith(collator::compare)
            .map { AccountGroup("banca-$it", it, "Si aggiorna da solo", false, banks.getValue(it)) }
            .toMutableList()
        if (manual.isNotEmpty()) groups += AccountGroup(MANUAL_KEY, "Manuali", "Li aggiorni tu", true, manual)
        return groups
    }
}

// ---------------------------------------------------------------------------------------------------------- Row status (ACC-003)

object AccountRowStatus {
    /**
     * The server's localized line, except that a running job seen by the client wins over «Aggiornato …» / «Mai
     * sincronizzato» (`Da riconnettere` keeps precedence). Labels go through lookup: server text is returned as is.
     */
    fun resolve(account: Account, syncing: Boolean): AccountStatusLine {
        if (!account.isLinked) return account.status ?: AccountStatusLine(AccountStatusTone.Neutral, "Aggiornato da te")
        if (account.health?.needsRenewal == true) return AccountStatusLine(AccountStatusTone.Warning, "Da riconnettere")
        if (syncing || account.health?.syncing == true) return AccountStatusLine(AccountStatusTone.Progress, "Sincronizzazione in corso")
        return account.status ?: AccountStatusLine(AccountStatusTone.Neutral, "Mai sincronizzato")
    }
}

// ---------------------------------------------------------------------------------------------------------- Renewal (ACC-007 / ACC-008)

data class RenewalAlert(val connectionId: String, val institutionName: String, val state: ConnectionHealthState, val daysLeft: Int?)

object RenewalAlerts {
    /** One alert per connection that needs renewal; expired/error before expiring. */
    fun build(accounts: List<Account>): List<RenewalAlert> {
        val seen = mutableSetOf<String>()
        val alerts = mutableListOf<RenewalAlert>()
        for (account in accounts) {
            val health = account.health ?: continue
            if (!(health.needsRenewal || ConnectionHealth.needsRenewal(health.state)) || !seen.add(health.connectionId)) continue
            alerts += RenewalAlert(health.connectionId, health.institutionName, health.state, health.daysLeft)
        }
        return alerts.filter { it.state != ConnectionHealthState.EXPIRING } + alerts.filter { it.state == ConnectionHealthState.EXPIRING }
    }

    fun message(alert: RenewalAlert): AccountsText {
        val bank = alert.institutionName
        return when (alert.state) {
            ConnectionHealthState.EXPIRING ->
                if (alert.daysLeft == 1) AccountsText("Il collegamento con {0} scade domani.", mapOf("0" to bank))
                else AccountsText("Il collegamento con {0} scade tra {1} giorni.", mapOf("0" to bank, "1" to (alert.daysLeft ?: 0).toString()))
            ConnectionHealthState.ERROR -> AccountsText("Il collegamento con {0} non è andato a buon fine.", mapOf("0" to bank))
            else -> AccountsText("Il collegamento con {0} è scaduto: i conti non si aggiornano.", mapOf("0" to bank))
        }
    }
}

// ---------------------------------------------------------------------------------------------------------- Manual form (ACC-029 / ACC-030)

data class ManualAccountErrors(val name: String? = null, val type: String? = null, val balance: String? = null) {
    val isEmpty: Boolean get() = name == null && type == null && balance == null
}

/** The two-step «Conto manuale» form. `typePreset == null` means `Altro…` (free text in [customType]). */
data class ManualAccountDraft(
    val name: String = "",
    val typePreset: String? = AccountOptions.typePresets[0],
    val customType: String = "",
    /** Text of the amount field (locale decimal separator); "0" by default, may be negative. */
    val balanceText: String = "0",
    val color: String = AccountOptions.DEFAULT_COLOR,
    val icon: String = AccountOptions.DEFAULT_ICON,
) {
    val type: String get() = typePreset ?: customType

    /** Step 1: name and type required. */
    fun validateNameAndType(): ManualAccountErrors = ManualAccountErrors(
        name = if (name.isBlank()) "Dai un nome al conto, per riconoscerlo nell'elenco." else null,
        type = if (type.isBlank()) "Scrivi di che tipo di conto si tratta." else null,
    )

    val balance: Double? get() = BBFormat.parseAccountAmount(balanceText)

    /** Step 2: today's balance required (0 and negatives allowed). */
    fun validateBalance(): ManualAccountErrors =
        if (balance == null) ManualAccountErrors(balance = "Inserisci il saldo di oggi (anche 0).") else ManualAccountErrors()

    /** The `POST /api/accounts` body, or null while invalid. */
    fun request(): NewAccountRequest? {
        val value = balance ?: return null
        if (!validateNameAndType().isEmpty) return null
        return NewAccountRequest(name.trim(), type.trim(), value, color, icon)
    }

    companion object {
        /** Name field limited to 80 characters. */
        fun clampName(text: String): String = text.take(AccountOptions.NAME_MAX_LENGTH)
    }
}

// ---------------------------------------------------------------------------------------------------------- Detail edits (ACC-032…035)

object AccountEdits {
    /** Rename on field exit: only when changed and non-empty (otherwise the field reverts, no request). */
    fun rename(account: Account, draft: String): AccountPatch? {
        val next = draft.trim()
        return if (next.isEmpty() || next == account.name) null else AccountPatch(name = next)
    }

    /** Manual accounts only; ignored when empty or unchanged. */
    fun retype(account: Account, draft: String): AccountPatch? {
        if (account.isLinked) return null
        val next = draft.trim()
        return if (next.isEmpty() || next == account.type) null else AccountPatch(type = next)
    }

    /** Manual accounts only; saved on field exit when valid and changed. */
    fun rebalance(account: Account, draft: String): AccountPatch? {
        if (account.isLinked) return null
        val value = BBFormat.parseAccountAmount(draft) ?: return null
        return if (value == account.balance) null else AccountPatch(balance = value)
    }

    /** Icon and colour, saved immediately for any account. */
    fun appearance(account: Account, color: String, icon: String): AccountPatch? =
        if (color == account.color && icon == account.icon) null else AccountPatch(color = color, icon = icon)

    /** The account with a successful patch applied locally (optimistic list update). */
    fun apply(patch: AccountPatch, to: Account): Account = to.copy(
        name = patch.name ?: to.name, type = patch.type ?: to.type, balance = patch.balance ?: to.balance,
        color = patch.color ?: to.color, icon = patch.icon ?: to.icon,
    )
}

// ---------------------------------------------------------------------------------------------------------- Delete (ACC-040 / ACC-041)

data class AccountRemovalCopy(val action: String, val title: String, val message: AccountsText, val confirm: String)

object AccountRemoval {
    /** Decision 0003 / web bug: the confirmation says that the account's movements are deleted too. */
    fun copy(account: Account): AccountRemovalCopy = if (account.isLinked) {
        AccountRemovalCopy(
            "Scollega il conto", "Scollegare questo conto?",
            AccountsText("\"{0}\" verrà scollegato e tutti i suoi movimenti verranno eliminati. L'azione non è reversibile.", mapOf("0" to account.name)),
            "Scollega",
        )
    } else {
        AccountRemovalCopy(
            "Elimina il conto", "Eliminare questo conto?",
            AccountsText("\"{0}\" verrà eliminato definitivamente, insieme al suo saldo e a tutti i suoi movimenti.", mapOf("0" to account.name)),
            "Elimina",
        )
    }
}

// ---------------------------------------------------------------------------------------------------------- Navigation

object AccountsPaths {
    /** Movimenti filtered on one account (ACC-002 / ACC-039). */
    fun movements(accountId: String): String = "/liquidita?conto=$accountId"
    const val IMPORTS = "/importazioni"
    const val CATEGORIZE = "/categorizza"
}
