package io.buddybudget.app.features.settings

import io.buddybudget.core.domain.settings.AiUsage
import io.buddybudget.core.domain.categorization.CategorizationText
import io.buddybudget.app.designsystem.components.BBBadgeVariant
import io.buddybudget.app.designsystem.components.BBBadge
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BBThemePreference
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBContentType
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBLinkPart
import io.buddybudget.app.designsystem.components.BBLinkText
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextArea
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.DataExporter
import io.buddybudget.app.features.auth.ExportState
import io.buddybudget.app.features.auth.openUrl
import io.buddybudget.app.features.onboarding.LocaleFields
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.AiCategorizationPatch
import io.buddybudget.core.data.DigestFrequency
import io.buddybudget.core.data.LegalMeta
import io.buddybudget.core.data.NotificationPreferencesPatch
import io.buddybudget.core.data.UserSessionView
import io.buddybudget.core.data.UserSettings
import io.buddybudget.core.data.UserSettingsPatch
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.onboarding.NotificationChoices
import io.buddybudget.core.domain.onboarding.NotificationKind
import io.buddybudget.core.domain.settings.DangerConfirmation
import io.buddybudget.core.domain.settings.DataSummaryItems
import io.buddybudget.core.domain.settings.IsoDate
import io.buddybudget.core.domain.settings.PrivacyRequest
import io.buddybudget.core.domain.shell.ExternalLinks
import io.buddybudget.core.domain.shell.HomePage
import io.buddybudget.core.domain.shell.LocaleRules
import kotlinx.coroutines.launch
import java.time.Instant

private fun longDate(iso: String?, locale: BBLocale): String =
    iso?.let(IsoDate::localDay)?.let { BBFormat.formatLongDate(it, locale) } ?: ""

// ---------------------------------------------------------------- Account

/** Profilo (SET-005…008). */
@Composable
fun ProfileSection(model: SettingsModel, settings: UserSettings) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    var name by remember(settings.name) { mutableStateOf(settings.name) }
    val trimmed = name.trim()
    val dirty = trimmed != settings.name
    fun save() {
        if (!dirty || trimmed.isEmpty()) return
        scope.launch { model.saveName(trimmed) }
    }
    SettingsSection(l10n(R.string.profile_afedc6), BBIcon.UserRound) {
        SettingsRow(l10n(R.string.name_13030d), l10n(R.string.your_name_in_the_app_3c9bce), first = true) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBTextField(
                    name, { name = it.take(80); model.nameSaved = false }, Modifier.weight(1f),
                    placeholder = l10n(R.string.your_name_08c411), contentType = BBContentType.Name, onSubmit = ::save,
                )
                BBButton(l10n(R.string.save_c5965d), ::save, variant = BBButtonVariant.Outline, isLoading = model.savingSettings, enabled = dirty && trimmed.isNotEmpty())
            }
            if (model.nameSaved && !dirty) StatusLine(l10n(R.string.name_saved_3e12bb), success = true)
            model.settingsError?.let { StatusLine(it) }
        }
        SettingsRow(l10n(R.string.email_84add5), l10n(R.string.with_buddybudget_since_0_af1fd0, longDate(settings.createdAt, locale))) {
            BBText(settings.email, BBTextStyle.Body)
        }
        SettingsRow(l10n(R.string.sign_in_methods_71262c), l10n(R.string.you_can_sign_in_using_any_of_these_metho_0a4575)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconView(BBIcon.Mail, color = c.mutedForeground)
                BBText(l10n(R.string.email_link_16c205), BBTextStyle.Body)
                BBText(l10n(R.string.active_13c496), BBTextStyle.Caption, color = c.pos)
            }
            // SET-007 «Collega» Google needs the native Google SDK (auth.md R3): shown only when already linked.
            if (settings.googleLinked) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBIconView(BBIcon.Globe, color = c.mutedForeground)
                    BBText(l10n(R.string.google_2b681c), BBTextStyle.Body)
                    BBText(l10n(R.string.connected_26d353), BBTextStyle.Caption, color = c.pos)
                }
            }
        }
    }
}

/** Sessioni attive (SET-009…012). */
@Composable
fun SessionsSection(model: SettingsModel) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    SettingsSection(
        l10n(R.string.active_sessions_36414d), BBIcon.MonitorSmartphone,
        l10n(R.string.devices_you_signed_in_from_sessions_expi_fc49c7, DangerConfirmation.SESSION_IDLE_DAYS.toString()),
    ) {
        when (val state = model.sessions) {
            is Loadable.Loading -> BBSkeleton(height = 96.dp, radius = BBRadius.lg)
            is Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_sessions_07e791), { scope.launch { model.loadSessions() } })
            is Loadable.Loaded -> {
                Column {
                    state.value.forEachIndexed { i, session ->
                        SessionRow(session, model, locale)
                    }
                }
                if (state.value.any { !it.current }) {
                    BBButton(l10n(R.string.sign_out_of_all_other_devices_10c9cf), { scope.launch { model.revoke(null) } },
                        variant = BBButtonVariant.Outline, isLoading = model.revoking == "*", enabled = model.revoking == null)
                }
                model.sessionsError?.let { StatusLine(it) }
            }
        }
    }
}

@Composable
private fun SessionRow(session: UserSessionView, model: SettingsModel, locale: BBLocale) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    val relative = IsoDate.parse(session.lastActiveAt)?.let { BBFormat.formatRelativeTime(it, Instant.now(), locale) } ?: ""
    Row(Modifier.padding(vertical = BBSpacing.space3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBIconView(if (session.mobile) BBIcon.Smartphone else BBIcon.Laptop, size = 20.dp, color = c.mutedForeground)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(l10n(R.string.s_0_on_1_dfea9e, tr(session.browser), tr(session.os)), Modifier.weight(1f, fill = false), BBTextStyle.BodyStrong.style, maxLines = 1)
                if (session.current) BBText(l10n(R.string.this_device_20190e), BBTextStyle.Caption, color = c.pos)
            }
            BBText(
                "${l10n(R.string.last_active_05ac92)} $relative ${l10n(R.string.expires_on_0d35e0)} ${longDate(session.expiresAt, locale)}",
                BBTextStyle.Caption, color = c.mutedForeground,
            )
        }
        if (!session.current) {
            BBButton(l10n(R.string.disconnect_fd7c86), { scope.launch { model.revoke(session.id) } }, variant = BBButtonVariant.Outline,
                size = BBButtonSize.Sm, isLoading = model.revoking == session.id, enabled = model.revoking == null)
        }
    }
}

// ---------------------------------------------------------------- Aspetto e uso

/** Preferenze (SET-013…018). «Barra laterale» is web-only (spec mobile note). */
@Composable
fun PreferencesSection(model: SettingsModel, settings: UserSettings) {
    val env = LocalEnv.current
    val scope = rememberCoroutineScope()
    val currencyTitle = l10n(R.string.currency_04fe77)
    val homeTitle = l10n(R.string.home_page_0d086b)
    SettingsSection(l10n(R.string.preferences_b96737), BBIcon.SlidersHorizontal) {
        SettingsRow(currencyTitle, l10n(R.string.only_changes_how_amounts_are_displayed_s_8f8b31), first = true) {
            BBSelect(
                LocaleRules.currencies.map { it to "${tr(LocaleRules.currencyLabel(it))} (${LocaleRules.currencySymbol(it)})" },
                settings.currency, { value -> scope.launch { model.patch(UserSettingsPatch(currency = value)) } },
                title = currencyTitle, enabled = !model.savingSettings,
            )
        }
        SettingsRow(homeTitle, l10n(R.string.your_landing_page_after_sign_in_73a306)) {
            BBSelect(
                HomePage.options.map { it.path to tr(it.title) }, HomePage.resolve(settings.homePage).path,
                { value -> scope.launch { model.patch(UserSettingsPatch(homePage = value)) } },
                title = homeTitle, enabled = !model.savingSettings,
            )
        }
        val themeLabel = l10n(R.string.theme_6ae1bc)
        SettingsRow(themeLabel, l10n(R.string.applies_to_this_device_ed7d6f)) {
            SegmentedControl(
                listOf(
                    BBThemePreference.LIGHT to l10n(R.string.light_0e54e6),
                    BBThemePreference.DARK to l10n(R.string.dark_396cdd),
                    BBThemePreference.SYSTEM to l10n(R.string.system_c00416),
                ),
                env.preferences.theme, env.preferences::updateTheme, accessibilityLabel = themeLabel,
            )
        }
        Column {
            Box(Modifier.padding(top = BBSpacing.space4)) {
                LocaleFields(
                    settings.productCountry, settings.language, currency = settings.currency, enabled = !model.savingSettings,
                    onCountry = { country ->
                        scope.launch { model.setLocale(country, LocaleRules.languageAfterSwitching(country, settings.language)) }
                    },
                    onLanguage = { language -> scope.launch { model.setLocale(settings.productCountry, language) } },
                )
            }
        }
        model.settingsError?.let { StatusLine(it) }
    }
}

// ---------------------------------------------------------------- Notifiche e AI

/** Notifiche (SET-023…028). */
@Composable
fun NotificationsSection(model: SettingsModel, settings: UserSettings) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    SettingsSection(l10n(R.string.notifications_4d0418), BBIcon.Mail, l10n(R.string.optional_summary_and_alert_emails_to_0_a_0a0a98, settings.email)) {
        when (val state = model.notifications) {
            is Loadable.Loading -> BBSkeleton(height = 96.dp, radius = BBRadius.lg)
            is Loadable.Failed -> StatusLine(l10n(R.string.could_not_load_notification_preferences_6709e3))
            is Loadable.Loaded -> {
                val prefs = state.value
                NotificationKind.settings(env.session.sections.goals).forEachIndexed { i, kind ->
                    SettingsSwitchRow(
                        tr(kind.label), kind.isOn(prefs), { on -> scope.launch { model.setNotification(kind.patch(on)) } },
                        tr(kind.settingsHint), first = i == 0, enabled = !model.savingNotifications,
                    )
                }
                if (prefs.digestEnabled) {
                    val title = l10n(R.string.summary_frequency_54c410)
                    SettingsRow(title, l10n(R.string.the_summary_covers_the_last_completed_pe_7cafd6)) {
                        BBSelect(
                            DigestFrequency.entries.map { it to tr(NotificationChoices.settingsLabel(it)) }, prefs.digestFrequency,
                            { value -> scope.launch { model.setNotification(NotificationPreferencesPatch(digestFrequency = value)) } },
                            title = title, enabled = !model.savingNotifications,
                        )
                    }
                }
                SettingsRow(l10n(R.string.view_an_example_23a159), l10n(R.string.we_will_send_last_month_s_summary_using_91be76)) {
                    val sending = model.exampleState == SettingsModel.ExampleState.Sending
                    BBButton(
                        if (sending) l10n(R.string.sending_169cb1) else l10n(R.string.send_me_an_example_5ef8e2), { scope.launch { model.sendExample() } },
                        variant = BBButtonVariant.Outline, enabled = !sending,
                    )
                    when (val example = model.exampleState) {
                        SettingsModel.ExampleState.Sent -> BBText(l10n(R.string.sent_check_your_inbox_311248), BBTextStyle.Caption, color = c.mutedForeground)
                        is SettingsModel.ExampleState.Failed -> StatusLine(example.message)
                        else -> Unit
                    }
                }
                model.notificationsError?.let { StatusLine(it) }
            }
        }
    }
}

/** «Usa l'AI» tag next to a setting that sends data to an AI model (SET-050). */
@Composable
fun AiBadge() = BBBadge(l10n(R.string.uses_ai_1b54d3), variant = BBBadgeVariant.Soft, icon = BBIcon.Sparkles)

/** «Dove l'app usa l'AI» (SET-050, web #394/#460). */
@Composable
private fun AiUsageSummary() {
    val c = BuddyBudgetTheme.colors
    val env = LocalEnv.current
    val context = LocalContext.current
    var legal by remember { mutableStateOf<LegalMeta?>(null) }
    LaunchedEffect(env.session.language) { legal = env.session.loadLegal() }
    Column(
        Modifier.fillMaxWidth().background(c.alphaMuted50, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(l10n(R.string.where_the_app_uses_ai_1a8c81), BBTextStyle.BodyStrong, Modifier.semantics { heading() })
            AiBadge()
        }
        AiUsage.items.forEach { item ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                BBText(tr(item.title), BBTextStyle.BodyStrong)
                BBText("${tr(item.sent)} ${tr(item.where)}", BBTextStyle.Caption, color = c.mutedForeground)
            }
        }
        BBText(tr(AiUsage.NO_AI_WITHOUT_CONSENT), BBTextStyle.Caption, color = c.mutedForeground)
        BBLinkText(
            listOf(
                BBLinkPart.Plain(tr(AiUsage.ZERO_DATA_RETENTION) + " "),
                BBLinkPart.Link(l10n(R.string.how_it_works_50cba0), ExternalLinks.legal("privacy", legal) + AiUsage.ZDR_ANCHOR),
            ),
            style = BBTextStyle.Caption.style, color = c.mutedForeground,
        )
    }
}

/** Assistente per le categorie (SET-030…033, SET-050). */
@Composable
fun AiSection(model: SettingsModel) {
    val c = BuddyBudgetTheme.colors
    val scope = rememberCoroutineScope()
    var draft by remember { mutableStateOf<String?>(null) }
    SettingsSection(l10n(R.string.category_assistant_272185), BBIcon.Sparkles, l10n(R.string.suggests_categories_for_new_synced_and_i_e20a29)) {
        AiUsageSummary()
        when (val state = model.ai) {
            is Loadable.Loading -> BBSkeleton(height = 64.dp, radius = BBRadius.lg)
            is Loadable.Failed -> StatusLine(l10n(R.string.could_not_load_this_setting_e9e896))
            is Loadable.Loaded -> {
                val ai = state.value
                SettingsSwitchRow(
                    l10n(R.string.suggest_categories_with_ai_8b164f), ai.enabled, { on -> scope.launch { model.setAi(AiCategorizationPatch(enabled = on)) } },
                    if (ai.available) l10n(R.string.when_on_the_cleaned_up_merchant_name_nev_bc3ee4) else l10n(R.string.the_service_is_not_configured_on_this_se_2bc227),
                    first = true, enabled = !model.savingAi && ai.available, ai = true,
                )
                SettingsSwitchRow(
                    l10n(R.string.let_the_app_choose_when_confidence_is_hi_675730), ai.autoApply,
                    { on -> scope.launch { model.setAi(AiCategorizationPatch(autoApply = on)) } },
                    l10n(R.string.does_not_use_ai_on_its_own_your_rules_al_7feaea, CategorizationText.autoApplyPercent), enabled = !model.savingAi,
                )
                val value = draft ?: ai.instructions
                val dirty = value.trim() != ai.instructions
                Column {
                    Column(Modifier.padding(top = BBSpacing.space4), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                            BBText(l10n(R.string.your_ai_instructions_968e64), BBTextStyle.BodyStrong)
                            AiBadge()
                        }
                        BBText(l10n(R.string.explain_how_you_prefer_to_categorise_spe_2e47db), BBTextStyle.Body, color = c.mutedForeground)
                        BBTextArea(value, { draft = it; model.instructionsSaved = false },
                            placeholder = l10n(R.string.for_example_put_meal_deliveries_in_resta_0e5484), maxLength = 2000, enabled = !model.savingAi)
                        BBText("${value.length}${l10n(R.string.s_2000_changes_apply_to_new_suggestions_af_8dddca)}", BBTextStyle.Caption, color = c.mutedForeground)
                        BBButton(
                            if (model.savingAi) l10n(R.string.saving_f71782) else l10n(R.string.save_instructions_357ce9),
                            { scope.launch { model.setAi(AiCategorizationPatch(instructions = value)); if (model.aiError == null) draft = null } },
                            enabled = dirty && !model.savingAi,
                        )
                        if (model.instructionsSaved) BBText(l10n(R.string.instructions_saved_existing_category_ass_c9446e), BBTextStyle.Body, color = c.mutedForeground)
                    }
                }
                model.aiError?.let { StatusLine(it) }
            }
        }
    }
}

// ---------------------------------------------------------------- Privacy e dati

/** Privacy (SET-035, SET-036). «Statistiche d'uso anonime» (SET-034) is not applicable: the apps send no analytics. */
@Composable
fun PrivacySection(settings: UserSettings) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    val locale = LocalBBLocale.current
    var legal by remember { mutableStateOf<LegalMeta?>(null) }
    LaunchedEffect(env.session.language) { legal = env.session.loadLegal() }
    SettingsSection(l10n(R.string.privacy_cf0148), BBIcon.ShieldCheck, l10n(R.string.how_we_handle_your_data_and_how_to_exerc_601729)) {
        SettingsRow(
            l10n(R.string.documents_3a9126),
            if (settings.legalAcceptedAt != null) l10n(R.string.you_accepted_the_0_version_on_1_0ab2a9, settings.legalAcceptedVersion ?: "", longDate(settings.legalAcceptedAt, locale))
            else l10n(R.string.no_recorded_acceptance_found_49f279),
            first = true,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
                ExternalLinks.legalDocuments.forEach { id ->
                    val label = when (id) {
                        "privacy" -> l10n(R.string.privacy_cf0148)
                        "termini" -> l10n(R.string.terms_b7cf91)
                        else -> l10n(R.string.cookies_e4f819)
                    }
                    BBText(
                        label,
                        Modifier.bbPressable({ openUrl(context, ExternalLinks.legal(id, legal)) }, RoundedCornerShape(BBRadius.md), translate = false),
                        BBTextStyle.Body.style.copy(textDecoration = TextDecoration.Underline), color = c.mutedForeground,
                    )
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBLinkText(
                listOf(
                    BBLinkPart.Plain(l10n(R.string.for_other_requests_write_to_57563d) + " "),
                    BBLinkPart.Link(PrivacyRequest.PRIVACY_EMAIL, "mailto:${PrivacyRequest.PRIVACY_EMAIL}"),
                    BBLinkPart.Plain(l10n(R.string.we_reply_within_a_month_these_links_open_5ee9a7)),
                ),
                style = BBTextStyle.Body.style, color = c.mutedForeground,
            )
            PrivacyRequest.options.forEach { option ->
                val shape = RoundedCornerShape(BBRadius.lg)
                Column(
                    Modifier.fillMaxWidth().border(1.dp, c.border, shape)
                        .bbPressable({ openUrl(context, option.mailto(settings.email)) }, shape, pressedBackground = c.muted, translate = false)
                        .padding(BBSpacing.space3),
                    verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5),
                ) {
                    BBText(tr(option.label), BBTextStyle.BodyStrong)
                    BBText(tr(option.description), BBTextStyle.Body, color = c.mutedForeground)
                }
            }
        }
    }
}

/** I tuoi dati (SET-037, SET-038, SET-039…041). */
@Composable
fun DataSection(model: SettingsModel, settings: UserSettings) {
    val env = LocalEnv.current
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    var export by remember { mutableStateOf(ExportState()) }
    val networkError = l10n(R.string.connection_failed_check_your_network_and_93acb6)
    val genericError = l10n(L10n.genericError)
    SettingsSection(l10n(R.string.your_data_d91bed), BBIcon.Database, l10n(R.string.download_everything_you_entered_or_impor_efc399)) {
        when (val state = model.dataSummary) {
            is Loadable.Loading -> BBSkeleton(height = 112.dp, radius = BBRadius.lg)
            is Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_the_data_summary_e7d58f), { scope.launch { model.loadDataSummary() } })
            is Loadable.Loaded -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                DataSummaryItems.items(state.value).forEach { item ->
                    Row(
                        Modifier.fillMaxWidth()
                            .padding(bottom = BBSpacing.space1_5),
                        verticalAlignment = Alignment.Bottom,
                    ) {
                        BBText(tr(item.label), BBTextStyle.Body, color = c.mutedForeground)
                        Spacer(Modifier.weight(1f).width(BBSpacing.space3))
                        BBText(
                            BBFormat.formatNumber(item.value.toDouble(), locale, maximumFractionDigits = 0),
                            style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W500, fontFeatureSettings = "tnum"),
                        )
                    }
                }
            }
        }
        BBText(l10n(R.string.the_zip_archive_contains_all_data_in_jso_70991f), BBTextStyle.Body, color = c.mutedForeground)
        if (!model.recentLogin || export.reauthRequired) {
            ReauthPanel(model, settings.email) { export = ExportState() }
        } else {
            BBButton(
                if (export.running) l10n(R.string.preparing_8aa508) else l10n(R.string.download_my_data_1dfaff),
                {
                    scope.launch {
                        DataExporter.run(env, context, networkError, genericError) {
                            export = it
                            if (it.reauthRequired) model.forcedReauth = true
                        }
                    }
                },
                icon = BBIcon.Download, isLoading = export.running,
            )
        }
        export.error?.let { if (!export.reauthRequired) StatusLine(it) }
    }
}
