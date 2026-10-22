package io.buddybudget.core.domain.shell

import io.buddybudget.core.data.WelcomeItem
import io.buddybudget.core.data.WelcomeSummary

/**
 * «Dall'ultima visita» (SHELL-058…059, web #457 `components/domain/welcome/welcome-lines.ts`): the toast lines and
 * the action. Italian catalog sources; `tr` translates with `{0}` values, `join` joins labels as the language does
 * («a, b e c»). Same names on iOS (`WelcomeText`).
 */
object WelcomeText {
    /** How often the open app sends a heartbeat while in the foreground. */
    const val HEARTBEAT_MS = 5 * 60 * 1000L
    /** Heartbeats closer than this are not sent. */
    const val THROTTLE_MS = 60 * 1000L
    /** Long enough to read the sentence, short enough not to sit on the screen. */
    const val TOAST_MS = 10_000L

    data class Line(val kind: String, val figure: Int, val title: String, val path: String, val action: String? = null)
    data class Content(val lines: List<String>, val actionLabel: String, val actionPath: String, val actionKind: String)

    /** Where each line leads (in-app paths). */
    fun path(item: WelcomeItem): String = when (item.kind) {
        "movements" -> "/liquidita"
        "price_alerts" -> "/investimenti/titoli"
        "price_rises", "subscriptions" -> "/liquidita/abbonamenti"
        "to_decide" -> "/categorizza"
        "import_review" -> "/importazioni" + (item.jobId?.let { "?job=$it" } ?: "")
        else -> "/panoramica"
    }

    fun happenedLine(item: WelcomeItem, tr: (String, Map<String, String>) -> String): Line? {
        val one = item.count == 1
        val title = when (item.kind) {
            "movements" -> if (one) "movimento nuovo" else "movimenti nuovi"
            "price_alerts" -> if (one) "avviso di prezzo scattato" else "avvisi di prezzo scattati"
            "price_rises" -> if (one) "abbonamento costa di più" else "abbonamenti costano di più"
            else -> return null
        }
        return Line(item.kind, item.count, tr(title, emptyMap()), path(item))
    }

    fun waitingLine(item: WelcomeItem, tr: (String, Map<String, String>) -> String): Line? {
        val one = item.count == 1
        val (title, action) = when (item.kind) {
            "to_decide" -> (if (one) "movimento senza categoria" else "movimenti senza categoria") to "Decidi"
            "subscriptions" -> (if (one) "abbonamento da confermare" else "abbonamenti da confermare") to "Controlla"
            "import_review" -> "import da controllare" to "Apri"
            else -> return null
        }
        return Line(item.kind, item.count, tr(title, emptyMap()), path(item), tr(action, emptyMap()))
    }

    /**
     * One line per group («Mentre eri via: 12 movimenti nuovi e 1 avviso di prezzo scattato», «Da sistemare: 7 movimenti
     * senza categoria»), with the action of the first thing that waits, or «Vedi» on the first thing that happened.
     * Null when there is nothing to say.
     */
    fun content(summary: WelcomeSummary, tr: (String, Map<String, String>) -> String, join: (List<String>) -> String): Content? {
        val happened = summary.happened.mapNotNull { happenedLine(it, tr) }
        val waiting = summary.waiting.mapNotNull { waitingLine(it, tr) }
        val first = waiting.firstOrNull() ?: happened.firstOrNull() ?: return null
        // The count never ends a line apart from its words.
        fun label(lines: List<Line>) = join(lines.map { "${it.figure} ${it.title}" })
        val lines = listOfNotNull(
            if (happened.isNotEmpty()) tr("Mentre eri via: {0}", mapOf("0" to label(happened))) else null,
            if (waiting.isNotEmpty()) tr("Da sistemare: {0}", mapOf("0" to label(waiting))) else null,
        )
        return Content(lines, first.action ?: tr("Vedi", emptyMap()), first.path, first.kind)
    }
}
