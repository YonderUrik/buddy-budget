package io.buddybudget.app.features.help

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBLinkPart
import io.buddybudget.app.designsystem.components.BBLinkText
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.openUrl
import io.buddybudget.app.features.liquidity.debugShows
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.tr
import io.buddybudget.core.domain.support.HelpLaunch
import io.buddybudget.core.domain.support.ReportContext
import io.buddybudget.core.domain.support.ReportSource
import io.buddybudget.core.domain.support.Support

/**
 * «Aiuto e segnalazioni» (`/aiuto`, SUP-001…007): status line, then Scrivici (report form), Risposte rapide (FAQ) and
 * Su GitHub. `?da=` / `?tipo=` arrive through `ShellModel.takeHelpLaunch`. Twin of `HelpScreen` on iOS.
 */
@Composable
fun HelpScreen() {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val dark = BuddyBudgetTheme.isDark
    val launch = remember { shell.takeHelpLaunch() ?: HelpLaunch() }
    val model = remember { ReportFormModel(env.quickReport.api, ReportSource.Pagina, initialKind = launch.kind) }
    var openFaq by remember { mutableStateOf(setOfNotNull(DebugLaunch.value("bbFaqOpen"))) }
    val context = ReportContextFactory.make(launch.contextPath, dark)
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { model.applyDebugLaunch(context, scope) }

    BBScreen(tr("Aiuto e segnalazioni"), onBack = LocalShellBack.current) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            if (debugShows(0)) Intro()
            if (debugShows(1)) {
                HelpSection({ BBIconView(BBIcon.MessageSquare, color = BuddyBudgetTheme.colors.primary) }, tr("Scrivici"),
                    tr("Un problema, una domanda o un'idea: ti rispondiamo via email.")) {
                    ReportFormView(model, context)
                }
            }
            if (debugShows(2)) {
                HelpSection({ BBIconView(BBIcon.CircleQuestionMark, color = BuddyBudgetTheme.colors.primary) }, tr("Risposte rapide"),
                    tr("Le domande che riceviamo più spesso.")) {
                    Faq(openFaq) { id -> openFaq = if (id in openFaq) openFaq - id else openFaq + id }
                }
            }
            HelpSection({ GithubMark(BuddyBudgetTheme.colors.primary) }, tr("Su GitHub"),
                tr("BuddyBudget è open source: puoi seguire e segnalare anche da lì.")) {
                GithubLinks(context)
            }
        }
    }
}

/** Subtitle and the service-status line (SUP-004). */
@Composable
private fun Intro() {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(tr("Puoi scriverci anche da qualsiasi pagina, con l'icona del fumetto, e dai messaggi d'errore."),
            style = BBTextStyle.Body.style, color = c.mutedForeground)
        BBLinkText(
            listOf(
                BBLinkPart.Plain(tr("L'app è lenta o non risponde? Guarda prima lo") + " "),
                BBLinkPart.Link(tr("stato del servizio"), Support.STATUS_URL),
                BBLinkPart.Plain("."),
            ),
            style = BBTextStyle.Body.style, color = c.mutedForeground, linkColor = c.foreground, linkWeight = FontWeight.W500,
        )
    }
}

/** SUP-006: each answer opens and closes on its own. */
@Composable
private fun Faq(open: Set<String>, onToggle: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Support.faq.forEach { item ->
            val isOpen = item.id in open
            val rotation by animateFloatAsState(if (isOpen) 45f else 0f, tween(150), label = "faq")
            Column(Modifier.fillMaxWidth().padding(vertical = BBSpacing.space3)) {
                Row(
                    Modifier.fillMaxWidth().defaultMinSize(minHeight = 36.dp)
                        .bbPressable({ onToggle(item.id) }, RoundedCornerShape(BBRadius.md), translate = false)
                        .semantics { role = Role.Button; selected = isOpen },
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BBText(tr(item.question), Modifier.weight(1f), BBTextStyle.BodyStrong.style)
                    BBIconView(BBIcon.Plus, Modifier.rotate(rotation), color = c.mutedForeground)
                }
                if (isOpen) {
                    BBText(tr(item.answer), Modifier.padding(top = BBSpacing.space2, end = BBSpacing.space6), BBTextStyle.Body.style,
                        color = c.mutedForeground)
                }
            }
        }
    }
}

/** SUP-007: the four external links with their hints, opened in the browser. */
@Composable
private fun GithubLinks(context: ReportContext) {
    val c = BuddyBudgetTheme.colors
    val android = LocalContext.current
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Support.githubLinks(context).forEach { link ->
            Column(
                Modifier.fillMaxWidth().defaultMinSize(minHeight = BBLayout.minTouchTarget)
                    .bbPressable({ openUrl(android, link.href) }, RoundedCornerShape(BBRadius.md), translate = false)
                    .padding(vertical = BBSpacing.space1)
                    .semantics { role = Role.Button },
                verticalArrangement = Arrangement.Center,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5), verticalAlignment = Alignment.CenterVertically) {
                    if (link.id == io.buddybudget.core.domain.support.GithubLink.Id.Issue) GithubMark(c.foreground)
                    BBText(tr(link.label), style = BBTextStyle.BodyStrong.style)
                    BBIconView(BBIcon.ExternalLink, size = 14.dp, color = c.mutedForeground)
                }
                BBText(tr(link.hint), style = BBTextStyle.Caption.style, color = c.mutedForeground)
            }
        }
    }
}

@Composable
private fun GithubMark(color: androidx.compose.ui.graphics.Color) {
    Icon(painterResource(R.drawable.github_mark), contentDescription = null, modifier = Modifier.size(16.dp), tint = color)
}

/**
 * Open section with a tinted icon tile (web `Section` of the help page): tile 36 radius lg `--primary @ 10%`, icon 16,
 * title font-heading text-lg medium, description text-sm muted, gap 16.
 */
@Composable
private fun HelpSection(icon: @Composable () -> Unit, title: String, description: String, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        // #427: the title stands alone, no icon tile (`icon` is kept for the call sites).
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(title, Modifier.semantics { heading() }, BBStyles.sectionHeading)
            BBText(description, style = BBTextStyle.Body.style, color = c.mutedForeground)
        }
        content()
    }
}
