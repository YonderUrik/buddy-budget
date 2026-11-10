package io.buddybudget.app.features.subscriptions

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.LogoCredit
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.features.liquidity.LiquiditySegmentBar
import io.buddybudget.app.generated.LocalStrings
import io.buddybudget.app.tr
import io.buddybudget.core.data.SubscriptionItem
import io.buddybudget.core.data.SubscriptionStatus
import io.buddybudget.core.domain.subscriptions.SubscriptionText
import io.buddybudget.core.domain.subscriptions.SubscriptionTextRun
import io.buddybudget.core.domain.subscriptions.SubscriptionsUiState
import io.buddybudget.core.domain.subscriptions.SubscriptionsView

/**
 * Liquidità · Abbonamenti (06-subscriptions): hero, found / confirmed / stopped / price rises, archive, detail and add
 * dialogs. Twin of `SubscriptionsScreen` on iOS.
 */
@Composable
fun SubscriptionsScreen() {
    val env = LocalEnv.current
    val model = remember { SubscriptionsModel(env) }
    val strings = LocalStrings.current
    val text = SubscriptionText(LocalBBLocale.current) { strings.lookup(it) }
    LaunchedEffect(model) {
        model.start()
        DebugLaunch.takeSubscriptions()?.let { value ->
            when (value) {
                "add" -> model.startAdding()
                "archive", "bottom" -> { model.endedExpanded = true; model.excludedExpanded = true }
                else -> model.state.item(value)?.let(model::open)
            }
        }
    }
    val liquidity = io.buddybudget.app.features.shell.LocalShell.current.liquidity
    LaunchedEffect(Unit) { if (liquidity.accounts == null) liquidity.loadMeta() }
    BBScreen(null, onRefresh = { model.load() }) {
        LiquiditySegmentBar()
        // TX-022: before the first account the tab says what it will show.
        if (io.buddybudget.core.domain.shell.LiquidityNoAccounts.applies(liquidity.accounts?.size)) {
            io.buddybudget.app.features.liquidity.LiquidityNoAccountsState(io.buddybudget.core.domain.shell.LiquiditySegment.Subscriptions)
            return@BBScreen
        }
        when (model.state.phase) {
            SubscriptionsUiState.Phase.Loading -> BBSkeleton(height = 320.dp, radius = BBRadius.xl)
            SubscriptionsUiState.Phase.Failed -> LoadError(tr("Impossibile caricare gli abbonamenti."), onRetry = model::retry)
            SubscriptionsUiState.Phase.Loaded -> SubscriptionsList(model, text)
        }
    }
    val opened = model.openedItem
    FormDialog(
        visible = model.detailOpen && opened != null,
        onDismiss = { model.detailOpen = false },
        footer = opened?.let { item -> { SubscriptionDetailActions(model, item) } },
    ) {
        if (opened != null) SubscriptionDetailBody(model, opened, text)
    }
    FormDialog(visible = model.addOpen, onDismiss = { model.addOpen = false }) {
        AddSubscriptionBody(model, text)
    }
}

@Composable
private fun SubscriptionsList(model: SubscriptionsModel, text: SubscriptionText) {
    val c = BuddyBudgetTheme.colors
    val state = model.state
    val sections = state.sections
    val hide = LocalHideAmounts.current
    val row: @Composable (SubscriptionItem, (@Composable () -> Unit)?) -> Unit = { item, actions ->
        SubscriptionRow(
            item, state.currency, state.today, text,
            onOpen = { model.open(item) },
            onRemoteLogo = { if (!model.logosShown) model.logosShown = true },
            actions = actions,
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        SubscriptionsHero(state, text)

        if (state.isEmpty) {
            Column(
                Modifier.fillMaxWidth().background(c.foreground.copy(alpha = 0.04f), RoundedCornerShape(BBRadius.radius2xl)).padding(BBSpacing.space5),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                SectionTitleRow(tr("Ancora nessun abbonamento"), BBIcon.SearchCheck, c.swatchTeal)
                BBText(
                    tr("Cerchiamo nei tuoi movimenti gli addebiti che tornano con lo stesso importo, ogni settimana, mese, trimestre o anno. Servono almeno tre mesi di movimenti (due anni, per quelli annuali). Se ne hai uno che non compare, aggiungilo a mano."),
                    BBTextStyle.Body, color = c.text2,
                )
            }
        }

        if (sections.toConfirm.isNotEmpty()) {
            SubscriptionsSection(
                tr("Trovati nei tuoi movimenti"), BBIcon.SearchCheck, c.swatchTeal,
                tr("Addebiti che tornano con regolarità. Conferma solo i veri abbonamenti: non tutto ciò che ricorre lo è."),
            ) {
                sections.toConfirm.forEach { item ->
                    row(item) {
                        BBButton(tr("È un abbonamento"), { model.quick(item, SubscriptionStatus.Confermato) }, icon = BBIcon.Check,
                            size = BBButtonSize.Touch, enabled = !state.isSaving)
                        BBButton(tr("Non lo è"), { model.quick(item, SubscriptionStatus.Escluso) }, icon = BBIcon.X,
                            variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, enabled = !state.isSaving)
                    }
                }
            }
        }

        SubscriptionsSection(tr("I tuoi abbonamenti"), BBIcon.Repeat, c.swatchPurple) {
            if (sections.confirmed.isEmpty()) {
                BBText(tr("Nessun abbonamento confermato."), BBTextStyle.Body, color = c.text2)
            } else {
                sections.confirmed.forEach { row(it, null) }
            }
            BBButton(tr("Aggiungi a mano"), model::startAdding, Modifier.padding(top = BBSpacing.space1), icon = BBIcon.Plus,
                variant = BBButtonVariant.Outline, size = BBButtonSize.Touch)
        }

        if (sections.stopped.isNotEmpty()) {
            SubscriptionsSection(
                tr("Non addebitati da un po'"), BBIcon.MoonStar, c.swatchAmber,
                tr("Dovevano tornare e non li vediamo più: sono terminati, o te ne sei dimenticato? Se non sono terminati, controlla che il conto sia sincronizzato."),
            ) {
                sections.stopped.forEach { item ->
                    row(item) {
                        BBButton(tr("È terminato"), { model.quick(item, SubscriptionStatus.Terminato) },
                            variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, enabled = !state.isSaving)
                    }
                }
            }
        }

        if (sections.priceRises.isNotEmpty()) {
            SubscriptionsSection(tr("Aumenti di prezzo"), BBIcon.TrendingUp, c.swatchRed) {
                sections.priceRises.forEach { item ->
                    val change = item.priceChange ?: return@forEach
                    PriceRiseRow(item.name, text.priceRiseHint(change, state.currency, hide), text.priceRiseDelta(change, state.currency, hide))
                }
            }
        }

        if (sections.ended.isNotEmpty() || sections.excluded.isNotEmpty() || model.logosShown) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                ArchiveGroup(tr("Terminati"), sections.ended, model.endedExpanded, { model.endedExpanded = it }) { row(it, null) }
                ArchiveGroup(tr("Non sono abbonamenti"), sections.excluded, model.excludedExpanded, { model.excludedExpanded = it }) { row(it, null) }
                if (model.logosShown) Row(Modifier.padding(top = BBSpacing.space2)) { LogoCredit() }
            }
        }
    }
}

// Hero (SUB-002…005)

@Composable
private fun SubscriptionsHero(state: SubscriptionsUiState, text: SubscriptionText) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val totals = state.totals
    val summary = text.heroSummary(totals, state.currency, hide)
    val next = text.nextChargeLine(state.nextCharge, state.today, state.currency, hide)
    val label = tr("Totale degli abbonamenti")
    Column(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = label }) {
        BBText(tr("Gli abbonamenti ti costano ogni mese"), BBTextStyle.BodyLarge, color = c.text2)
        MoneyHero(totals.monthly, state.currency)
        SubscriptionRunsText(summary, c.text2, Modifier.padding(top = BBSpacing.space3))
        if (next != null) {
            Row(Modifier.padding(top = BBSpacing.space2), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBIconView(BBIcon.BellRing, Modifier.padding(top = 2.dp), color = c.primary)
                SubscriptionRunsText(next.main, c.foreground, trailing = next.window)
            }
        }
    }
}

/** Text-sm sentence with emphasized runs (name semibold, amounts semibold tabular in `--foreground`). */
@Composable
fun SubscriptionRunsText(runs: List<SubscriptionTextRun>, color: Color, modifier: Modifier = Modifier, trailing: String? = null) {
    val c = BuddyBudgetTheme.colors
    val annotated = buildAnnotatedString {
        runs.forEach { run ->
            when (run.style) {
                SubscriptionTextRun.Style.Plain -> withStyle(SpanStyle(color = color)) { append(run.text) }
                SubscriptionTextRun.Style.Strong -> withStyle(SpanStyle(color = c.foreground, fontWeight = FontWeight.W600)) { append(run.text) }
                SubscriptionTextRun.Style.Amount ->
                    withStyle(SpanStyle(color = c.foreground, fontWeight = FontWeight.W600, fontFeatureSettings = "tnum")) { append(run.text) }
            }
        }
        if (trailing != null) withStyle(SpanStyle(color = c.text2)) { append(" $trailing") }
    }
    Text(annotated, modifier, style = BBTextStyle.Body.style)
}

// Sections

/** Web `SectionTitle`: 36 tinted circle with an 18 icon, font-heading text-lg title. */
@Composable
fun SectionTitleRow(title: String, icon: BBIcon, color: Color) {
    // Web `SectionTitle` (#427): the display-face title alone; `icon`/`color` are no longer drawn.
    BBText(title, Modifier.semantics { heading() }, BBStyles.sectionHeading)
}

@Composable
private fun SubscriptionsSection(title: String, icon: BBIcon, color: Color, intro: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(bottom = BBSpacing.space3)) { SectionTitleRow(title, icon, color) }
        if (intro != null) BBText(intro, BBTextStyle.Body, Modifier.padding(bottom = BBSpacing.space3), color = BuddyBudgetTheme.colors.text2)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2), content = content)
    }
}

private val DeltaStyle = TextStyle(fontFamily = BBFontFamilies.sans, fontWeight = FontWeight.W600, fontSize = 14.sp, lineHeight = 20.sp, fontFeatureSettings = "tnum")

/** `Aumenti di prezzo` row (web `SoftRow`): not tappable. */
@Composable
private fun PriceRiseRow(name: String, hint: String, delta: String) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp)
            .background(c.foreground.copy(alpha = 0.04f), RoundedCornerShape(BBRadius.radius2xl))
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
    ) {
        Column(Modifier.weight(1f)) {
            BBText(name, style = BBStyles.rowTitle, maxLines = 1)
            BBText(hint, BBTextStyle.Body, color = c.text2)
        }
        BBText(delta, style = DeltaStyle, color = c.neg)
    }
}

/** Archive group (SUB-012): native disclosure row with the count, collapsed by default, hidden when empty. */
@Composable
private fun ArchiveGroup(
    title: String,
    items: List<SubscriptionItem>,
    expanded: Boolean,
    onExpanded: (Boolean) -> Unit,
    row: @Composable (SubscriptionItem) -> Unit,
) {
    if (items.isEmpty()) return
    val c = BuddyBudgetTheme.colors
    val angle by animateFloatAsState(if (expanded) 90f else 0f, tween(200), label = "chevron")
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
                .bbPressable({ onExpanded(!expanded) }, RoundedCornerShape(BBRadius.md), translate = false)
                .semantics { selected = expanded },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBIconView(BBIcon.ChevronRight, Modifier.rotate(angle), color = c.text2)
            BBText("$title (${items.size})", style = BBTextStyle.Body.style.copy(fontWeight = FontWeight.W600), color = c.text2)
        }
        AnimatedVisibility(expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) { items.forEach { row(it) } }
        }
    }
}

// Row (SUB-014)

/**
 * Subscription row: logo or coloured initial, name, hint, amount and the old price / monthly equivalent; optional
 * quick actions underneath. Twin of `SubscriptionRow` on iOS.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SubscriptionRow(
    item: SubscriptionItem,
    currency: String,
    today: String,
    text: SubscriptionText,
    onOpen: () -> Unit,
    onRemoteLogo: () -> Unit,
    actions: (@Composable () -> Unit)? = null,
) {
    val c = BuddyBudgetTheme.colors
    val hide = LocalHideAmounts.current
    val shape = RoundedCornerShape(BBRadius.radius2xl)
    val openLabel = tr("{0}: apri i dettagli", mapOf("0" to item.name))
    Column(Modifier.fillMaxWidth().background(c.foreground.copy(alpha = 0.04f), shape)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 64.dp)
                .bbPressable(onOpen, shape, pressedBackground = c.foreground.copy(alpha = 0.04f), translate = false, onClickLabel = openLabel)
                .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
        ) {
            MerchantLogo(item.name, logoPath = item.logoPath, onRemoteLogo = onRemoteLogo, initialColor = bbSwatch(SubscriptionsView.avatarSwatch(item.key)))
            Column(Modifier.weight(1f)) {
                BBText(item.name, style = BBStyles.rowTitle, maxLines = 1)
                BBText(text.hint(item, today), BBTextStyle.Body, color = c.text2)
            }
            Column(horizontalAlignment = Alignment.End) {
                val amount = item.amount
                if (amount != null) AmountText(amount, currency) else BBText("—", style = BBStyles.rowAmount)
                val rise = SubscriptionsView.rise(item)
                val monthly = item.monthly
                if (rise != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                        BBIconView(BBIcon.TrendingUp, size = BBIconSize.Sm.dp, color = c.neg)
                        BBText(text.previousPrice(rise, currency, hide), style = BBTextStyle.Caption.style.copy(fontWeight = FontWeight.W600), color = c.neg, maxLines = 1)
                    }
                } else if (SubscriptionsView.showsMonthlyEquivalent(item) && monthly != null) {
                    BBText(text.monthlySuffix(monthly, currency, hide), BBTextStyle.Caption, color = c.text2, maxLines = 1)
                }
            }
        }
        if (actions != null) {
            FlowRow(
                Modifier.fillMaxWidth().padding(start = BBSpacing.space4, end = BBSpacing.space4, bottom = BBSpacing.space3),
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
            ) { actions() }
        }
    }
}
