package io.buddybudget.core.domain.settings

import io.buddybudget.core.data.UserDataSummary
import io.buddybudget.core.domain.periods.CalendarDate
import java.net.URLEncoder
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeParseException

/** Settings groups (SET-001), ids usable as deep link `?sezione=` (SET-003). Same cases on iOS (`SettingsGroup`). */
enum class SettingsGroup(val id: String, val label: String, val summary: String, val iconKey: String) {
    Account("account", "Account", "Il tuo profilo e i dispositivi collegati", "user-round"),
    Aspetto("aspetto", "Aspetto e uso", "Valuta, tema, pagina iniziale e barra laterale", "palette"),
    Notifiche("notifiche", "Notifiche e AI", "Email di riepilogo e avvisi, assistente per le categorie e dove l'app usa l'AI", "bell"),
    Privacy("privacy", "Privacy e dati", "Statistiche anonime, esportazione e informative", "shield-check"),
    Pericolo("pericolo", "Zona pericolosa", "Azzera i dati, disattiva o elimina l'account", "triangle-alert"),
    ;

    val isDanger: Boolean get() = this == Pericolo

    companion object {
        private val legacyAnchors = mapOf(
            "#impostazioni-notifiche" to Notifiche,
            "#impostazioni-assistente-categorie" to Notifiche,
            "#impostazioni-privacy" to Privacy,
            "#impostazioni-dati" to Privacy,
            "#impostazioni-barra-laterale" to Aspetto,
            "#impostazioni-preferenze" to Aspetto,
            "#impostazioni-profilo" to Account,
            "#impostazioni-sessioni" to Account,
            "#impostazioni-zona-pericolosa" to Pericolo,
        )

        fun fromId(id: String?): SettingsGroup? = entries.firstOrNull { it.id == id }

        /** SET-003: `/impostazioni?sezione=<id>` or a legacy `#impostazioni-*` anchor → group; unknown → null (the list). */
        fun fromDeepLink(deepLink: String): SettingsGroup? {
            val hash = deepLink.indexOf('#')
            if (hash >= 0 && !deepLink.contains("sezione=")) legacyAnchors[deepLink.substring(hash)]?.let { return it }
            if (!deepLink.contains('?')) return null
            val query = deepLink.substringAfter('?')
            for (pair in query.split('&')) {
                val parts = pair.split('=', limit = 2)
                if (parts.size == 2 && parts[0] == "sezione") return fromId(parts[1].substringBefore('#'))
            }
            return null
        }
    }
}

/** Recent-login window for export/reset/deactivate/delete (SET-039/040). */
object RecentLogin {
    const val MAX_AGE_MINUTES = 10
    const val RECHECK_SECONDS = 15L

    fun isRecent(until: String?, nowMillis: Long): Boolean {
        val instant = until?.let(IsoDate::parse) ?: return false
        return nowMillis < instant.toEpochMilli()
    }
}

/** Typed confirmations of the danger zone (SET-043, SET-046). */
object DangerConfirmation {
    /** `RESET_CONFIRMATION_WORD`: Italian, not localized, exact and case-sensitive. */
    const val RESET_WORD = "RESETTA"
    const val DEACTIVATION_GRACE_DAYS = 30
    const val SESSION_IDLE_DAYS = 7

    fun resetMatches(typed: String): Boolean = typed == RESET_WORD

    fun deleteMatches(typed: String, email: String): Boolean = typed.trim().lowercase() == email.lowercase()
}

/** One count of «I tuoi dati» (SET-037): value and the singular/plural label (Italian source). */
data class DataSummaryItem(val label: String, val value: Int)

object DataSummaryItems {
    fun items(s: UserDataSummary): List<DataSummaryItem> {
        fun item(value: Int, singular: String, plural: String) = DataSummaryItem(if (value == 1) singular else plural, value)
        return listOf(
            item(s.accounts, "conto", "conti"),
            item(s.bankConnections, "banca collegata", "banche collegate"),
            item(s.transactions, "transazione", "transazioni"),
            item(s.categories, "categoria", "categorie"),
            item(s.rules, "regola di categorizzazione", "regole di categorizzazione"),
            item(s.budgets, "budget", "budget"),
            item(s.investmentOperations, "operazione di investimento", "operazioni di investimento"),
            item(s.debts, "debito", "debiti"),
            item(s.pensionFunds, "fondo pensione", "fondi pensione"),
            item(s.netWorthDays, "giorno di storico del patrimonio", "giorni di storico del patrimonio"),
        )
    }
}

/** The pre-filled GDPR request emails (SET-036, web `PRIVACY_REQUEST_OPTIONS` / `buildPrivacyRequestHref`). */
data class PrivacyRequest(val type: String, val label: String, val description: String, val article: String) {
    /** `mailto:` URL with subject and body (Italian, like the web: the request goes to the Italian controller). */
    fun mailto(accountEmail: String, address: String = PRIVACY_EMAIL): String {
        val subject = "Richiesta privacy: $label"
        val body = listOf(
            "Buongiorno,",
            "",
            "ai sensi del GDPR ($article) chiedo: ${label.lowercase()}.",
            "",
            "Dettagli della richiesta:",
            "",
            "",
            "Email dell'account: $accountEmail",
        ).joinToString("\n")
        return "mailto:$address?subject=${encode(subject)}&body=${encode(body)}"
    }

    companion object {
        const val PRIVACY_EMAIL = "privacy@buddybudget.io"

        val options = listOf(
            PrivacyRequest("rettifica", "Correggere un dato", "Per esempio l'indirizzo email dell'account.", "art. 16"),
            PrivacyRequest("limitazione", "Limitare il trattamento", "Chiedi di sospendere l'uso dei tuoi dati mentre verifichiamo una contestazione.", "art. 18"),
            PrivacyRequest("opposizione", "Oppormi al trattamento", "Per i trattamenti basati sul nostro legittimo interesse, come le statistiche d'uso.", "art. 21"),
            PrivacyRequest("accesso", "Altre informazioni sui miei dati", "Oltre all'archivio ZIP: fonti, destinatari, tempi di conservazione.", "art. 15"),
        )

        /** `encodeURIComponent`. */
        internal fun encode(value: String): String =
            URLEncoder.encode(value, "UTF-8").replace("+", "%20").replace("%21", "!").replace("%27", "'")
                .replace("%28", "(").replace("%29", ")").replace("%7E", "~")
    }
}

/** ISO-8601 timestamps of the API (`2026-10-18T10:00:00.000Z`, milliseconds optional). */
object IsoDate {
    fun parse(iso: String): Instant? = try {
        Instant.parse(iso)
    } catch (_: DateTimeParseException) {
        null
    }

    /** Local calendar day of a timestamp (for `BBFormat.formatLongDate`). */
    fun localDay(iso: String, zone: ZoneId = ZoneId.systemDefault()): CalendarDate? = parse(iso)?.let { CalendarDate.of(it, zone) }
}

/**
 * «Dove l'app usa l'AI» (SET-050, web #394/#460): the places where data can reach an AI model, what is sent and where it
 * is allowed. Italian catalog sources, translated by the UI. Same names on iOS (`AiUsage`).
 */
object AiUsage {
    data class Item(val title: String, val sent: String, val where: String)

    val items: List<Item> = listOf(
        Item(
            "Proposte di categoria",
            "Invia il nome pulito dell'esercente, se è un'entrata o un'uscita, le tue categorie e le tue istruzioni: mai importi, date, IBAN, note o nomi di persone.",
            "Lo attivi qui sotto, con «Proponi le categorie con l'AI»; vale anche per «Chiedi all'AI» nel dettaglio di un movimento.",
        ),
        Item(
            "Importazione di un estratto conto in un formato nuovo",
            "Invia il file intero, per capire come sono fatte le colonne. Con un formato già salvato lo invia solo se la lettura non riesce.",
            "Te lo chiede a ogni file, nell'ultimo passo dell'importazione in Liquidità.",
        ),
        Item(
            "Importazione degli investimenti, se la lettura non riesce",
            "Invia il file intero, solo per quell'importazione.",
            "Solo se spunti la casella nell'importazione in Investimenti.",
        ),
    )

    const val NO_AI_WITHOUT_CONSENT = "Senza il tuo sì non parte niente. Tutto il resto dell'app (calcoli, regole, sincronizzazione con la banca, avvisi) non usa l'AI."
    const val ZERO_DATA_RETENTION = "Zero data retention: i dati passano da OpenRouter solo verso fornitori che non li conservano dopo la risposta e non li usano per l'addestramento. Se nessuno è disponibile, la richiesta non parte."

    /** Anchor of the privacy policy section about zero data retention («Come funziona»). */
    const val ZDR_ANCHOR = "#zero-data-retention"
}
