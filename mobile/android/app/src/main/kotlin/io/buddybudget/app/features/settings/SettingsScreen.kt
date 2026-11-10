package io.buddybudget.app.features.settings

import io.buddybudget.app.features.overview.InsightsModulesSettingsSection

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.BBStyles
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.AppVersion
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.features.shell.MoreRow
import io.buddybudget.app.features.shell.ShellRoute
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.domain.settings.SettingsGroup
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

/** Impostazioni hub (SET-001…004): list of the five groups, each pushing its detail screen; version at the bottom. */
@Composable
fun SettingsScreen() {
    val shell = LocalShell.current
    val model = shell.settings
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { model.start() }
    BBScreen(l10n(R.string.settings_8f710a), onBack = LocalShellBack.current) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            BBText(l10n(R.string.your_profile_preferences_and_control_ove_414f71), Modifier.pullUp(12.dp), BBTextStyle.Body.style, color = c.mutedForeground)
            when (model.settings) {
                is Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    repeat(5) { BBSkeleton(height = 64.dp, radius = BBRadius.xl) }
                }
                is Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_settings_6eb1bf), { scope.launch { model.loadSettings() } })
                is Loadable.Loaded -> Column {
                    SettingsGroup.entries.forEach { group ->
                        SettingsGroupRow(group) { shell.push(ShellRoute.SettingsGroupRoute(group)) }
                    }
                }
            }
            BBText(
                l10n(R.string.version_0_c76abd, AppVersion.label), Modifier.fillMaxWidth().padding(top = BBSpacing.space4),
                BBTextStyle.Caption.style.copy(textAlign = TextAlign.Center), color = c.text3,
            )
        }
    }
}

/** A Settings group (SET-002): «‹» back to the list, title, summary and its sections. */
@Composable
fun SettingsGroupScreen(group: SettingsGroup) {
    val shell = LocalShell.current
    val model = shell.settings
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    LaunchedEffect(group) {
        if (model.settings.valueOrNull == null) model.start()
        model.loadGroup(group)
    }
    BBScreen(tr(group.label), onBack = LocalShellBack.current) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
            BBText(tr(group.summary), Modifier.pullUp(12.dp), BBTextStyle.Body.style, color = c.mutedForeground)
            val settings = model.settings.valueOrNull
            when {
                settings != null -> when (group) {
                    SettingsGroup.Account -> {
                        ProfileSection(model, settings)
                        SessionsSection(model)
                    }
                    SettingsGroup.Aspetto -> {
                        PreferencesSection(model, settings)
                        InsightsModulesSettingsSection()
                    }
                    SettingsGroup.Notifiche -> {
                        NotificationsSection(model, settings)
                        AiSection(model)
                    }
                    SettingsGroup.Privacy -> {
                        PrivacySection(settings)
                        DataSection(model, settings)
                    }
                    SettingsGroup.Pericolo -> DangerZoneSection(model, settings)
                }
                model.settings is Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_settings_6eb1bf), { scope.launch { model.loadSettings() } })
                else -> BBSkeleton(height = 160.dp, radius = BBRadius.xl)
            }
        }
    }
}

// ---------------------------------------------------------------- Building blocks

/** Settings section (web `SettingsSection`): tinted icon tile 36 + title + description, then content. */
@Composable
fun SettingsSection(title: String, icon: BBIcon, description: String? = null, danger: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        // taste-skill (#427): the section stands on its title, no icon tile (`icon` is kept for the callers).
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
            BBText(title, Modifier.semantics { heading() }, BBStyles.titleSmall.copy(fontWeight = FontWeight.W600), color = if (danger) c.neg else c.foreground)
            if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4), content = content)
    }
}

/** Label + hint + control stacked (web `SettingsRow` on a phone), top border except the first. */
@Composable
fun SettingsRow(label: String, hint: String? = null, first: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(top = if (first) 0.dp else BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                BBText(label, BBTextStyle.BodyStrong)
                if (hint != null) BBText(hint, BBTextStyle.Caption, color = c.mutedForeground)
            }
            content()
        }
    }
}

/** Label/hint on the left and a switch on the right (notification rows, AI toggles). */
@Composable
fun SettingsSwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit, hint: String? = null, first: Boolean = false, enabled: Boolean = true, ai: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(top = if (first) 0.dp else BBSpacing.space4), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                // `ai`: the setting sends data to an AI model when on (SET-050).
                if (ai) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBText(label, BBTextStyle.BodyStrong)
                        AiBadge()
                    }
                } else BBText(label, BBTextStyle.BodyStrong)
                if (hint != null) BBText(hint, BBTextStyle.Caption, color = c.mutedForeground)
            }
            BBSwitch(checked, onChange, accessibilityLabel = label, enabled = enabled)
        }
    }
}

/** Inline status line (success / error) under a control. */
@Composable
fun StatusLine(text: String, success: Boolean = false) {
    val c = BuddyBudgetTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        if (success) BBIconView(BBIcon.Check, size = 14.dp, color = c.pos)
        BBText(text, BBTextStyle.Caption, color = if (success) c.pos else c.neg)
    }
}

/** Negative top margin (iOS `.padding(.top, -n)`): moves the node up and shortens its layout by [amount]. */
fun Modifier.pullUp(amount: androidx.compose.ui.unit.Dp): Modifier = this.then(
    androidx.compose.ui.Modifier.layout { measurable, constraints ->
        val placeable = measurable.measure(constraints)
        val shift = amount.roundToPx()
        layout(placeable.width, (placeable.height - shift).coerceAtLeast(0)) { placeable.place(0, -shift) }
    },
)

/** A group in the Impostazioni list on the phone (web `SettingsHub`): the name as a condensed display title (30), the
 *  summary under it and a chevron; no icon, no rules. */
@Composable
private fun SettingsGroupRow(group: SettingsGroup, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = 64.dp)
            .bbPressable(onClick, RoundedCornerShape(BBRadius.radius2xl), pressedBackground = c.muted, translate = false)
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = BBSpacing.space1, vertical = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
            BBText(tr(group.label), style = BBStyles.sectionHeading.copy(fontSize = 30.sp, lineHeight = 30.sp), color = if (group.isDanger) c.neg else c.foreground)
            BBText(tr(group.summary), BBTextStyle.Body, color = c.text2)
        }
        BBIconView(BBIcon.ChevronRight, color = c.text3)
    }
}
