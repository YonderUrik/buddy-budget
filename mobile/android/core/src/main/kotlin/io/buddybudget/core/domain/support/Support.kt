package io.buddybudget.core.domain.support

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

// Help & support (16-help-support, SUP-*): report kinds, the technical context, the attached error, the help screen's
// static content and deep-link parameters. Port of the web's `lib/support/{constants,report}.ts`,
// `components/domain/support/{faq.data,github-links,report-form}.tsx` and `lib/client-errors`. Same names on iOS
// (`BuddyBudgetKit/Domain/Support/Support.swift`).

/** What the report is about (`REPORT_KINDS`). Serial names are the API values. */
@Serializable
enum class ReportKind(val raw: String, val label: String, val placeholder: String) {
    @SerialName("problema") Problema("problema", "Un problema", "Cosa è successo e cosa ti aspettavi? Se puoi, i passi per rivederlo."),
    @SerialName("domanda") Domanda("domanda", "Una domanda", "Cosa vuoi sapere?"),
    @SerialName("idea") Idea("idea", "Un'idea", "Cosa ti piacerebbe poter fare?");

    companion object {
        /** SUP-003: `?tipo=` value; anything else is ignored (null). */
        fun parse(raw: String?): ReportKind? = entries.firstOrNull { it.raw == raw }
    }
}

/** SUP-018: where the report started (`REPORT_SOURCES`). */
@Serializable
enum class ReportSource(val raw: String) {
    /** The «Aiuto e segnalazioni» screen. */
    @SerialName("pagina") Pagina("pagina"),
    /** The «Scrivici» button. */
    @SerialName("pulsante") Pulsante("pulsante"),
    /** A «Segnala questo problema» link or a «Segnala» toast action. */
    @SerialName("errore") Errore("errore"),
}

/** The failed operation attached to a report (`REPORT_ERROR_AREAS`, closed list) and its label (Italian source). */
@Serializable
enum class ReportErrorArea(val raw: String, val label: String) {
    @SerialName("import_movimenti") ImportMovimenti("import_movimenti", "Importazione dei movimenti"),
    @SerialName("import_investimenti") ImportInvestimenti("import_investimenti", "Importazione degli investimenti"),
    @SerialName("sync_banca") SyncBanca("sync_banca", "Aggiornamento dalla banca"),
    @SerialName("collega_banca") CollegaBanca("collega_banca", "Collegamento della banca"),
    @SerialName("movimento") Movimento("movimento", "Salvataggio di un movimento"),
    @SerialName("operazione") Operazione("operazione", "Salvataggio di un'operazione"),
    @SerialName("conto") Conto("conto", "Salvataggio di un conto"),
    @SerialName("debito") Debito("debito", "Salvataggio di un debito"),
    @SerialName("abbonamento") Abbonamento("abbonamento", "Salvataggio di un abbonamento"),
    @SerialName("pensione") Pensione("pensione", "Salvataggio della pensione"),
    @SerialName("obiettivo") Obiettivo("obiettivo", "Salvataggio di un obiettivo"),
    @SerialName("caricamento") Caricamento("caricamento", "Caricamento della pagina"),
    @SerialName("salvataggio") Salvataggio("salvataggio", "Salvataggio");

    companion object {
        fun fromRaw(raw: String): ReportErrorArea? = entries.firstOrNull { it.raw == raw }
    }
}

/** SUP-020 / SUP-021: the error a report starts from. The message (as shown to the user) is cut to 300 characters. */
@Serializable
class ReportError private constructor(val area: ReportErrorArea, val message: String) {
    override fun equals(other: Any?) = other is ReportError && other.area == area && other.message == message
    override fun hashCode() = area.hashCode() * 31 + message.hashCode()

    companion object {
        operator fun invoke(area: ReportErrorArea, message: String) = ReportError(area, message.take(Support.ERROR_MAX_LENGTH))
    }
}

/** Resolved theme as the server expects it (Italian enum, sent literally in every language — open question 2). */
@Serializable
enum class ReportTheme(val raw: String, val label: String) {
    @SerialName("chiaro") Chiaro("chiaro", "Chiaro"),
    @SerialName("scuro") Scuro("scuro", "Scuro"),
}

/** SUP-011 / SUP-012: technical context attached to a report — never financial data, never a query string. */
@Serializable
class ReportContext private constructor(val path: String, val version: String, val viewport: String, val theme: ReportTheme) {
    override fun equals(other: Any?) =
        other is ReportContext && other.path == path && other.version == version && other.viewport == viewport && other.theme == theme
    override fun hashCode() = listOf(path, version, viewport, theme).hashCode()

    companion object {
        operator fun invoke(path: String, version: String, viewport: String, theme: ReportTheme) = ReportContext(
            Support.sanitizePath(path), version.take(40), if (Support.isValidViewport(viewport)) viewport else "100x100", theme,
        )

        /** `path` = logical route of the screen (web path), `width`/`height` = screen points / dp (mobile note). */
        fun make(path: String, version: String, width: Double, height: Double, dark: Boolean) =
            invoke(path, version, "${width.roundToInt()}x${height.roundToInt()}", if (dark) ReportTheme.Scuro else ReportTheme.Chiaro)
    }
}

/** Body of `POST /api/support` (`reportInputSchema`); null fields are omitted. */
@Serializable
data class ReportInput(
    val kind: ReportKind,
    val message: String,
    val context: ReportContext? = null,
    val source: ReportSource? = null,
    val error: ReportError? = null,
)

/** A quick answer of «Risposte rapide» (`FAQ_ITEMS`, Italian source). */
data class FaqItem(val id: String, val question: String, val answer: String)

/** A link of «Su GitHub» (`github-links.tsx`). */
data class GithubLink(val id: Id, val label: String, val hint: String, val href: String) {
    enum class Id(val raw: String) { Issue("issue"), IssueAperte("issue_aperte"), Novita("novita"), Sicurezza("sicurezza") }
}

object Support {
    const val MESSAGE_MIN_LENGTH = 10
    const val MESSAGE_MAX_LENGTH = 4000
    const val ERROR_MAX_LENGTH = 300
    const val EMAIL = "support@buddybudget.io"
    const val REPO_URL = "https://github.com/YonderUrik/buddy-budget"
    /** SUP-004. */
    const val STATUS_URL = "https://stats.uptimerobot.com/BCuTWm0Ukg"
    /** Network / unknown failure and a 2xx without `reference` (open question 8). */
    const val SEND_FAILED = "Non siamo riusciti a inviare la segnalazione."

    /** Only the path, without query or fragment, at most 120 characters; anything not starting with `/` → `/`. */
    fun sanitizePath(path: String): String {
        val clean = path.substringBefore('?').substringBefore('#')
        return if (clean.startsWith("/")) clean.take(120) else "/"
    }

    /** `^\d{2,5}x\d{2,5}$`. */
    fun isValidViewport(value: String): Boolean = Regex("^[0-9]{2,5}x[0-9]{2,5}$").matches(value)

    /** SUP-009: the submit button is enabled with at least 10 characters after trimming, while not sending. */
    fun canSubmit(message: String, pending: Boolean = false): Boolean = !pending && message.trim().length >= MESSAGE_MIN_LENGTH

    /**
     * The request body: trimmed message, context only when the box is checked (SUP-011), kind forced to `problema`
     * when an error is attached (SUP-020).
     */
    fun input(kind: ReportKind, message: String, withContext: Boolean, context: ReportContext, source: ReportSource, error: ReportError?) =
        ReportInput(
            kind = if (error == null) kind else ReportKind.Problema,
            message = message.trim().take(MESSAGE_MAX_LENGTH),
            context = if (withContext) context else null,
            source = source,
            error = error,
        )

    /** SUP-007: new-issue link; problems carry the context in «ambiente» (`githubIssueUrl`). */
    fun githubIssueUrl(kind: ReportKind, context: ReportContext?): String {
        if (kind == ReportKind.Idea) return "$REPO_URL/issues/new?template=funzionalita.yml"
        var query = "template=bug.yml"
        if (context != null) {
            val ambiente = "BuddyBudget ${context.version}, pagina ${sanitizePath(context.path)}, schermo ${context.viewport}, tema ${context.theme.raw}"
            query += "&ambiente=" + formEncode(ambiente)
        }
        return "$REPO_URL/issues/new?$query"
    }

    /** SUP-007: the four links in order. */
    fun githubLinks(context: ReportContext): List<GithubLink> = listOf(
        GithubLink(GithubLink.Id.Issue, "Apri una issue su GitHub", "Pubblica: per problemi e idee senza dati personali.",
            githubIssueUrl(ReportKind.Problema, context)),
        GithubLink(GithubLink.Id.IssueAperte, "Vedi le segnalazioni aperte", "Controlla se qualcuno ha già scritto la stessa cosa.", "$REPO_URL/issues"),
        GithubLink(GithubLink.Id.Novita, "Novità e correzioni", "Cosa è cambiato in ogni versione.", "$REPO_URL/releases"),
        GithubLink(GithubLink.Id.Sicurezza, "Segnala una vulnerabilità", "In privato, mai in una issue pubblica.", "$REPO_URL/security/policy"),
    )

    /** SUP-006: «Risposte rapide», verbatim. */
    val faq: List<FaqItem> = listOf(
        FaqItem("banca-scaduta", "Il collegamento con la banca non si aggiorna più",
            "Il consenso Open Banking dura al massimo 90 giorni e poi va rinnovato. Vai in Liquidità → Conti e scegli «Rinnova» sul conto: ti avvisiamo anche per email prima della scadenza."),
        FaqItem("import-csv", "Come importo i movimenti o le operazioni da un file?",
            "Da Liquidità → Conti puoi aggiungere un conto importando un CSV, e da Investimenti → Operazioni importi gli estratti del broker. Gestisci e cancella gli import da «Gestione importazioni»."),
        FaqItem("categoria-sbagliata", "Una transazione ha la categoria sbagliata",
            "Tocca l'icona del movimento in Liquidità e scegli la categoria: se vuoi, la ricordiamo con una regola per i prossimi movimenti dello stesso esercente."),
        FaqItem("dati-miei", "Posso scaricare o cancellare i miei dati?",
            "Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi."),
        FaqItem("stime-fiscali", "Le stime fiscali sono una consulenza?",
            "No. Imposte, aliquote e proiezioni sono stime a scopo informativo: per decisioni fiscali o di investimento rivolgiti a un professionista abilitato."),
    )

    /** `application/x-www-form-urlencoded` like `URLSearchParams.toString()`: `*-._` and alphanumerics kept, space → `+`. */
    fun formEncode(value: String): String = buildString {
        for (byte in value.encodeToByteArray()) {
            val c = byte.toInt() and 0xFF
            when {
                c in 'a'.code..'z'.code || c in 'A'.code..'Z'.code || c in '0'.code..'9'.code || c == '*'.code || c == '-'.code ||
                    c == '.'.code || c == '_'.code -> append(c.toChar())
                c == ' '.code -> append('+')
                else -> append('%').append(String.format("%02X", c))
            }
        }
    }
}

/** `/aiuto?da=<path>&tipo=<kind>` (SUP-002, SUP-003). */
data class HelpLaunch(
    /** Screen the user came from, used as the context path; null → the help screen itself. */
    val from: String? = null,
    val kind: ReportKind = ReportKind.Problema,
) {
    /** The path recorded as context: `?da=` when present, else the help screen (SUP-002). */
    val contextPath: String get() = from ?: "/aiuto"

    companion object {
        fun fromPath(path: String): HelpLaunch {
            var from: String? = null
            var kind: ReportKind? = null
            val query = path.split("?", limit = 2).getOrNull(1)
            if (query != null) {
                for (pair in query.split("&")) {
                    val parts = pair.split("=", limit = 2)
                    if (parts.size != 2) continue
                    val value = runCatching { java.net.URLDecoder.decode(parts[1], "UTF-8") }.getOrDefault(parts[1])
                    when (parts[0]) {
                        "da" -> from = value.ifEmpty { null }
                        "tipo" -> kind = ReportKind.parse(value)
                    }
                }
            }
            return HelpLaunch(from, kind ?: ReportKind.Problema)
        }
    }
}

// Crash reporting (SUP-024…026)

/** First path segment sent with a crash report (`CLIENT_ERROR_AREAS`). */
@Serializable
enum class ClientErrorArea(val raw: String) {
    @SerialName("panoramica") Panoramica("panoramica"),
    @SerialName("liquidita") Liquidita("liquidita"),
    @SerialName("conti") Conti("conti"),
    @SerialName("investimenti") Investimenti("investimenti"),
    @SerialName("debiti") Debiti("debiti"),
    @SerialName("pensione") Pensione("pensione"),
    @SerialName("analitiche") Analitiche("analitiche"),
    @SerialName("categorizza") Categorizza("categorizza"),
    @SerialName("importazioni") Importazioni("importazioni"),
    @SerialName("impostazioni") Impostazioni("impostazioni"),
    @SerialName("aiuto") Aiuto("aiuto"),
    @SerialName("onboarding") Onboarding("onboarding"),
    @SerialName("altro") Altro("altro");

    companion object {
        /** `/investimenti/titoli/abc` → `investimenti`; any other path → `altro` (`clientErrorArea`). */
        fun fromPath(path: String): ClientErrorArea {
            val first = Support.sanitizePath(path).split("/").firstOrNull { it.isNotEmpty() } ?: ""
            return entries.firstOrNull { it.raw == first } ?: Altro
        }
    }
}

/** Body of `POST /api/client-errors` (`buildClientErrorReport`). */
@Serializable
class ClientErrorReport private constructor(
    val kind: Kind,
    val area: ClientErrorArea,
    val name: String? = null,
    val message: String,
    val digest: String? = null,
) {
    @Serializable
    enum class Kind { @SerialName("sezione") Sezione, @SerialName("globale") Globale }

    companion object {
        fun make(kind: Kind, path: String, name: String?, message: String, digest: String? = null) = ClientErrorReport(
            kind = kind,
            area = ClientErrorArea.fromPath(path),
            name = name?.takeIf { it.isNotEmpty() }?.take(80),
            message = message.ifEmpty { "Errore senza messaggio" }.take(500),
            digest = digest?.takeIf { it.isNotEmpty() }?.take(64),
        )

        /**
         * Native mapping of «a screen fails to render» (mobile note): the screen's data could not be decoded. Only the
         * endpoint's first two segments travel (`/api/overview`), never ids or values.
         */
        fun decodingFailure(screenPath: String, endpoint: String): ClientErrorReport {
            val segments = endpoint.substringBefore('?').split("/").filter { it.isNotEmpty() }.take(2).joinToString("/")
            return make(Kind.Sezione, screenPath, "DecodingError", "Risposta non leggibile: /$segments")
        }
    }
}
