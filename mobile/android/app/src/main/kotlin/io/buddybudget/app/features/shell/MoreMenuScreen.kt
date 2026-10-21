package io.buddybudget.app.features.shell

import io.buddybudget.app.features.overview.InsightsDebug
import io.buddybudget.app.features.overview.InsightsSection

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.AppVersion
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.openUrl
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.domain.shell.ExternalLinks
import io.buddybudget.core.domain.shell.Initials
import io.buddybudget.core.domain.shell.Navigation
import kotlinx.coroutines.launch

/** Row title 15 semibold (web `text-[15px] font-semibold leading-tight`). */
val MoreRowTitle = BBTextStyle.BodyLarge.style.copy(fontSize = 15.sp, lineHeight = 19.sp, fontWeight = FontWeight.W600)

/**
 * «Altro» (SHELL-018…021), root of the fifth tab: account row, other sections, support, hide amounts, sign out,
 * legal links and version. («Il tuo quadro» summary modules: deferred to the sidebar-insights work.)
 */
@Composable
fun MoreMenuScreen() {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var legal by remember { mutableStateOf<LegalMeta?>(null) }
    LaunchedEffect(env.session.language) { legal = env.session.loadLegal() }
    BBScreen(l10n(R.string.more_ef204e)) {
        if (InsightsDebug.onTop) InsightsSection()
        AccountRow { shell.push(ShellRoute.Destination(AppDestination.Settings)) }
        val others = Navigation.otherSections(env.session.sections)
        if (others.isNotEmpty()) {
            MoreSectionTitle(l10n(R.string.other_sections_e2da8d))
            others.forEach { destination ->
                MoreRow(destination.iconKey?.let(BBIcon::forKey) ?: BBIcon.CircleDashed, tr(destination.title), destination.moreMenuHint?.let { tr(it) }) {
                    shell.push(ShellRoute.Destination(destination))
                }
            }
        }
        MoreSectionTitle(l10n(R.string.support_73e96e))
        MoreRow(BBIcon.SlidersHorizontal, l10n(R.string.settings_8f710a), l10n(R.string.appearance_notifications_privacy_and_dat_78c5d6)) {
            shell.push(ShellRoute.Destination(AppDestination.Settings))
        }
        MoreRow(BBIcon.LifeBuoy, l10n(R.string.help_and_feedback_d5fc89), l10n(R.string.questions_problems_and_ideas_80144f)) {
            shell.push(ShellRoute.Destination(AppDestination.Help))
        }
        val hide = l10n(R.string.hide_amounts_874f22)
        Row(
            Modifier.padding(top = BBSpacing.space2).fillMaxWidth().heightIn(min = 56.dp)
                .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            Box(Modifier.size(40.dp).background(c.muted, RoundedCornerShape(BBRadius.xl)), contentAlignment = Alignment.Center) {
                BBIconView(BBIcon.EyeOff, size = 20.dp, color = c.text2)
            }
            Column(Modifier.weight(1f)) {
                BBText(hide, style = MoreRowTitle)
                BBText(l10n(R.string.useful_when_someone_can_see_your_screen_ee2e33), BBTextStyle.Caption, color = c.text2)
            }
            BBSwitch(env.privacy.hideAmounts, { scope.launch { env.session.setHideAmounts(it) } }, accessibilityLabel = hide)
        }
        if (!InsightsDebug.onTop) InsightsSection()
        Column(Modifier.padding(top = BBSpacing.space4)) {
            Column(Modifier.padding(top = BBSpacing.space3), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp)
                        .bbPressable({ scope.launch { env.session.signOut() } }, RoundedCornerShape(BBRadius.xl), pressedBackground = c.muted, translate = false)
                        .padding(horizontal = BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    BBIconView(BBIcon.LogOut, size = 20.dp, color = c.neg)
                    BBText(l10n(R.string.sign_out_0f7014), style = BBTextStyle.BodyLarge.style.copy(fontSize = 15.sp, fontWeight = FontWeight.W500), color = c.neg)
                }
                val legalLabel = l10n(R.string.legal_information_770938)
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = BBSpacing.space1).semantics { contentDescription = legalLabel },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
                ) {
                    ExternalLinks.legalDocuments.forEach { id ->
                        val label = when (id) {
                            "privacy" -> l10n(R.string.privacy_cf0148)
                            "termini" -> l10n(R.string.terms_b7cf91)
                            else -> l10n(R.string.cookies_e4f819)
                        }
                        Box(
                            Modifier.heightIn(min = BBLayout.minTouchTarget)
                                .bbPressable({ openUrl(context, ExternalLinks.legal(id, legal)) }, RoundedCornerShape(BBRadius.md), translate = false)
                                .padding(horizontal = BBSpacing.space2),
                            contentAlignment = Alignment.Center,
                        ) { BBText(label, BBTextStyle.Caption, color = c.text2) }
                    }
                    Spacer(Modifier.weight(1f))
                    BBText(AppVersion.label, BBTextStyle.Caption, color = c.text3)
                }
            }
        }
    }
}

@Composable
private fun AccountRow(onClick: () -> Unit) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val name = env.session.bootstrap?.user?.name.orEmpty()
    val display = name.ifEmpty { l10n(R.string.your_account_d59755) }
    val email = env.session.bootstrap?.user?.email
    Row(
        Modifier.fillMaxWidth().heightIn(min = 64.dp)
            .bbPressable(onClick, RoundedCornerShape(BBRadius.xl), background = c.alphaMuted60, pressedBackground = c.muted, translate = false)
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Box(Modifier.size(40.dp).background(c.primary, CircleShape), contentAlignment = Alignment.Center) {
            BBText(Initials.of(display), style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600), color = c.primaryForeground)
        }
        Column(Modifier.weight(1f)) {
            BBText(display, style = MoreRowTitle, maxLines = 1)
            BBText(email ?: l10n(R.string.profile_and_settings_ea03fc), BBTextStyle.Caption, color = c.text2, maxLines = 1)
        }
        BBIconView(BBIcon.Settings, size = 20.dp, color = c.text3)
    }
}

/** Group title in «Altro» (text-sm medium `--text-3`, pt 20 pb 4). */
@Composable
fun MoreSectionTitle(title: String) {
    BBText(
        title,
        Modifier.padding(start = BBSpacing.space3, end = BBSpacing.space3, top = BBSpacing.space5, bottom = BBSpacing.space1).semantics { heading() },
        BBTextStyle.BodyStrong.style, color = BuddyBudgetTheme.colors.text3,
    )
}

/** Navigation row of «Altro» and the Settings hub: tinted icon tile 40, title 15 semibold, hint, chevron. */
@Composable
fun MoreRow(icon: BBIcon, title: String, hint: String? = null, danger: Boolean = false, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp)
            .bbPressable(onClick, RoundedCornerShape(BBRadius.xl), pressedBackground = c.muted, translate = false)
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Box(Modifier.size(40.dp).background(if (danger) c.negSoft else c.alphaPrimary10, RoundedCornerShape(BBRadius.xl)), contentAlignment = Alignment.Center) {
            BBIconView(icon, size = 20.dp, color = if (danger) c.neg else c.primary)
        }
        Column(Modifier.weight(1f)) {
            BBText(title, style = MoreRowTitle, color = if (danger) c.neg else c.foreground)
            if (hint != null) BBText(hint, BBTextStyle.Caption, color = c.text2)
        }
        BBIconView(BBIcon.ChevronRight, color = c.text3)
    }
}
