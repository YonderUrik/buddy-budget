package io.buddybudget.app.features.help

import android.content.res.Resources
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.AppVersion
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextArea
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.ReportSendError
import io.buddybudget.core.data.SupportApi
import io.buddybudget.core.domain.support.ReportContext
import io.buddybudget.core.domain.support.ReportError
import io.buddybudget.core.domain.support.ReportKind
import io.buddybudget.core.domain.support.ReportSource
import io.buddybudget.core.domain.support.Support
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * State of the «Scrivici» report form (SUP-008…018), shared by the help screen and the quick-report sheet.
 * Twin of `ReportFormModel` on iOS.
 */
class ReportFormModel(
    private val api: SupportApi,
    val source: ReportSource,
    val error: ReportError? = null,
    initialKind: ReportKind = ReportKind.Problema,
) {
    sealed interface Phase {
        data object Editing : Phase
        data object Sending : Phase
        data class Sent(val reference: String) : Phase
    }

    var kind by mutableStateOf(if (error == null) initialKind else ReportKind.Problema)
    var message by mutableStateOf("")
    var withContext by mutableStateOf(true)
    var phase by mutableStateOf<Phase>(Phase.Editing)
        private set
    /** SUP-015: last failure (server text, Italian source when it has one); the message is kept for a retry. */
    var failure by mutableStateOf<String?>(null)
        private set

    val canSubmit: Boolean get() = Support.canSubmit(message, pending = phase == Phase.Sending)

    suspend fun submit(context: ReportContext) {
        if (!canSubmit) return
        phase = Phase.Sending
        failure = null
        val input = Support.input(kind, message, withContext, context, source, error)
        try {
            val reference = api.send(input)
            message = ""
            phase = Phase.Sent(reference)
        } catch (e: ReportSendError) {
            failure = e.message
            phase = Phase.Editing
        }
    }

    /** SUP-014: «Scrivi un'altra segnalazione» starts again from an empty form. */
    fun reset() {
        message = ""
        failure = null
        phase = Phase.Editing
    }

    /**
     * Debug builds only (the release `DebugLaunch` returns null): `--es bbReportMessage <text>` prefills,
     * `--es bbReportSubmit 1` sends, `--es bbReportSent <ref>` shows the thank-you state with a fixture reference
     * (the dev server cannot send email) — screenshots and E2E only.
     */
    fun applyDebugLaunch(context: ReportContext, scope: CoroutineScope) {
        DebugLaunch.value("bbReportMessage")?.let { message = it }
        DebugLaunch.value("bbReportSent")?.let { phase = Phase.Sent(it) }
        if (DebugLaunch.value("bbReportSubmit") != null) scope.launch { submit(context) }
    }
}

/** The technical context for a report (SUP-011): logical path, `android-<version> (<build>)`, screen dp, resolved theme. */
object ReportContextFactory {
    val version: String get() = "android-${AppVersion.version} (${AppVersion.build})"

    fun make(path: String, dark: Boolean): ReportContext {
        val metrics = Resources.getSystem().displayMetrics
        return ReportContext.make(path, version, metrics.widthPixels / metrics.density.toDouble(), metrics.heightPixels / metrics.density.toDouble(), dark)
    }
}

/**
 * «Scrivici» form (web `ReportForm`): kind, message, hint, context checkbox, error, «Invia»; success replaces it.
 * [compact] = the sheet version (label hidden, lower text area).
 */
@Composable
fun ReportFormView(model: ReportFormModel, context: ReportContext, compact: Boolean = false) {
    val phase = model.phase
    if (phase is ReportFormModel.Phase.Sent) Sent(model, phase.reference) else Form(model, context, compact)
}

@Composable
private fun Form(model: ReportFormModel, context: ReportContext, compact: Boolean) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        if (model.error == null) {
            SegmentedControl(
                ReportKind.entries.map { it to tr(it.label) }, model.kind, { model.kind = it },
                accessibilityLabel = tr("Di cosa si tratta"), stretch = true,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            val label = tr("Racconta")
            if (!compact) BBText(label, style = BBTextStyle.BodyStrong.style)
            BBTextArea(
                model.message, { model.message = it },
                Modifier.semantics { contentDescription = label },
                placeholder = tr(model.kind.placeholder), maxLength = Support.MESSAGE_MAX_LENGTH,
                minHeight = if (compact) 96.dp else 112.dp,
            )
            BBText(
                tr("Non scrivere IBAN, password o altri dati sensibili: non servono. Useremo la tua email solo per risponderti."),
                style = BBTextStyle.Caption.style, color = c.mutedForeground,
            )
        }
        ContextRow(model, context)
        model.failure?.let { failure ->
            BBText("${tr(failure)} ${tr("Puoi anche scrivere a")} ${Support.EMAIL}.", style = BBTextStyle.Body.style, color = c.neg)
        }
        BBButton(
            if (model.phase == ReportFormModel.Phase.Sending) tr("Invio…") else tr("Invia"),
            { scope.launch { model.submit(context) } },
            size = BBButtonSize.Touch, fullWidth = true, enabled = model.canSubmit,
        )
    }
}

/** «Allega il contesto tecnico: pagina …, versione …, schermo …, tema …. Nessun dato finanziario.» */
@Composable
private fun ContextRow(model: ReportFormModel, context: ReportContext) {
    val c = BuddyBudgetTheme.colors
    val details = listOf(
        tr("pagina"), " ", context.path, tr(", versione"), " ", context.version,
        tr(", schermo"), " ", context.viewport, tr(", tema"), " ", tr(context.theme.label),
    ).joinToString("")
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = c.mutedForeground)) { append(tr("Allega il contesto tecnico:") + " ") }
        withStyle(SpanStyle(color = c.foreground)) { append(details) }
        withStyle(SpanStyle(color = c.mutedForeground)) { append(tr(". Nessun dato finanziario.")) }
    }
    Row(
        Modifier.fillMaxWidth()
            .bbPressable({ model.withContext = !model.withContext }, RoundedCornerShape(BBRadius.md), translate = false)
            .semantics { role = Role.Checkbox; stateDescription = if (model.withContext) "1" else "0" },
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        verticalAlignment = Alignment.Top,
    ) {
        BBCheckbox(model.withContext, { model.withContext = it }, Modifier.padding(top = 2.dp))
        Text(text, Modifier.weight(1f), style = BBTextStyle.Body.style)
    }
}

@Composable
private fun Sent(model: ReportFormModel, reference: String) {
    val c = BuddyBudgetTheme.colors
    Column(
        Modifier.fillMaxWidth().background(c.posSoft, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        BBText(tr("Grazie, abbiamo ricevuto la segnalazione."), style = BBTextStyle.BodyStrong.style)
        val text = buildAnnotatedString {
            withStyle(SpanStyle(color = c.mutedForeground)) { append(tr("Codice di riferimento") + " ") }
            withStyle(SpanStyle(color = c.foreground, fontFamily = BBTextStyle.Mono.style.fontFamily, fontSize = 14.sp)) { append(reference) }
            withStyle(SpanStyle(color = c.mutedForeground)) { append(tr(". Ti rispondiamo via email.")) }
        }
        SelectionContainer { Text(text, style = BBTextStyle.Body.style) }
        BBButton(tr("Scrivi un'altra segnalazione"), { model.reset() }, Modifier.padding(top = BBSpacing.space1),
            variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
    }
}
