package io.buddybudget.app.features.onboarding

import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.BBSheet
import androidx.compose.foundation.layout.heightIn
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.rememberReduceMotion
import io.buddybudget.app.designsystem.generated.BBColors
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.auth.AuthScaffold
import io.buddybudget.app.features.auth.AuthTitle
import io.buddybudget.app.features.auth.LegalConsentFields
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.DigestFrequency
import io.buddybudget.core.data.NotificationPreferences
import io.buddybudget.core.domain.onboarding.NotificationChoices
import io.buddybudget.core.domain.onboarding.NotificationKind
import io.buddybudget.core.domain.onboarding.OnboardingStep
import io.buddybudget.core.domain.shell.LocaleRules
import kotlinx.coroutines.launch

/** Onboarding wizard (AUTH-024…043): Valuta e paese, Categorie, [Assistente], Notifiche, Conferme. */
@Composable
fun OnboardingScreen() {
    val env = LocalEnv.current
    val model = remember { OnboardingModel(env) }
    LaunchedEffect(Unit) { model.load() }
    AuthScaffold(showsLanguagePicker = false) { OnboardingContent(model) }
}

@Composable
private fun OnboardingContent(model: OnboardingModel) {
    val scope = rememberCoroutineScope()
    val reduceMotion = rememberReduceMotion()
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBText(l10n(R.string.welcome_9c1e73), Modifier.semantics { heading() }, AuthTitle)
            StepProgress(model.index, model.steps.size, l10n(R.string.onboarding_steps_ed3a9a), Modifier.padding(top = BBSpacing.space3))
        }
        AnimatedContent(
            model.step,
            transitionSpec = {
                val shift = if (reduceMotion) 0 else 14 * model.direction
                (slideInHorizontally(tween(200)) { (shift * density).toInt() } + fadeIn(tween(160))) togetherWith fadeOut(tween(160))
            },
            label = "step",
        ) { step ->
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) { StepContent(model, step) }
        }
        model.error?.let { BBErrorBox(it) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            val primary = when {
                model.isLast -> if (model.saving) l10n(R.string.saving_712d0f) else l10n(R.string.get_started_4e66fa)
                model.step == OnboardingStep.Categories && !model.customized -> l10n(R.string.continue_with_these_3cbcbe)
                model.step == OnboardingStep.Interests && model.focus.none { it in model.focusOptions } -> tr("Salta")
                else -> l10n(R.string.continue_08ccec)
            }
            BBButton(primary, { scope.launch { model.next() } }, variant = BBButtonVariant.Sun, size = BBButtonSize.Touch, fullWidth = true,
                isLoading = model.saving, enabled = !(model.isLast && !model.consent.isComplete))
            if (!model.isFirst) {
                BBButton(l10n(R.string.back_83c968), model::back, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch,
                    fullWidth = true, enabled = !model.saving)
            }
        }
    }
}

private val density get() = android.content.res.Resources.getSystem().displayMetrics.density

@Composable
private fun StepContent(model: OnboardingModel, step: OnboardingStep) {
    val c = BuddyBudgetTheme.colors
    when (step) {
        OnboardingStep.Currency -> {
            StepHeading(l10n(R.string.which_currency_would_you_like_to_use_025338), l10n(R.string.used_for_balances_transactions_and_inves_57fd26))
            LocaleFields(model.country, model.language, BBLayout.minTouchTarget, currency = model.currency, onCountry = model::setCountry, onLanguage = model::setLanguage)
            CurrencyPicker(model.currency) { model.currency = it }
        }
        OnboardingStep.Interests -> {
            StepHeading(tr("Cosa vuoi tenere sotto controllo?"), tr("Scegli quante cose vuoi: in Panoramica ti diciamo da dove partire. Puoi cambiarle quando vuoi."))
            io.buddybudget.app.features.overview.FocusPicker(model.focusOptions, model.focus.filter { it in model.focusOptions }, enabled = !model.saving) { model.focus = it }
        }
        OnboardingStep.Categories -> CategorySetupStep(model)
        OnboardingStep.Assistant -> {
            StepHeading(l10n(R.string.would_you_like_help_categorising_f8519c), l10n(R.string.you_can_change_your_mind_anytime_in_sett_762a6d))
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                BBText(l10n(R.string.when_new_transactions_arrive_from_your_b_800502), BBTextStyle.Body, color = c.mutedForeground)
                BBText(l10n(R.string.when_the_app_is_fairly_sure_it_assigns_t_7e182f), BBTextStyle.Body, color = c.mutedForeground)
                BBText(l10n(R.string.to_do_this_we_send_openrouter_only_the_c_09b322), BBTextStyle.Body, color = c.mutedForeground)
            }
            val label = l10n(R.string.suggest_categories_31a3a5)
            Row(
                Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BBText(label, Modifier.weight(1f), BBTextStyle.BodyStrong.style)
                BBSwitch(model.aiEnabled, { model.aiEnabled = it }, accessibilityLabel = label)
            }
        }
        OnboardingStep.Notifications -> {
            StepHeading(l10n(R.string.which_emails_would_you_like_to_receive_65f299), l10n(R.string.all_start_disabled_each_includes_an_unsu_38b086))
            NotificationChoicesView(model.notifications) { model.notifications = it }
            InboxPreview(model.notifications)
        }
        OnboardingStep.Confirmations -> {
            StepHeading(l10n(R.string.one_last_step_confirmations_e4c4d2), l10n(R.string.required_to_use_the_app_always_available_5788c5))
            LegalConsentFields(model.consent, { model.consent = it }, model.legal, !model.saving)
        }
    }
}

/** «Passo 2 di 4» + segmented bar (web `StepProgress`). */
@Composable
fun StepProgress(index: Int, count: Int, label: String, modifier: Modifier = Modifier) {
    val c = BuddyBudgetTheme.colors
    Column(
        modifier.semantics {
            contentDescription = label
            stateDescription = "${index + 1} / $count"
        },
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        BBText(
            "${l10n(R.string.step_f71648)} ${index + 1} ${l10n(R.string.of_f502e8)} $count",
            style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500), color = c.mutedForeground,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            repeat(count) { i ->
                val fill by animateFloatAsState(if (i <= index) 1f else 0f, tween(200), label = "seg")
                Box(Modifier.weight(1f).height(4.dp).background(c.border, CircleShape)) {
                    Box(Modifier.fillMaxWidth(fill).fillMaxHeight().background(c.primary, CircleShape))
                }
            }
        }
    }
}

/** Step title (font-heading text-xl medium) + optional description (text-sm muted). */
@Composable
fun StepHeading(title: String, description: String? = null) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(title, Modifier.semantics { heading() }, BBTextStyle.SectionTitle.style)
        if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
    }
}

/** Product country + language selects with the notes (web `LocaleFields`, shared with Settings › Preferenze). */
@Composable
fun LocaleFields(
    country: String,
    language: String,
    height: Dp = BBLayout.inputHeight,
    enabled: Boolean = true,
    currency: String = LocaleRules.DEFAULT_CURRENCY,
    onCountry: (String) -> Unit,
    onLanguage: (String) -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    // AUTH-060 / SET-017 (web #397): country and language as two rows; the language list previews dates and amounts.
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBSelect(
                LocaleRules.countries.map { it to tr(LocaleRules.countryLabel(it)) }, country, onCountry,
                label = l10n(R.string.country_500bbe), height = height, enabled = enabled,
                leading = { code -> io.buddybudget.app.designsystem.components.BBFlag(io.buddybudget.app.designsystem.components.BBFlagCode.of(LocaleRules.flagCode(code))) },
            )
            BBText(l10n(R.string.decides_taxes_and_available_features_a5ee81), BBTextStyle.Caption, color = c.mutedForeground)
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            LanguageSelect(country, language, currency, height, enabled, onLanguage)
            BBText(l10n(R.string.only_changes_text_dates_and_numbers_e68517), BBTextStyle.Caption, color = c.mutedForeground)
        }
        // SET-017 / AUTH-027 (web `COUNTRY_UNAVAILABLE_NOTES`): what the chosen country does not have yet.
        LocaleRules.unavailableNote(country)?.let { BBText(tr(it), BBTextStyle.Body, color = c.mutedForeground) }
    }
}

/** The language row: opens every language with today's date and a sample amount; others' languages greyed (AUTH-060). */
@Composable
private fun LanguageSelect(country: String, language: String, currency: String, height: Dp, enabled: Boolean, onLanguage: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val dark = BuddyBudgetTheme.isDark
    var open by remember { mutableStateOf(false) }
    val title = l10n(R.string.language_a1b8a9)
    val shape = RoundedCornerShape(BBRadius.lg)
    val today = io.buddybudget.core.domain.periods.CalendarDate.of(java.time.Instant.now(), java.time.ZoneId.systemDefault())
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(title, style = BBTextStyle.BodyStrong.style)
        Row(
            Modifier.fillMaxWidth().height(height).bbDisabled(!enabled)
                .background(if (dark) c.alphaInput30 else Color.Transparent, shape).border(1.dp, c.input, shape)
                .bbPressable(if (enabled) ({ open = true }) else null, shape, translate = false)
                .semantics { contentDescription = "$title: ${LocaleRules.languageName(language)}" }
                .padding(horizontal = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            io.buddybudget.app.designsystem.components.BBFlag(languageFlagOf(language), io.buddybudget.app.designsystem.components.BBFlagSize.Md)
            BBText(LocaleRules.languageName(language), Modifier.weight(1f), BBTextStyle.Body.style, maxLines = 1)
            BBIconView(BBIcon.ChevronDown, color = c.mutedForeground)
        }
    }
    BBSheet(open, { open = false }, title) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            LocaleRules.allLanguages.forEach { option ->
                val available = option in LocaleRules.languages(country)
                val selected = option == language
                val hint = if (available) LocaleRules.languagePreview(option, currency, today)
                else LocaleRules.countryOf(option)?.let { l10n(R.string.available_with_country_0_5ddfb4, tr(LocaleRules.countryLabel(it))) } ?: ""
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp).bbDisabled(!available)
                        .bbPressable(if (available) ({ open = false; if (!selected) onLanguage(option) }) else null, RoundedCornerShape(BBRadius.md),
                            background = if (selected) c.alphaPrimary10 else Color.Transparent, pressedBackground = c.accent, translate = false)
                        .semantics { this.selected = selected }
                        .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    io.buddybudget.app.designsystem.components.BBFlag(languageFlagOf(option), io.buddybudget.app.designsystem.components.BBFlagSize.Lg)
                    Column(Modifier.weight(1f)) {
                        BBText(LocaleRules.languageName(option), BBTextStyle.BodyStrong)
                        if (hint.isNotEmpty()) BBText(hint, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
                    }
                    if (selected) BBIconView(BBIcon.Check, color = c.primary)
                }
            }
        }
    }
}

/** Currency tiles 2×2 (web `CurrencyPicker`): symbol, name, ISO code; selected = primary border + accent fill. */
@Composable
fun CurrencyPicker(selection: String, onSelect: (String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val label = l10n(R.string.main_currency_16773c)
    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        LocaleRules.currencies.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                row.forEach { currency ->
                    val selected = currency == selection
                    val shape = RoundedCornerShape(BBRadius.xl)
                    Column(
                        Modifier.weight(1f)
                            .background(if (selected) c.accent else c.card, shape)
                            .border(if (selected) 2.dp else 1.dp, if (selected) c.primary else c.border, shape)
                            .bbPressable({ onSelect(currency) }, shape, translate = false)
                            .semantics { this.selected = selected }
                            .padding(BBSpacing.space4),
                        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1),
                    ) {
                        BBText(LocaleRules.currencySymbol(currency), style = BBTextStyle.AmountLarge.style, color = if (selected) c.primary else c.foreground)
                        BBText(tr(LocaleRules.currencyLabel(currency)), BBTextStyle.BodyStrong)
                        BBText(currency, BBTextStyle.Caption, color = c.text3)
                    }
                }
            }
        }
    }
}

/** Switch rows for the optional emails (web `NotificationChoices`), digest frequency when the digest is on. */
@Composable
fun NotificationChoicesView(preferences: NotificationPreferences, onChange: (NotificationPreferences) -> Unit) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        NotificationKind.onboarding.forEach { kind ->
            val on = kind.isOn(preferences)
            val shape = RoundedCornerShape(BBRadius.xl)
            Column(Modifier.fillMaxWidth().background(if (on) c.alphaPrimary5 else c.card, shape).border(1.dp, if (on) c.alphaPrimary45 else c.border, shape)) {
                Row(Modifier.padding(BBSpacing.space3_5), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    Box(
                        Modifier.size(36.dp).background(if (on) c.alphaPrimary10 else c.muted, RoundedCornerShape(BBRadius.xl)),
                        contentAlignment = Alignment.Center,
                    ) { BBIconView(BBIcon.forKey(kind.iconKey) ?: BBIcon.Bell, color = if (on) c.primary else c.text3) }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                        BBText(tr(kind.label), BBTextStyle.BodyStrong)
                        BBText(tr(kind.onboardingHint), BBTextStyle.Caption, color = c.mutedForeground)
                    }
                    BBSwitch(on, { onChange(kind.set(it, preferences)) }, accessibilityLabel = tr(kind.label))
                }
                if (kind == NotificationKind.Digest && on) {
                    SegmentedControl(
                        DigestFrequency.entries.map { it to tr(NotificationChoices.onboardingLabel(it)) },
                        preferences.digestFrequency, { onChange(preferences.copy(digestFrequency = it)) },
                        Modifier.padding(start = BBSpacing.space3_5, end = BBSpacing.space3_5, bottom = BBSpacing.space3_5),
                        accessibilityLabel = l10n(R.string.how_often_to_receive_the_summary_170a11), stretch = true,
                    )
                }
            }
        }
    }
}

/** «Nella tua casella» (AUTH-037). */
@Composable
fun InboxPreview(preferences: NotificationPreferences) {
    val c = BuddyBudgetTheme.colors
    val items = NotificationChoices.inboxPreview(preferences)
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(
        Modifier.fillMaxWidth().background(c.card, shape).border(1.dp, c.border, shape).padding(BBSpacing.space3_5),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBIconView(BBIcon.Inbox, size = 14.dp, color = c.text3)
            BBText(l10n(R.string.in_your_inbox_405bf1), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500), color = c.text3)
        }
        if (items.isEmpty()) {
            BBText(l10n(R.string.no_optional_emails_you_can_enable_them_a_34cc59), BBTextStyle.Caption, color = c.mutedForeground)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                items.forEachIndexed { i, item ->
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        BBText(tr(item.title), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W500))
                        Spacer(Modifier.weight(1f))
                        BBText(
                            tr(item.`when`, item.whenValues.mapIndexed { idx, v -> idx.toString() to v }.toMap()),
                            style = BBTextStyle.Caption.style.copy(textAlign = TextAlign.End), color = c.mutedForeground,
                        )
                    }
                }
            }
        }
    }
}

/** Dot colour of a category group (web `EXPENSE_GROUPS[type].dotClassName`). */
fun categoryGroupColor(type: String, c: BBColors): Color = when (type) {
    "dovuta" -> c.categoryGroupDovuta
    "voluta" -> c.categoryGroupVoluta
    "futuro" -> c.categoryGroupFuturo
    "saltuaria" -> c.categoryGroupSaltuaria
    "entrata" -> c.pos
    else -> c.mutedForeground
}

/** #397: English uses the British flag (en-GB formats). */
private fun languageFlagOf(language: String): io.buddybudget.app.designsystem.components.BBFlagCode = when (language) {
    "de" -> io.buddybudget.app.designsystem.components.BBFlagCode.DE
    "en" -> io.buddybudget.app.designsystem.components.BBFlagCode.GB
    else -> io.buddybudget.app.designsystem.components.BBFlagCode.IT
}
