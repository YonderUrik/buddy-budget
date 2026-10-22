package io.buddybudget.app.features.overview

import androidx.compose.ui.semantics.selected
import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.launch
import io.buddybudget.app.designsystem.components.BBSheet
import androidx.compose.ui.semantics.Role
import androidx.compose.runtime.rememberCoroutineScope
import io.buddybudget.core.domain.overview.StartFocus
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBColors
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBSwatch
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.data.StartStatus
import io.buddybudget.core.domain.overview.Greeting
import io.buddybudget.core.domain.overview.InvestmentsPulse
import io.buddybudget.core.domain.overview.OverviewContent
import io.buddybudget.core.domain.overview.OverviewVoice
import io.buddybudget.core.domain.overview.StartChecklist
import io.buddybudget.core.domain.overview.StartStepDefinition
import io.buddybudget.core.domain.periods.CalendarDate
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/**
 * Panoramica (02-overview): greeting with the date, «Novità» and the voice sentences, renewal banner, then the
 * checklist, net worth, composition, month, dues, goals and investments in one column (mobile adaptation).
 * Twin of `OverviewScreen` on iOS.
 */
@Composable
fun OverviewScreen() {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val model = shell.overview
    val locale = LocalBBLocale.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        now = System.currentTimeMillis()
        model.activate()
        model.applyDebugLaunch()
    }
    // OV-038: the tab content is recreated on every visit, so activation runs each time the Overview shows again.
    val hour = LocalTime.now(ZoneId.systemDefault()).hour
    val greeting = Greeting.title(tr(Greeting.source(hour)), env.session.bootstrap?.user?.name)
    BBScreen(greeting, onRefresh = { model.refresh() }, titleStyle = io.buddybudget.app.designsystem.components.BBStyles.greetingTitle) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            if (OverviewDebug.shows("header")) {
                OverviewHeader(model, Greeting.dateLabel(CalendarDate.of(Instant.ofEpochMilli(now), ZoneId.systemDefault()), locale), Modifier.offset(y = -BBSpacing.space3))
                val alerts = model.view?.renewalAlerts.orEmpty()
                if (alerts.isNotEmpty()) OverviewRenewalBanner(alerts) { shell.open("/liquidita/conti?rinnova=panoramica") }
            }
            when (val content = model.content) {
                OverviewContent.Loading -> OverviewSkeleton()
                OverviewContent.Failed -> LoadError(tr("Impossibile caricare i dati della panoramica."), model::retry)
                is OverviewContent.Empty -> EmptyOverviewLayout(model)
                is OverviewContent.Loaded -> LoadedOverviewLayout(model, content.view)
            }
        }
    }
}

// ---------------------------------------------------------------- Header

/** Date with the «Novità» chip (OV-002, SHELL-049), then the voice sentences (OV-003/004, masked figures OV-021). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OverviewHeader(model: OverviewModel, dateLabel: String, modifier: Modifier = Modifier) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    Column(modifier, verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(dateLabel, BBTextStyle.Body, color = c.mutedForeground)
            model.whatsNewEntry?.let { WhatsNewChip(it, model) }
        }
        val lines = model.view?.voice.orEmpty()
        if (lines.isNotEmpty()) {
            val segments = OverviewVoice.segments(lines, hide)
            val text = buildAnnotatedString {
                segments.forEach { s ->
                    if (s.strong) {
                        withStyle(SpanStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W500, color = c.foreground, fontFeatureSettings = "tnum")) {
                            // Figures never break inside (web `whitespace-nowrap`).
                            append(s.text.replace(' ', ' '))
                        }
                    } else {
                        append(s.text)
                    }
                }
            }
            Text(text, style = BBTextStyle.BodyLarge.style.copy(fontSize = 18.sp, lineHeight = 29.sp, color = c.text2))
        }
    }
}

// ---------------------------------------------------------------- States

/** OV-005: three blocks while loading (h-80, h-36, h-28). */
@Composable
private fun OverviewSkeleton() {
    val loading = l10n(L10n.loading)
    Column(Modifier.clearAndSetSemantics { contentDescription = loading }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        BBSkeleton(height = 320.dp, radius = BBRadius.xl)
        BBSkeleton(height = 144.dp, radius = BBRadius.xl)
        BBSkeleton(height = 112.dp, radius = BBRadius.xl)
    }
}

/** OV-007: one column with the checklist forced visible (sample data beside the next step), or «Nessun conto ancora». */
@Composable
private fun EmptyOverviewLayout(model: OverviewModel) {
    val shell = LocalShell.current
    val start = model.start
    if (start != null) {
        if (StartChecklist.isVisible(start, forced = true)) StartChecklistSection(model, start, forced = true)
    } else {
        EmptyState(
            BBIcon.Wallet, tr("Nessun conto ancora"), tr("Aggiungi un conto per vedere il tuo patrimonio netto."),
            primary = BBStateAction(tr("Crea un conto")) { shell.open("/liquidita/conti?nuovo=1") },
        )
    }
}

/** Full layout (OV-008…036), phone order: checklist, chart, composition, month, dues, goals, investments. */
@Composable
private fun LoadedOverviewLayout(model: OverviewModel, view: OverviewView) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        val start = model.start
        if (start != null && StartChecklist.isVisible(start, forced = false) && OverviewDebug.shows("checklist")) {
            StartChecklistSection(model, start, forced = false)
        }
        if (OverviewDebug.shows("chart")) NetWorthCard(model, view)
        Column(
            Modifier.padding(top = if (OverviewDebug.shows("chart")) BBSpacing.space5 else 0.dp),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space10),
        ) {
            if (OverviewDebug.shows("composition")) CompositionSection(model, view)
            if (OverviewDebug.shows("month")) MonthPaceSection(view)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
                if (OverviewDebug.shows("dues")) UpcomingDuesSection(view)
                if (OverviewDebug.shows("goals")) GoalsSection(model)
                view.investments?.let { InvestmentsPulseSection(InvestmentsPulse(it), view.currency) }
            }
        }
    }
}

// ---------------------------------------------------------------- «Primi passi» (OV-033…048, web #444/#452)

/**
 * «Primi passi»: the next step alone in a filled block with its main action (sample data beside it for a new user,
 * «Non mi serve» for every step but the account), the other steps as a list that ticks itself, and
 * «Cambia cosa vuoi tenere sotto controllo». Twin of `StartChecklistSection` on iOS.
 */
@Composable
fun StartChecklistSection(model: OverviewModel, status: StartStatus, forced: Boolean) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    var focusOpen by remember { mutableStateOf(false) }
    val nextId = StartChecklist.nextStep(status)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                OverviewSectionHeading(BBIcon.ListChecks, tr("Primi passi"), c.swatchTeal)
                val line = StartChecklist.statusLine(status)
                BBText(tr(line.source, line.values), BBTextStyle.Body, color = c.text2)
            }
            if (!forced) {
                Box(Modifier.offset(x = BBSpacing.space2).bbDisabled(model.dismissingChecklist)) {
                    BBIconButton(BBIcon.X, tr("Nascondi i primi passi")) { model.dismissChecklist() }
                }
            }
        }
        if (nextId != null) NextStepBlock(model, model.step(nextId), forced)
        val rest = status.askedSteps.filter { it != nextId }
        if (rest.isNotEmpty()) {
            Column {
                rest.forEach { id ->
                    StepRow(model.step(id), StartChecklist.rowState(status, id), onCta = { shell.open(model.step(id).path) }, onRestore = { model.setSkipped(id, false) })
                }
            }
        }
        BBButton(tr("Cambia cosa vuoi tenere sotto controllo"), { focusOpen = true }, variant = BBButtonVariant.Link, size = BBButtonSize.Touch)
    }
    FocusSheet(model, status, focusOpen) { focusOpen = false }
}

/** OV-045: the next step in a filled block; OV-048 acknowledgement above it. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NextStepBlock(model: OverviewModel, step: StartStepDefinition, forced: Boolean) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    Column(
        Modifier.fillMaxWidth().background(c.card, RoundedCornerShape(BBRadius.radius4xl)).padding(BBSpacing.space5),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space4),
    ) {
        val acknowledged = model.acknowledged
        if (acknowledged.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconView(BBIcon.Check, size = 16.dp, color = c.pos)
                val strings = io.buddybudget.app.generated.LocalStrings.current
                BBText(acknowledged.joinToString(" · ") { strings.lookup(model.step(it).done) }, BBTextStyle.BodyStrong, color = c.pos)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(tr("Prossimo passo"), BBTextStyle.Body, color = c.text2)
            BBText(tr(step.title), style = BBStyles.screenTitle)
            BBText(tr(step.description), BBTextStyle.BodyLarge, color = c.text2)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(tr(step.cta), { shell.open(step.path) }, size = BBButtonSize.Touch)
            if (forced) {
                BBButton(
                    if (model.demoStarting) tr("Preparo l'esempio…") else tr("Prima prova con dati d'esempio"), model::startDemo,
                    variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, enabled = !model.demoStarting,
                )
            }
            if (StartChecklist.canSkip(step.id)) {
                BBButton(tr("Non mi serve"), { model.setSkipped(step.id, true) }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, enabled = !model.updatingStart)
            }
        }
        if (forced) model.demoStartError?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
    }
}

@Composable
private fun StepRow(step: StartStepDefinition, state: StartChecklist.RowState, onCta: () -> Unit, onRestore: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val done = state == StartChecklist.RowState.Done
    val doneLabel = tr("Fatto")
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Box(
            Modifier.size(28.dp).background(if (done) c.primary else Color.Transparent, CircleShape)
                .border(1.dp, if (done) c.primary else c.border, CircleShape),
            contentAlignment = Alignment.Center,
        ) { if (done) BBIconView(BBIcon.Check, size = 16.dp, color = c.primaryForeground) }
        BBText(
            if (state == StartChecklist.RowState.Skipped) "${tr(step.title)} · ${tr("Saltato")}" else tr(step.title),
            Modifier.weight(1f).semantics(mergeDescendants = true) { if (done) stateDescription = doneLabel },
            style = (if (state == StartChecklist.RowState.Todo) BBTextStyle.BodyStrong.style else BBTextStyle.Body.style)
                .copy(textDecoration = if (done) TextDecoration.LineThrough else null),
            color = if (state == StartChecklist.RowState.Todo) c.foreground else c.text2,
        )
        when (state) {
            StartChecklist.RowState.Skipped -> BBButton(tr("Rimetti"), onRestore, variant = BBButtonVariant.Link, size = BBButtonSize.Touch)
            StartChecklist.RowState.Todo -> BBButton(tr(step.cta), onCta, variant = BBButtonVariant.Link, size = BBButtonSize.Touch)
            StartChecklist.RowState.Done -> Unit
        }
    }
}

/** OV-047 / AUTH-058: «Cosa vuoi tenere sotto controllo?» as a sheet, preselected with the saved answer. */
@Composable
private fun FocusSheet(model: OverviewModel, status: StartStatus, open: Boolean, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var value by remember(open) { mutableStateOf(status.focus.orEmpty().mapNotNull { StartFocus.of(it) }) }
    BBSheet(open, onClose, tr("Cosa vuoi tenere sotto controllo?")) {
        BBText(tr("I primi passi cambiano con la tua scelta. Senza nessuna scelta restano i quattro di partenza."), BBTextStyle.Body, color = c.text2)
        FocusPicker(model.focusOptions, value, enabled = !model.updatingStart) { value = it }
        model.focusError?.let { BBText(it, BBTextStyle.Body, color = c.neg) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(
                if (model.updatingStart) tr("Salvataggio in corso…") else tr("Salva"),
                { scope.launch { if (model.saveFocus(value)) onClose() } },
                size = BBButtonSize.Touch, fullWidth = true, isLoading = model.updatingStart,
            )
            BBButton(tr("Annulla"), onClose, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true)
        }
    }
}

/** The four answers as toggle tiles (several at once, none allowed); shared with onboarding (AUTH-058). */
@Composable
fun FocusPicker(options: List<StartFocus>, value: List<StartFocus>, enabled: Boolean = true, onChange: (List<StartFocus>) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val label = tr("Cosa vuoi tenere sotto controllo?")
    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        options.forEach { option ->
            val selected = option in value
            val shape = RoundedCornerShape(BBRadius.xl)
            Row(
                Modifier.fillMaxWidth()
                    .background(if (selected) c.accent else c.card, shape)
                    .border(if (selected) 2.dp else 1.dp, if (selected) c.primary else c.border, shape)
                    .bbPressable({ onChange(if (selected) value - option else value + option) }, shape, translate = false, enabled = enabled, role = Role.Checkbox)
                    .semantics { this.selected = selected }
                    .padding(BBSpacing.space4),
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                BBIconView(BBIcon.forKey(option.iconKey) ?: BBIcon.Wallet, Modifier.padding(top = 2.dp), size = 20.dp, color = if (selected) c.primary else c.text2)
                Column(Modifier.weight(1f)) {
                    BBText(tr(option.title), BBTextStyle.BodyStrong)
                    BBText(tr(option.description), BBTextStyle.Body, color = c.text2)
                }
                Box(
                    Modifier.size(24.dp).background(if (selected) c.primary else Color.Transparent, CircleShape)
                        .border(1.dp, if (selected) c.primary else c.border, CircleShape),
                    contentAlignment = Alignment.Center,
                ) { if (selected) BBIconView(BBIcon.Check, size = 14.dp, color = c.primaryForeground) }
            }
        }
    }
}

// ---------------------------------------------------------------- Renewal banner (OV-029)

/** Bank-connection renewal alert (`RenewalBanner` of the Accounts area, Overview variant linking to Conti). */
@Composable
fun OverviewRenewalBanner(alerts: List<OverviewView.RenewalAlert>, onRenew: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth()
            .background(c.destructive.copy(alpha = 0.1f), RoundedCornerShape(BBRadius.xl))
            .border(1.dp, c.destructive.copy(alpha = 0.3f), RoundedCornerShape(BBRadius.xl))
            .padding(BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBIconView(BBIcon.TriangleAlert, size = 18.dp, color = c.destructive)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            alerts.forEach { BBText(it.message, BBTextStyle.Body) }
        }
        BBButton(tr("Rinnova"), onRenew, size = BBButtonSize.Sm)
    }
}

// ---------------------------------------------------------------- Shared bits

/** Overview section heading (`SectionHeading`): 36 tinted circle with an 18 icon, title text-lg, optional link. */
@Composable
fun OverviewSectionHeading(icon: BBIcon, title: String, color: Color, linkLabel: String? = null, onLink: (() -> Unit)? = null) {
    val c = BuddyBudgetTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        // #427: the display-face title alone (`icon`/`color` kept for call sites, not drawn).
        BBText(title, Modifier.weight(1f).semantics { heading() }, BBStyles.sectionHeading)
        if (linkLabel != null && onLink != null) {
            Row(
                Modifier.offset(x = BBSpacing.space2)
                    .heightIn(min = BBLayout.minTouchTarget)
                    .bbPressable(onLink, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                    .padding(horizontal = BBSpacing.space2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
            ) {
                BBText(linkLabel, style = BBStyles.link, color = c.primary)
                BBIconView(BBIcon.ArrowRight, color = c.primary)
            }
        }
    }
}

/** Color of an Overview token (`primary`, `pos`, `neg`, `swatch-*`) as returned by :core. */
fun overviewTokenColor(c: BBColors, token: String): Color = when (token) {
    "primary" -> c.primary
    "pos" -> c.pos
    "neg" -> c.neg
    else -> BBSwatch.color(c, token.removePrefix("swatch-"))
}

/**
 * DEBUG-only `--es bbFrom <section>`: start the screen at a section (header, checklist, chart, composition, month,
 * dues, goals) so long-screen screenshots are deterministic on both platforms. Always true in release.
 */
object OverviewDebug {
    private val order = listOf("header", "checklist", "chart", "composition", "month", "dues", "goals")

    fun shows(section: String): Boolean {
        val from = DebugLaunch.value("bbFrom") ?: return true
        val start = order.indexOf(from)
        val index = order.indexOf(section)
        if (start < 0 || index < 0) return true
        return index >= start
    }
}
