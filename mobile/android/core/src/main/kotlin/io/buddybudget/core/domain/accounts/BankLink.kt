package io.buddybudget.core.domain.accounts

import io.buddybudget.core.data.BankCapacity
import io.buddybudget.core.data.BankCapacityReason
import io.buddybudget.core.data.ExternalBankAccount
import io.buddybudget.core.data.FinalizeSelection
import io.buddybudget.core.data.Institution
import io.buddybudget.core.domain.format.JSNumber
import java.net.URI
import java.net.URLDecoder

// New-account choice, bank picker and the native consent return (ACC-011…028, api/endpoints/gocardless.md R6).
// Same names on iOS.

// ---------------------------------------------------------------------------------------------------------- Capacity (ACC-012 / ACC-013)

data class BankUnavailableCopy(val badge: String, val description: String)

object BankCapacityCopy {
    /** Badge and text of the disabled «Collega la tua banca» option (`BANK_UNAVAILABLE_COPY`); null when linking is open. */
    fun unavailable(capacity: BankCapacity?): BankUnavailableCopy? {
        if (capacity == null || capacity.canConnectNew) return null
        return when (capacity.reason ?: BankCapacityReason.GlobalLimit) {
            BankCapacityReason.GlobalLimit, BankCapacityReason.ProviderLimit -> BankUnavailableCopy(
                "In arrivo",
                "I posti per il collegamento automatico sono finiti, ne stiamo aggiungendo altri. Intanto usa un conto manuale o importa l'estratto conto.",
            )
            BankCapacityReason.UserLimit -> BankUnavailableCopy(
                "Una per persona",
                "Per ora si collega una sola banca per persona. Per gli altri conti usa un conto manuale o importa l'estratto conto.",
            )
            BankCapacityReason.UserAttempts -> BankUnavailableCopy(
                "Più avanti",
                "Hai avviato troppi collegamenti questo mese, riprova più avanti. Intanto usa un conto manuale o importa l'estratto conto.",
            )
        }
    }
}

// ---------------------------------------------------------------------------------------------------------- Countries (ACC-017)

data class BankCountry(val code: String, /** Italian source of the name. */ val label: String) {
    /** Flag emoji of the ISO code. */
    val flag: String get() = code.uppercase().map { String(Character.toChars(127_397 + it.code)) }.joinToString("")
}

object BankCountries {
    val all = listOf(
        BankCountry("IT", "Italia"), BankCountry("DE", "Germania"), BankCountry("FR", "Francia"),
        BankCountry("ES", "Spagna"), BankCountry("GB", "Regno Unito"),
    )

    /** Default = the user's product country (IT or DE). */
    fun defaultCode(productCountry: String?): String {
        val code = (productCountry ?: "IT").uppercase()
        return if (all.any { it.code == code }) code else "IT"
    }
}

// ---------------------------------------------------------------------------------------------------------- Institutions (ACC-018 / ACC-019)

object InstitutionSearch {
    /** Case-insensitive substring on the name (empty query = all). */
    fun filter(institutions: List<Institution>, query: String): List<Institution> {
        val q = query.trim().lowercase()
        return if (q.isEmpty()) institutions else institutions.filter { it.name.lowercase().contains(q) }
    }

    /** `1 banca` / `{n} banche`. */
    fun countLabel(count: Int): AccountsText =
        if (count == 1) AccountsText("1 banca") else AccountsText("{0} banche", mapOf("0" to count.toString()))

    /** No-result title: `Nessuna banca trovata per «{q}».` or `Nessuna banca disponibile in questo paese.` */
    fun emptyTitle(query: String): AccountsText {
        val q = query.trim()
        return if (q.isEmpty()) AccountsText("Nessuna banca disponibile in questo paese.")
        else AccountsText("Nessuna banca trovata per «{0}».", mapOf("0" to q))
    }
}

object InstitutionHistory {
    /** `Storico fino a {n} giorni`, or years from 365 days (`Math.round(days / 365)`); null when the value is invalid. */
    fun label(days: String): AccountsText? {
        val total = JSNumber.parse(days) ?: return null
        if (!total.isFinite() || total <= 0) return null
        if (total >= 365) {
            val years = JSNumber.round(total / 365).toInt()
            return if (years == 1) AccountsText("Storico fino a 1 anno") else AccountsText("Storico fino a {0} anni", mapOf("0" to years.toString()))
        }
        val text = if (total == Math.rint(total)) total.toLong().toString() else total.toString()
        return AccountsText("Storico fino a {0} giorni", mapOf("0" to text))
    }
}

// ---------------------------------------------------------------------------------------------------------- Consent return (R6)

/** `buddybudget://bank/return?ref=<connectionId>&status=returned|cancelled|failed|invalid_ref[&error=]`. */
data class BankLinkReturn(val ref: String?, val status: Status, val error: String? = null) {
    enum class Status(val key: String) { Returned("returned"), Cancelled("cancelled"), Failed("failed"), InvalidRef("invalid_ref") }

    companion object {
        const val SCHEME = "buddybudget"

        /** Null for any other address. An unknown status counts as `returned` (informational only). */
        fun parse(url: String): BankLinkReturn? {
            val uri = runCatching { URI(url) }.getOrNull() ?: return null
            if (uri.scheme?.lowercase() != SCHEME || uri.host?.lowercase() != "bank" || uri.path != "/return") return null
            val items = (uri.rawQuery ?: "").split("&").filter { it.isNotEmpty() }.associate { pair ->
                val kv = pair.split("=", limit = 2)
                kv[0] to URLDecoder.decode(kv.getOrElse(1) { "" }, "UTF-8")
            }
            fun value(name: String) = items[name]?.takeIf { it.isNotEmpty() }
            val ref = value("ref")
            val status = if (ref == null) Status.InvalidRef else Status.entries.firstOrNull { it.key == value("status") } ?: Status.Returned
            return BankLinkReturn(ref, status, value("error"))
        }
    }
}

object BankLinkMessages {
    const val CANCELLED = "Hai annullato il collegamento con la banca."
    const val CONSENT_FAILED = "La banca non ha confermato il consenso: il collegamento non è stato completato."
    const val NOT_FOUND = "Non abbiamo trovato il collegamento con la banca. Riprova dall'inizio."
    const val UNAVAILABLE = "Il servizio di collegamento bancario non risponde. Riprova tra poco."

    /**
     * Message for a failed `…/complete` (R6): 422 consent failed, 404 not found, 502 unavailable; 409 pending and
     * other errors use the server text when present.
     */
    fun completeError(status: Int?, serverMessage: String?): String = when (status) {
        422 -> CONSENT_FAILED
        404 -> NOT_FOUND
        502, 503 -> UNAVAILABLE
        else -> serverMessage ?: UNAVAILABLE
    }
}

// ---------------------------------------------------------------------------------------------------------- «Conti trovati» (ACC-023…026)

object FoundAccounts {
    /** Card title: name, else IBAN, else the GoCardless id. */
    fun displayName(account: ExternalBankAccount): String = account.details.name ?: account.details.iban ?: account.externalAccountId

    /** The finalize body for the ticked accounts; `targets[id]` = existing account to re-link to (absent = new). */
    fun selections(accounts: List<ExternalBankAccount>, selected: Set<String>, targets: Map<String, String>): List<FinalizeSelection> =
        accounts.filter { it.externalAccountId in selected }.map { account ->
            val existing = targets[account.externalAccountId]
            if (existing != null) {
                FinalizeSelection(account.externalAccountId, account.details.name ?: "Conto collegato", AccountOptions.LINKED_ACCOUNT_TYPE, "existing", existing)
            } else {
                FinalizeSelection(
                    account.externalAccountId, account.details.name ?: account.details.iban ?: "Conto collegato",
                    AccountOptions.LINKED_ACCOUNT_TYPE, "new",
                )
            }
        }

    const val EMPTY_SELECTION_ERROR = "Seleziona almeno un conto da importare"
}
