package io.buddybudget.app.features.help

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.ToastCenter
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.tr
import io.buddybudget.core.data.SupportApi
import io.buddybudget.core.domain.support.ReportError
import io.buddybudget.core.domain.support.ReportErrorArea
import io.buddybudget.core.domain.support.ReportSource
import java.util.UUID

/**
 * One opening of the quick-report sheet (SUP-019…022): where it started, the attached error and the screen it was
 * opened from. Every opening has a new id, so the form starts empty (SUP-022).
 */
data class QuickReportRequest(
    val source: ReportSource,
    val error: ReportError?,
    /** Logical path of the screen behind the sheet (the context path). */
    val path: String,
    val id: String = UUID.randomUUID().toString(),
)

/**
 * Opens the quick-report sheet from anywhere in the signed-in app: the «Scrivici» button and the `Segnala` toast
 * action (SUP-019, SUP-023). Mounted once by the shell ([QuickReportHost]). Twin of `QuickReportCenter` on iOS.
 */
class QuickReportCenter(val api: SupportApi) {
    var request by mutableStateOf<QuickReportRequest?>(null)
    /** Set by the shell: logical web path of the visible screen (mobile note on the technical context). */
    var currentPath: () -> String = { "/" }

    fun makeRequest(source: ReportSource, error: ReportError? = null) = QuickReportRequest(source, error, currentPath())

    fun open(source: ReportSource, error: ReportError? = null) {
        request = makeRequest(source, error)
    }
}

/**
 * Set only inside the signed-in shell: report links render nothing without it (as on the web, where the sheet's
 * provider lives in the authenticated layout).
 */
val LocalQuickReport = staticCompositionLocalOf<QuickReportCenter?> { null }

/** SHELL-023: the «Scrivici» top-bar button of the tab roots (`BBScreen` shows it when set and there is no back). */
val LocalOpenScrivici = compositionLocalOf<(() -> Unit)?> { null }

/** Mounts the quick-report sheet once for the whole signed-in app. */
@Composable
fun QuickReportHost(center: QuickReportCenter) {
    // Kept while the sheet animates out (the web keeps the content during the closing animation).
    var shown by remember { mutableStateOf<QuickReportRequest?>(null) }
    val request = center.request
    if (request != null && request != shown) shown = request
    BBSheet(request != null, { center.request = null }, quickReportTitle(shown)) {
        shown?.let { key(it.id) { QuickReportSheet(it, center.api) } }
    }
}

/** `Segnala questo problema` with an attached error, else `Scrivici` (SUP-019, SUP-020). */
@Composable
fun quickReportTitle(request: QuickReportRequest?): String =
    if (request?.error == null) tr("Scrivici") else tr("Segnala questo problema")

/** Body of the quick-report sheet: description, the attached error box and the compact form. */
@Composable
fun QuickReportSheet(request: QuickReportRequest, api: SupportApi) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    val model = remember(request.id) { ReportFormModel(api, request.source, request.error) }
    val context = ReportContextFactory.make(request.path, dark)
    val scope = rememberCoroutineScope()
    LaunchedEffect(request.id) { model.applyDebugLaunch(context, scope) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(tr("Ti rispondiamo via email. Leggiamo tutto."), style = BBTextStyle.Body.style, color = c.mutedForeground)
        request.error?.let { error ->
            Row(
                Modifier.fillMaxWidth().background(c.negSoft, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space3),
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                verticalAlignment = Alignment.Top,
            ) {
                BBIconView(BBIcon.CircleAlert, Modifier.padding(top = 2.dp), color = c.neg)
                Column(Modifier.weight(1f)) {
                    BBText(tr(error.area.label), style = BBTextStyle.BodyStrong.style)
                    BBText(tr(error.message), style = BBTextStyle.Body.style, color = c.mutedForeground)
                }
            }
        }
        ReportFormView(model, context, compact = true)
    }
}

/**
 * `Segnala questo problema` under an error message (web `ReportErrorLink`): opens the sheet with the error attached.
 * Presents its own sheet so it also works inside another sheet or form dialog.
 */
@Composable
fun ReportErrorLink(area: ReportErrorArea, error: String, modifier: Modifier = Modifier) {
    val center = LocalQuickReport.current ?: return
    val c = BuddyBudgetTheme.colors
    var request by remember { mutableStateOf<QuickReportRequest?>(null) }
    var shown by remember { mutableStateOf<QuickReportRequest?>(null) }
    BBText(
        tr("Segnala questo problema"),
        modifier.defaultMinSize(minHeight = 36.dp)
            .bbPressable({ center.makeRequest(ReportSource.Errore, ReportError(area, error)).also { shown = it; request = it } },
                RoundedCornerShape(BBRadius.md), translate = false)
            .padding(vertical = 8.dp)
            .semantics { role = Role.Button },
        BBTextStyle.BodyStrong.style,
        color = c.primary,
    )
    BBSheet(request != null, { request = null }, quickReportTitle(shown)) {
        shown?.let { key(it.id) { QuickReportSheet(it, center.api) } }
    }
}

/** A form's error message with the report link below it (web `ErrorWithReport`). */
@Composable
fun ErrorWithReport(area: ReportErrorArea, error: String, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        BBText(tr(error), style = BBTextStyle.Body.style, color = BuddyBudgetTheme.colors.destructive)
        ReportErrorLink(area, error)
    }
}

/** Error toast with the `Segnala` action (web `errorToast`, SUP-023): opens the sheet with the error attached. */
fun ToastCenter.showError(message: String, area: ReportErrorArea = ReportErrorArea.Salvataggio) {
    val report = reportAction
    if (report == null) show(BBToastKind.Error, message) else show(BBToastKind.Error, message, reportLabel(), { report(ReportError(area, message)) })
}
