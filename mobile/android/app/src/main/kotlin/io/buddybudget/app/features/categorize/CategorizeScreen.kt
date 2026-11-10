package io.buddybudget.app.features.categorize

import androidx.compose.ui.unit.sp
import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.AutoOrigin
import io.buddybudget.app.designsystem.components.AutoOriginBadge
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBCardSize
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBChip
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSkeletonRows
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LogoCredit
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.MerchantLogoSize
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbShadow
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBShadow
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.categories.BBSwitchRow
import io.buddybudget.app.features.categories.CategoryAvatar
import io.buddybudget.app.features.categories.CategorySheetContent
import io.buddybudget.app.features.liquidity.FeedState
import io.buddybudget.app.features.liquidity.RuleFeedback
import io.buddybudget.app.features.liquidity.SheetActionRow
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.AutoCategorizedGroup
import io.buddybudget.core.data.CategorySource
import io.buddybudget.core.data.RecategorizeBody
import io.buddybudget.core.data.RecategorizeGroup
import io.buddybudget.core.data.RecategorizePreview
import io.buddybudget.core.data.SuggestionGroup
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.categorization.AutoReviewText
import io.buddybudget.core.domain.categorization.CategorizationText
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.transactions.CategoryRules
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

private fun CategorySource.autoOrigin(): AutoOrigin? = AutoOrigin.of(this)

/**
 * /categorizza (CAT-036…089), phone layout: compact `AI` button and `⋯` (Ricategorizza) in the top bar, tabs
 * «Da decidere · n» / «Messe dall'app · n», the swipe deck or the auto-categorized list. iOS: CategorizeScreen.swift.
 */
@Composable
fun CategorizeScreen() {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val scope = rememberCoroutineScope()
    val model = remember {
        CategorizeModel(env).also {
            it.onChanged = {
                shell.liquidity.refresh()
            }
            it.openMovement = { id -> shell.openMovement(id) }
        }
    }
    var loaded by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var recategorize by remember { mutableStateOf(false) }
    var consent by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        model.load()
        loaded = true
        if (DebugLaunch.tab == "auto") model.select(CategorizeTab.Auto)
    }
    LaunchedEffect(shell.dataVersion) { if (loaded) model.load() }
    // CAT-064: pending decisions are saved when leaving the screen or the app goes to the background.
    DisposableEffect(Unit) { onDispose { model.launch { model.flush() } } }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { model.launch { model.flush() } }

    BBScreen(
        l10n(R.string.categorise_2e91fc),
        onBack = LocalShellBack.current,
        onRefresh = { model.load() },
        actions = {
            if (model.showsAI) {
                BBButton(
                    if (model.generating) l10n(R.string.in_progress_4b6912) else l10n(R.string.ai_560040), {
                        if (model.aiConsented) model.launch { model.generate() } else consent = true
                    },
                    icon = BBIcon.Sparkles, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm, isLoading = model.generating,
                    modifier = Modifier.align(Alignment.CenterVertically),
                )
            }
            Box(Modifier.bbDisabled(model.categories.isEmpty())) {
                BBIconButton(BBIcon.Ellipsis, l10n(R.string.more_actions_3676f0)) { if (model.categories.isNotEmpty()) menu = true }
            }
        },
    ) {
        if (loaded || model.suggestionsState != FeedState.Loading) {
            CategorizeContent(model)
        } else {
            BBSkeleton(height = 420.dp, radius = BBRadius.xl)
        }
    }
    BBSheet(menu, { menu = false }, l10n(R.string.more_actions_3676f0)) {
        Column {
            SheetActionRow(BBIcon.RefreshCw, l10n(R.string.recategorize_10c39a)) {
                menu = false
                scope.launch {
                    delay(BBMotion.durationSheetExit.toLong() + 50)
                    recategorize = true
                }
            }
            BBText(
                l10n(R.string.reassigns_app_categorized_transactions_u_5a4e07), BBTextStyle.Caption, Modifier.padding(start = 36.dp),
                color = BuddyBudgetTheme.colors.text3,
            )
        }
    }
    BBSheet(recategorize, { recategorize = false }, l10n(R.string.recategorize_10c39a)) {
        if (recategorize) RecategorizeSheet(model) { recategorize = false }
    }
    val option = if (model.autoApplyEnabled) l10n(R.string.when_confidence_is_high_the_app_assigns_66d3c5) else l10n(R.string.suggestions_still_need_your_confirmation_14ee94)
    BBAlertSheet(
        consent, l10n(R.string.enable_the_category_assistant_74c8af),
        "${l10n(R.string.we_send_an_ai_service_only_the_cleaned_m_be3863)} $option ${l10n(R.string.you_can_turn_it_off_anytime_in_settings_be727b)}",
        l10n(R.string.enable_and_categorise_with_ai_2fd562),
        onConfirm = { model.launch { model.consentAndGenerate() } },
        onDismiss = { consent = false },
        confirmVariant = BBButtonVariant.Default, icon = BBIcon.Sparkles,
    )
}

@Composable
private fun CategorizeContent(model: CategorizeModel) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        val toReview = if (model.suggestionsState == FeedState.Loaded) l10n(R.string.to_review_0_881a1f, model.deck.movementCount.toString())
        else l10n(R.string.to_review_88b521)
        // CAT-037: no count on «Messe dall'app» (a history, not work to do).
        val autoLabel = l10n(R.string.assigned_by_the_app_0e49f7)
        SegmentedControl(listOf(CategorizeTab.ToReview to toReview, CategorizeTab.Auto to autoLabel), model.tab, { model.select(it) }, stretch = true)
        if (model.generating) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(
                    l10n(R.string.reading_your_merchants_0_of_1_suggestion_9bf3ba, model.generationDone.toString(), model.generationTotal.toString()),
                    BBTextStyle.Body, color = c.text2,
                )
                ProgressBar(
                    BBProgressState.Determinate(model.generationDone.toDouble(), maxOf(1, model.generationTotal).toDouble()),
                    label = l10n(R.string.reading_your_merchants_0846a2),
                )
            }
        }
        if (model.tab == CategorizeTab.ToReview) {
            if (!model.autoApplyEnabled) {
                Row(
                    Modifier.fillMaxWidth().background(c.alphaPrimary5, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        BBText(l10n(R.string.less_to_do_ac621e), BBTextStyle.BodyStrong)
                        BBText(l10n(R.string.when_confidence_is_high_the_app_assigns_379731), BBTextStyle.Caption, color = c.text2)
                    }
                    BBButton(l10n(R.string.enable_97ec36), { model.launch { model.enableAutoApply() } }, size = BBButtonSize.Sm)
                }
            }
            DeckView(model)
        } else {
            AutoCategorizedList(model)
        }
    }
}

// ---------------------------------------------------------------- Deck

@Composable
private fun DeckView(model: CategorizeModel) {
    var picking by remember { mutableStateOf(false) }
    when (model.suggestionsState) {
        FeedState.Loading -> BBSkeleton(height = 420.dp, radius = BBRadius.xl)
        FeedState.Failed -> LoadError(l10n(R.string.unable_to_load_categorization_suggestion_41c7af), { model.launch { model.loadSuggestions() } })
        FeedState.Loaded -> {
            val current = model.deck.current
            if (current != null) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    BBText(
                        if (model.deck.remaining == 1) l10n(R.string.last_card_a6692f)
                        else l10n(R.string.s_0_merchants_to_categorise_0505b4, model.deck.remaining.toString()),
                        BBTextStyle.BodyStrong, color = BuddyBudgetTheme.colors.text2,
                    )
                    Box(Modifier.fillMaxWidth().padding(bottom = BBSpacing.space6), contentAlignment = Alignment.BottomCenter) {
                        // CAT-057: the next card(s) peek out under the active one.
                        if (model.deck.remaining > 2) DeckEdge(24, 20)
                        if (model.deck.next != null) DeckEdge(12, 10)
                        key(current.groupKey) { SwipeCard(model, current) { picking = true } }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        Box(Modifier.bbDisabled(!model.deck.canUndo)) {
                            BBIconButton(BBIcon.Undo2, l10n(R.string.undo_the_last_choice_b06346), color = BuddyBudgetTheme.colors.foreground) {
                                if (model.deck.canUndo) model.undo()
                            }
                        }
                        BBButton(l10n(R.string.change_68f742), { picking = true }, Modifier.weight(1f), variant = BBButtonVariant.Outline,
                            size = BBButtonSize.Touch, fullWidth = true)
                        if (current.suggestion != null) {
                            BBButton(l10n(R.string.confirm_8d2554), { model.confirm() }, Modifier.weight(1f), icon = BBIcon.Check,
                                size = BBButtonSize.Touch, fullWidth = true)
                        }
                        BBIconButton(BBIcon.ArrowDown, l10n(R.string.skip_for_now_3942ee), color = BuddyBudgetTheme.colors.foreground) { model.skip() }
                    }
                }
                BBSheet(picking, { picking = false }, l10n(R.string.choose_category_bf34fc)) {
                    CategorySheetContent(
                        CategoryRules.categorizeCategories(model.categories, current.isIncome, current.suggestion?.suggestedCategoryId),
                        model.usage,
                        onPick = { picked ->
                            picking = false
                            model.choose(picked)
                        },
                        description = current.label,
                    ) {
                        BBSwitchRow(l10n(R.string.always_use_this_category_for_0_a0fb34, current.label), model.remember) { model.remember = it }
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    EmptyState(BBIcon.CircleCheck, l10n(R.string.all_done_nothing_else_to_categorise_53c4b5), "")
                    if (model.deck.canUndo) {
                        BBButton(l10n(R.string.undo_the_last_choice_b06346), { model.undo() }, icon = BBIcon.Undo2, variant = BBButtonVariant.Outline,
                            size = BBButtonSize.Touch)
                    }
                }
            }
        }
    }
}

/** Edge of a waiting card under the active one. */
@Composable
private fun DeckEdge(inset: Int, offset: Int) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.radius2xl)
    Box(
        Modifier.fillMaxWidth().padding(horizontal = inset.dp).offset(y = offset.dp).height(60.dp)
            .background(c.card, shape).border(1.dp, c.alphaForeground10, shape),
    )
}

private enum class Zone { Confirm, Change, Skip }

/**
 * One merchant card (CAT-055…063): logo, label, total, count and dates, recent movements, proposal and origin,
 * «Usa sempre…». Drag right confirms, left changes, up skips (110 dp, stamps, light haptic once past the threshold).
 */
@Composable
private fun SwipeCard(model: CategorizeModel, group: SuggestionGroup, onPick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val dx = remember { Animatable(0f) }
    val dy = remember { Animatable(0f) }
    var zone by remember { mutableStateOf<Zone?>(null) }
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    val threshold = 110f * density
    val category = model.category(group.suggestion?.suggestedCategoryId)
    val shape = RoundedCornerShape(BBRadius.radius2xl)
    val border = when (zone) {
        Zone.Confirm -> c.pos
        Zone.Change -> c.primary
        Zone.Skip -> c.text3
        null -> c.border
    }
    val count = group.transactionIds.size
    val countLine = "${if (count == 1) l10n(R.string.s_1_transaction_71be35) else l10n(R.string.s_0_transactions_57cb30, count.toString())} · " +
        CategorizationText.dateRangeLabel(group.transactionDates, model.today, locale)
    Box {
        Column(
            Modifier.fillMaxWidth()
                .graphicsLayer {
                    translationX = dx.value
                    translationY = minOf(0f, dy.value)
                    rotationZ = (dx.value / density / 20f).coerceIn(-8f, 8f)
                }
                .background(c.card, shape)
                .border(2.dp, border, shape)
                .pointerInput(group.groupKey) {
                    detectDragGestures(
                        onDragEnd = {
                            val decided = zone
                            zone = null
                            scope.launch {
                                when (decided) {
                                    Zone.Confirm -> {
                                        dx.animateTo(size.width * 1.6f, tween(280))
                                        model.confirm()
                                    }
                                    Zone.Skip -> {
                                        launch { dx.animateTo(0f, tween(200)) }
                                        dy.animateTo(0f, tween(200))
                                        model.skip()
                                    }
                                    else -> {
                                        launch { dx.animateTo(0f, BBMotion.springSheetSnapBack.spec()) }
                                        dy.animateTo(0f, BBMotion.springSheetSnapBack.spec())
                                        if (decided == Zone.Change) onPick()
                                    }
                                }
                            }
                        },
                        onDragCancel = {
                            zone = null
                            scope.launch { dx.animateTo(0f); dy.animateTo(0f) }
                        },
                    ) { change, amount ->
                        change.consume()
                        scope.launch {
                            dx.snapTo(dx.value + amount.x)
                            dy.snapTo(dy.value + amount.y)
                        }
                        val x = dx.value + amount.x
                        val y = dy.value + amount.y
                        val next = when {
                            x > threshold && group.suggestion != null -> Zone.Confirm
                            x < -threshold -> Zone.Change
                            y < -threshold && abs(x) < threshold -> Zone.Skip
                            else -> null
                        }
                        if (next != zone) {
                            if (next != null) view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
                            zone = next
                        }
                    }
                }
                .padding(BBSpacing.space5),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space4),
        ) {
            // Web phone card: the merchant centred (logo, name, amount, count and dates), no rules inside (#427).
            Column(Modifier.fillMaxWidth().padding(top = BBSpacing.space6), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                MerchantLogo(group.label, logoPath = group.logoPath, size = MerchantLogoSize.Md, onRemoteLogo = { model.remoteLogoShown = true },
                    modifier = Modifier.padding(bottom = BBSpacing.space1))
                BBText(group.label, style = BBStyles.figure.copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), maxLines = 2)
                AmountText(group.totalAmount, model.env.session.currency, tone = AmountTone.Income,
                    style = BBTextStyle.BodyLarge.style.copy(fontSize = 18.sp, lineHeight = 28.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.W500))
                BBText(countLine, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 1)
            }
            if (count > 1) Preview(model, group)
            val suggestion = group.suggestion
            if (suggestion != null) {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(l10n(R.string.suggested_category_6cf4f9), BBTextStyle.Body, color = c.mutedForeground)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                        CategoryAvatar(category)
                        BBText(category?.name ?: "", style = BBStyles.rowTitle, maxLines = 1)
                    }
                    val origin = CategorizationText.suggestionOrigin(suggestion)
                    val hint = l10n(R.string.s_0_confidence_the_app_assigns_automatical_fde1d8, CategorizationText.confidencePercent(suggestion.confidence).toString(), "90")
                    Row(
                        Modifier.semantics { stateDescription = hint },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
                    ) {
                        suggestion.source.autoOrigin()?.let { BBIconView(it.icon, size = BBIconSize.Sm.dp, color = c.text2) }
                        BBText(tr(origin.key, origin.values.mapIndexed { i, v -> i.toString() to v }.toMap()), BBTextStyle.Caption, color = c.text2)
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(l10n(R.string.no_suggestion_choose_a_category_238f5d), BBTextStyle.Body, color = c.text2)
                    BBButton(l10n(R.string.choose_category_bf34fc), onPick, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
                }
            }
            val rememberLabel = l10n(R.string.always_use_this_category_for_0_a0fb34, group.label)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBCheckbox(model.remember, { model.remember = it }, accessibilityLabel = rememberLabel)
                BBText(
                    rememberLabel, BBTextStyle.Caption,
                    Modifier.bbPressable({ model.remember = !model.remember }, RoundedCornerShape(BBRadius.sm), translate = false),
                    color = c.text2, maxLines = 2,
                )
            }
        }
        Stamp(group, dx.value / density, dy.value / density, zone, border, Modifier.align(Alignment.TopCenter))
    }
}

@Composable
private fun Stamp(group: SuggestionGroup, x: Float, y: Float, zone: Zone?, border: Color, modifier: Modifier) {
    val c = BuddyBudgetTheme.colors
    val label = when {
        x > 24 && group.suggestion != null -> if (zone == Zone.Confirm) l10n(R.string.release_confirm_602526) else l10n(R.string.this_one_c1d38c)
        x < -24 -> if (zone == Zone.Change) l10n(R.string.release_change_45cab7) else l10n(R.string.another_025f13)
        y < -24 -> if (zone == Zone.Skip) l10n(R.string.release_skip_c1beda) else l10n(R.string.skip_42805b)
        else -> null
    } ?: return
    Box(
        modifier.padding(top = BBSpacing.space3)
            .offset { androidx.compose.ui.unit.IntOffset((x * density).roundToInt(), (minOf(0f, y) * density).roundToInt()) }
            .alpha((maxOf(abs(x), abs(y)) / 110f).coerceAtMost(1f))
            .background(if (zone == null) c.text2 else border, CircleShape)
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space1_5),
    ) { BBText(label, BBTextStyle.BodyStrong, color = c.primaryForeground) }
}

@Composable
private fun Preview(model: CategorizeModel, group: SuggestionGroup) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val indices = CategorizationText.recentIndices(group.transactionDates, 2)
    val rest = group.transactionIds.size - indices.size
    Column(
        Modifier.fillMaxWidth().background(c.alphaMuted50, RoundedCornerShape(BBRadius.xl)).padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        for (i in indices) {
            val date = BBFormat.formatShortDate(group.transactionDates[i], locale)
            val openLabel = l10n(R.string.open_the_transaction_of_0_a91794, date)
            // CAT-097: each movement of the card opens its detail.
            Row(
                Modifier.fillMaxWidth().heightIn(min = 32.dp)
                    .bbPressable(group.transactionIds.getOrNull(i)?.let { id -> { model.openMovement(id) } }, RoundedCornerShape(BBRadius.md), translate = false)
                    .semantics { contentDescription = openLabel },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
            ) {
                BBText(date, BBTextStyle.Caption, Modifier.width(52.dp), color = c.text3)
                val text = group.transactionDescriptions.getOrNull(i) ?: ""
                BBText(if (text == group.label) "" else text, BBTextStyle.Caption, Modifier.weight(1f), color = c.text2, maxLines = 1)
                group.transactionAmounts.getOrNull(i)?.let {
                    AmountText(it, model.env.session.currency, tone = AmountTone.Income, style = BBTextStyle.Caption.style)
                }
            }
        }
        if (rest > 0) {
            BBText(if (rest == 1) l10n(R.string.and_one_more_a44a57) else l10n(R.string.and_0_more_ab4561, rest.toString()), BBTextStyle.Caption, color = c.text3)
        }
    }
}

// ---------------------------------------------------------------- «Messe dall'app»

@Composable
private fun AutoCategorizedList(model: CategorizeModel) {
    val c = BuddyBudgetTheme.colors
    var changing by remember { mutableStateOf<AutoCategorizedGroup?>(null) }
    var remember by remember { mutableStateOf(true) }
    var expanded by remember { mutableStateOf(setOf<String>()) }
    when (val state = model.auto) {
        Loadable.Loading -> BBSkeletonRows(3)
        Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_categorization_suggestion_41c7af), { model.launch { model.loadAuto() } })
        is Loadable.Loaded -> {
            val response = state.value
            if (response.groups.isEmpty()) {
                EmptyState(
                    BBIcon.CircleCheck, l10n(R.string.nothing_here_yet_c225a6),
                    if (model.autoApplyEnabled) l10n(R.string.transactions_automatically_categorized_b_131608)
                    else l10n(R.string.transactions_categorized_using_your_rule_b838fe),
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                    val strings = LocalStrings.current
                    val fromBank = response.groups.any { it.source == CategorySource.banca }
                    BBText(AutoReviewText.summary(response.total, fromBank, model.autoApplyEnabled) { s, v -> strings.lookup(s, v) }, BBTextStyle.Body, color = c.text2)
                    for (group in response.groups) {
                        key(group.groupKey) {
                            AutoRow(model, group, group.groupKey in expanded, {
                                expanded = if (group.groupKey in expanded) expanded - group.groupKey else expanded + group.groupKey
                            }) {
                                remember = true
                                changing = group
                            }
                        }
                    }
                    if (model.remoteLogoShown) LogoCredit()
                }
            }
        }
    }
    var shown by remember { mutableStateOf(changing) }
    if (changing != null) shown = changing
    BBSheet(changing != null, { changing = null }, l10n(R.string.change_category_48467e)) {
        shown?.let { group ->
            CategorySheetContent(
                model.categories.filter {
                    !it.isFallback && it.id != group.categoryId && CategoryRules.isDirectionCompatible(it.type, group.totalAmount > 0, false)
                },
                model.usage,
                onPick = { picked ->
                    changing = null
                    model.launch { model.changeAuto(group, picked, remember) }
                },
                description = group.label,
            ) {
                BBSwitchRow(l10n(R.string.always_use_this_category_for_0_a0fb34, group.label), remember) { remember = it }
            }
        }
    }
}

@Composable
private fun AutoRow(model: CategorizeModel, group: AutoCategorizedGroup, open: Boolean, onToggle: () -> Unit, onChange: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val category = model.category(group.categoryId)
    val count = group.transactionIds.size
    val shape = RoundedCornerShape(BBRadius.xl)
    val strings = LocalStrings.current
    val originDescription = CategorizationText.autoOriginDescription(group.source, group.confidence, group.bankCategory) { s, v -> strings.lookup(s, v) } ?: ""
    Column(
        Modifier.fillMaxWidth().bbDisabled(group.groupKey in model.changingAuto)
            .background(c.card, shape).padding(BBSpacing.space4),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Row(
            Modifier.fillMaxWidth().bbPressable(onToggle, RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
        ) {
            MerchantLogo(group.label, logoPath = group.logoPath, onRemoteLogo = { model.remoteLogoShown = true })
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BBText(group.label, style = BBStyles.rowTitle, maxLines = 1)
                BBText(
                    "${if (count == 1) l10n(R.string.s_1_transaction_71be35) else l10n(R.string.s_0_transactions_57cb30, count.toString())} · " +
                        CategorizationText.dateRangeLabel(group.transactionDates, model.today, locale),
                    BBTextStyle.Caption, color = c.text2, maxLines = 1,
                )
            }
            AmountText(group.totalAmount, model.env.session.currency, tone = AmountTone.Income, style = BBStyles.rowAmount)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            BBChip(category?.name ?: "", icon = BBIcon.category(category?.icon), onClick = onChange)
            Box(Modifier.weight(1f))
            group.source.autoOrigin()?.let { origin ->
                Box(Modifier.semantics { contentDescription = originDescription }) { AutoOriginBadge(origin) }
            }
        }
        if (open) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                group.transactionIds.indices.forEach { i ->
                    val date = BBFormat.formatShortDate(group.transactionDates.getOrNull(i) ?: "", locale)
                    val openLabel = l10n(R.string.open_the_transaction_of_0_a91794, date)
                    // CAT-097: each movement opens its detail.
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 32.dp)
                            .bbPressable({ model.openMovement(group.transactionIds[i]) }, RoundedCornerShape(BBRadius.md), translate = false)
                            .semantics { contentDescription = openLabel },
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                    ) {
                        BBText(date, BBTextStyle.Caption, Modifier.width(52.dp), color = c.text3)
                        BBText(group.transactionDescriptions.getOrNull(i) ?: "", BBTextStyle.Caption, Modifier.weight(1f), color = c.text2, maxLines = 1)
                        AmountText(group.transactionAmounts.getOrNull(i) ?: 0.0, model.env.session.currency, tone = AmountTone.Income,
                            style = BBTextStyle.Caption.style)
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Ricategorizza (CAT-083…089)

@Composable
private fun RecategorizeSheet(model: CategorizeModel, onClose: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val scope = rememberCoroutineScope()
    var preview by remember { mutableStateOf<Loadable<RecategorizePreview>>(Loadable.Loading) }
    var checked by remember { mutableStateOf(setOf<String>()) }
    var applying by remember { mutableStateOf(false) }
    val generic = l10n(L10n.genericError)

    suspend fun load() {
        try {
            val data = model.env.transactions.recategorizePreview()
            checked = data.groups.filter { it.legacyCount == 0 }.map { it.key }.toSet()
            preview = Loadable.Loaded(data)
        } catch (e: Exception) {
            preview = Loadable.Failed
        }
    }
    LaunchedEffect(Unit) { load() }

    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBText(l10n(R.string.reassigns_categories_set_automatically_b_84080d), BBTextStyle.Body, color = c.mutedForeground)
        when (val state = preview) {
            Loadable.Loading -> BBSkeletonRows(3)
            Loadable.Failed -> LoadError(l10n(R.string.unable_to_calculate_the_changes_6ff099), { scope.launch { load() } })
            is Loadable.Loaded -> {
                val data = state.value
                data.lastRun?.let { run ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BBText(
                            l10n(R.string.last_time_on_0_1_transactions_1c4657, BBFormat.formatShortDate(run.createdAt.take(10), locale), run.changed.toString()),
                            BBTextStyle.Body, Modifier.weight(1f), color = c.text2,
                        )
                        BBButton(l10n(R.string.cancel_6c3de5), {
                            scope.launch {
                                RuleFeedback.undo(run.id, model.env)
                                model.onChanged?.invoke()
                                load()
                            }
                        }, variant = BBButtonVariant.Outline, size = BBButtonSize.Sm)
                    }
                }
                if (data.groups.isEmpty()) {
                    BBText(l10n(R.string.nothing_to_change_aa3bb9), BBTextStyle.CardTitle)
                    BBText(l10n(R.string.the_app_assigned_categories_already_matc_d3c1cc), BBTextStyle.Body, color = c.text2)
                    BBButton(l10n(R.string.close_a3be8a), onClose, variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true)
                } else {
                    val total = data.groups.filter { it.key in checked }.sumOf { it.count }
                    BBText(
                        l10n(R.string.s_0_transactions_would_change_category_onl_30f23b, data.changes.toString()) +
                            if (data.legacyChanges > 0) l10n(R.string.those_you_may_have_chosen_yourself_start_5aad9e) else ".",
                        BBTextStyle.Body, color = c.text2,
                    )
                    for (group in data.groups) {
                        key(group.key) {
                            RecategorizeRow(model, group, group.key in checked) { on ->
                                checked = if (on) checked + group.key else checked - group.key
                            }
                        }
                    }
                    BBButton(
                        when (total) {
                            0 -> l10n(R.string.select_what_to_change_7926ab)
                            1 -> l10n(R.string.change_1_transaction_8679f7)
                            else -> l10n(R.string.change_0_transactions_e7a2f2, total.toString())
                        },
                        {
                            applying = true
                            scope.launch {
                                try {
                                    val run = model.env.transactions.recategorize(RecategorizeBody("tutto", includeLegacy = true, groupKeys = checked.toList()))
                                    RuleFeedback.showRecategorized(run, model.env) { model.onChanged?.invoke() }
                                    model.loadAuto()
                                    model.onChanged?.invoke()
                                    applying = false
                                    onClose()
                                } catch (e: Exception) {
                                    applying = false
                                    model.env.toasts.show(BBToastKind.Error, (e as? ApiError.Http)?.body?.message ?: generic)
                                }
                            }
                        },
                        size = BBButtonSize.Touch, fullWidth = true, isLoading = applying, enabled = total > 0,
                    )
                }
            }
        }
    }
}

@Composable
private fun RecategorizeRow(model: CategorizeModel, group: RecategorizeGroup, isOn: Boolean, onToggle: (Boolean) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val from = model.category(group.fromCategoryId)
    val to = model.category(group.toCategoryId)
    var line = "${if (group.count == 1) l10n(R.string.s_1_transaction_71be35) else l10n(R.string.s_0_transactions_57cb30, group.count.toString())} · " +
        CategorizationText.dateRangeLabel(listOf(group.firstDate, group.lastDate), model.today, locale)
    if (group.legacyCount > 0) {
        line += if (group.legacyCount == group.count) " · ${l10n(R.string.possibly_chosen_by_you_27a968)}"
        else " · ${l10n(R.string.s_0_possibly_chosen_by_you_fc513e, group.legacyCount.toString())}"
    }
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBCheckbox(isOn, onToggle, Modifier.padding(top = 4.dp), accessibilityLabel = group.label)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BBText(group.label, BBTextStyle.BodyStrong, Modifier.weight(1f), maxLines = 1)
                AmountText(group.totalAmount, model.env.session.currency, tone = AmountTone.Income, style = BBTextStyle.BodyStrong.style)
            }
            BBText(line, BBTextStyle.Caption, color = c.text2, maxLines = 2)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                BBText(from?.name ?: "", style = BBTextStyle.Caption.style.copy(textDecoration = TextDecoration.LineThrough), color = c.text3)
                BBIconView(BBIcon.ArrowRight, size = BBIconSize.Xs.dp, color = c.text3)
                BBText(to?.name ?: "", BBTextStyle.Caption)
                group.source.autoOrigin()?.let { AutoOriginBadge(it, compact = true) }
            }
        }
    }
}
