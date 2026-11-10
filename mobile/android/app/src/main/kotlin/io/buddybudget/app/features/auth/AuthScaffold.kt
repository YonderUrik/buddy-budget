package io.buddybudget.app.features.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBLinkPart
import io.buddybudget.app.designsystem.components.BBLinkText
import io.buddybudget.app.designsystem.components.BBLogoMark
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.AppLanguage
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.LegalConsent
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.domain.shell.AppRoute
import io.buddybudget.core.domain.shell.ExternalLinks
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em

/** Title of the sign-in pages (web `AUTH_TITLE`, #405): the landing's tall, light display face, 52 sp, leading 0.95. */
val AuthTitle = io.buddybudget.app.designsystem.generated.BBTextStyle.PageTitle.style.copy(fontSize = 52.sp, lineHeight = 49.sp)

/** Login title: the same display title. */
val LoginTitle = AuthTitle

/** Opens an external URL (browser / mail). */
fun openUrl(context: android.content.Context, url: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

/**
 * Frame of the sign-in, onboarding, legal and deactivated screens (web `AuthFrame` on a phone): `--card` surface,
 * brand row with the language picker, the form centred vertically (max 400) and the links to the website at the
 * bottom (AUTH-015, AUTH-016). Same parameters as `AuthScaffold` on iOS.
 */
@Composable
fun AuthScaffold(showsLanguagePicker: Boolean = true, showsFootLinks: Boolean = true, content: @Composable () -> Unit) {
    val c = BuddyBudgetTheme.colors
    BoxWithConstraints(Modifier.fillMaxSize().background(c.card).systemBarsPadding().imePadding()) {
        val minHeight = maxHeight
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        ) {
            Column(
                Modifier.fillMaxWidth().heightIn(min = minHeight)
                    .padding(start = BBSpacing.space5, end = BBSpacing.space5, top = BBSpacing.space6, bottom = BBSpacing.space8),
            ) {
                // #397: the language chooser moved from next to the brand to the end of the foot links.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BrandRow()
                    Spacer(Modifier.weight(1f))
                    if (showsLanguagePicker && !showsFootLinks) LanguagePicker()
                }
                Spacer(Modifier.height(BBSpacing.space10))
                Spacer(Modifier.weight(1f))
                Box(Modifier.widthIn(max = 400.dp).fillMaxWidth()) { content() }
                Spacer(Modifier.height(BBSpacing.space10))
                Spacer(Modifier.weight(1f))
                if (showsFootLinks) AuthFootLinks(showsLanguagePicker)
            }
        }
    }
}

@Composable
private fun BrandRow() {
    val context = LocalContext.current
    val label = tr("{0}: torna al sito", mapOf("0" to l10n(L10n.appName)))
    Row(
        Modifier.bbPressable({ openUrl(context, ExternalLinks.LANDING) }, RoundedCornerShape(BBRadius.md), translate = false)
            .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5),
    ) {
        BBLogoMark(29.dp)
        BBText(l10n(L10n.appName), style = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W700, fontSize = 18.sp, lineHeight = 28.sp))
    }
}

/** #397: the flag of a language (English uses the British flag, en-GB formats). */
fun languageFlag(language: AppLanguage): io.buddybudget.app.designsystem.components.BBFlagCode = when (language) {
    AppLanguage.IT -> io.buddybudget.app.designsystem.components.BBFlagCode.IT
    AppLanguage.EN -> io.buddybudget.app.designsystem.components.BBFlagCode.GB
    AppLanguage.DE -> io.buddybudget.app.designsystem.components.BBFlagCode.DE
}

/** Native name of a language. */
@Composable
fun languageName(language: AppLanguage): String = when (language) {
    AppLanguage.IT -> l10n(R.string.italiano_21df73)
    AppLanguage.EN -> l10n(R.string.english_649df0)
    AppLanguage.DE -> l10n(R.string.deutsch_a6a770)
}

/** Language selector of the auth screens (AUTH-015): Italiano / English / Deutsch, opens a sheet. */
@Composable
fun LanguagePicker() {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    var open by remember { mutableStateOf(false) }
    val current = env.session.language
    val label = l10n(R.string.language_a1b8a9)
    val name = languageName(current)
    Row(
        Modifier.bbPressable({ open = true }, RoundedCornerShape(BBRadius.md), translate = false)
            .semantics { contentDescription = "$label: $name" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        io.buddybudget.app.designsystem.components.BBFlag(languageFlag(current), io.buddybudget.app.designsystem.components.BBFlagSize.Sm)
        BBText(name, BBTextStyle.Caption, color = c.text3)
    }
    BBSheet(open, { open = false }, label) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            AppLanguage.entries.forEach { language ->
                val selected = language == current
                Row(
                    Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable({
                            open = false
                            if (env.session.route == AppRoute.SignedOut) env.session.chooseSignedOutLanguage(language)
                            else env.session.applyLanguage(language)
                        }, RoundedCornerShape(BBRadius.md), background = if (selected) c.accent else androidx.compose.ui.graphics.Color.Transparent,
                            pressedBackground = c.accent, translate = false)
                        .padding(horizontal = BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    io.buddybudget.app.designsystem.components.BBFlag(languageFlag(language), io.buddybudget.app.designsystem.components.BBFlagSize.Lg)
                    BBText(languageName(language), Modifier.weight(1f), BBTextStyle.BodyLarge.style)
                    if (selected) BBIconView(BBIcon.Check, color = c.primary)
                }
            }
        }
    }
}

/** «Torna al sito · Sicurezza · Codice aperto · Aiuto» (AUTH-016). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AuthFootLinks(showsLanguagePicker: Boolean = false) {
    val context = LocalContext.current
    val c = BuddyBudgetTheme.colors
    @Composable
    fun link(title: String, url: String, icon: BBIcon? = null) {
        Row(
            Modifier.bbPressable({ openUrl(context, url) }, RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
        ) {
            if (icon != null) BBIconView(icon, size = 14.dp, color = c.text3)
            BBText(title, BBTextStyle.Caption, color = c.text3)
        }
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        link(l10n(R.string.back_to_website_162fa3), ExternalLinks.LANDING, BBIcon.ArrowLeft)
        link(l10n(R.string.security_d480e3), ExternalLinks.SECURITY)
        link(l10n(R.string.open_source_728cec), ExternalLinks.OPEN_SOURCE)
        link(l10n(R.string.help_3df4de), ExternalLinks.HELP)
        if (showsLanguagePicker) LanguagePicker()
    }
}

/** The three legal declarations (AUTH-038 / AUTH-044): bordered box, checkbox + text with links. */
@Composable
fun LegalConsentFields(consent: LegalConsent, onChange: (LegalConsent) -> Unit, legal: LegalMeta?, enabled: Boolean = true) {
    val c = BuddyBudgetTheme.colors
    fun url(id: String) = ExternalLinks.legal(id, legal)
    val sections = (legal?.specificClauseSections ?: listOf(
        "Responsabilità", "Sospensione e chiusura", "Modifiche ai termini", "Legge applicabile, foro e contatti",
    ).map { tr(it) }).joinToString(", ")
    Column(
        Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.lg)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        val age = l10n(R.string.i_confirm_that_i_am_at_least_18_years_ol_68495e)
        ConsentRow(consent.ageConfirmed, { onChange(consent.copy(ageConfirmed = it)) }, age, enabled, true) {
            BBLinkText(listOf(BBLinkPart.Plain(age)), style = BBTextStyle.Body.style, color = c.text2)
        }
        val accept = l10n(R.string.i_accept_the_88e832)
        ConsentRow(consent.termsAccepted, { onChange(consent.copy(termsAccepted = it)) }, accept, enabled, false) {
            BBLinkText(
                listOf(
                    BBLinkPart.Plain("$accept "),
                    BBLinkPart.Link(l10n(R.string.terms_of_service_f7a038), url("termini")),
                    BBLinkPart.Plain(" " + l10n(R.string.and_confirm_i_have_read_the_6e6a82) + " "),
                    BBLinkPart.Link(l10n(R.string.privacy_cf0148), url("privacy")),
                    BBLinkPart.Plain(" " + l10n(R.string.and_the_policy_on_ac0c58) + " "),
                    BBLinkPart.Link(l10n(R.string.cookies_59c826), url("cookie")),
                    BBLinkPart.Plain("."),
                ),
                style = BBTextStyle.Body.style, color = c.text2,
            )
        }
        val clauses = l10n(R.string.i_specifically_approve_pursuant_to_artic_9e73de)
        ConsentRow(consent.specificClausesAccepted, { onChange(consent.copy(specificClausesAccepted = it)) }, clauses, enabled, true) {
            BBLinkText(listOf(BBLinkPart.Plain("$clauses $sections.")), style = BBTextStyle.Body.style, color = c.text2)
        }
    }
}

@Composable
private fun ConsentRow(checked: Boolean, onChange: (Boolean) -> Unit, label: String, enabled: Boolean, tapToggles: Boolean, text: @Composable () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBCheckbox(checked, onChange, Modifier.padding(top = 2.dp), label, enabled)
        Box(
            Modifier.weight(1f).then(
                if (tapToggles && enabled) Modifier.bbPressable({ onChange(!checked) }, RoundedCornerShape(0.dp), translate = false) else Modifier,
            ),
        ) { text() }
    }
}
