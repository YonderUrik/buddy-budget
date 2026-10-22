package io.buddybudget.app.features.liquidity

import io.buddybudget.app.designsystem.components.bbPressable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.draw.drawBehind
import io.buddybudget.app.designsystem.components.BBSoftRow
import io.buddybudget.app.designsystem.components.BBSection
import io.buddybudget.app.designsystem.components.BBIconView
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import io.buddybudget.core.domain.shell.LiquiditySegment
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.R
import io.buddybudget.app.debug.DebugLaunch
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBChip
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSkeletonRows
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.LogoCredit
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.ShellRoute
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.LiquidityMonth
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementType
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.domain.transactions.VoiceText

/** DEBUG-only `--ei bbSkip <n>`: hides the first n blocks of a long screen so screenshots reach the lower content. */
fun debugShows(index: Int): Boolean = index >= DebugLaunch.skip

/**
 * Liquidità · Movimenti (TX-007…027, TX-049…051, phone layout of the mobile notes): month sentence, total,
 * account chips, «Il mese» card with budgets, toolbar, the day-grouped feed. iOS: MovementsScreen in MovementsView.swift.
 */
@Composable
fun MovementsScreen() {
    val model = LocalShell.current.liquidity
    var sheet by remember { mutableStateOf<MovementSheet?>(null) }
    var deleting by remember { mutableStateOf<Movement?>(null) }
    LiquidityChrome(model) { onAdd ->
        if (io.buddybudget.core.domain.shell.LiquidityNoAccounts.applies(model.accounts?.size)) {
            LiquidityNoAccountsState(LiquiditySegment.Movements)
            return@LiquidityChrome
        }
        // Phone order of the web page (#400/#413): the overview (sentence, hero, account tiles), the import link, the
        // toolbar and the day-grouped feed, then the month column («Il mese», «Da decidere», «Gruppi di spesa»).
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
            if (debugShows(0)) MonthSentence(model)
            if (debugShows(1)) MovementsHero(model)
            if (debugShows(2)) AccountChips(model)
        }
        // 2d: «Importa da CSV o Excel →» (/importazioni).
        val shell = LocalShell.current
        io.buddybudget.app.features.imports.TextLinkButton(io.buddybudget.app.tr("Importa da CSV o Excel →")) { shell.open(io.buddybudget.core.domain.shell.AppDestination.Imports) }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (debugShows(3)) MovementsToolbar(model)
            MovementsFeed(model, onAdd, onOpen = { sheet = it })
        }
        MonthCard(model, Modifier.padding(top = BBSpacing.space2))
        // DEBUG-only `bbSheet`: open a sheet on the first non-transfer movement once the feed loads (one shot).
        LaunchedEffect(model.feedState, model.categories) {
            val request = DebugLaunch.sheet ?: return@LaunchedEffect
            if (model.feedState != FeedState.Loaded || model.categories.isEmpty()) return@LaunchedEffect
            val target = model.feed.items.firstOrNull { model.category(it.categoryId)?.isTransfer != true } ?: return@LaunchedEffect
            DebugLaunch.sheet = null
            when (request) {
                "actions" -> sheet = MovementSheet.Actions(target)
                "category" -> sheet = MovementSheet.Category(target)
                "split" -> sheet = MovementSheet.Split(target)
                "note" -> sheet = MovementSheet.Note(target)
                "edit" -> sheet = MovementSheet.Edit(target)
                "add" -> onAdd()
            }
        }
    }
    MovementSheets(model, sheet, { sheet = it }, deleting, { deleting = it })
}

/** Hero (TX-009…011): label, balance, change over the period, the trend chart and its period selector (web `LiquidityHero`). */
@Composable
private fun MovementsHero(model: LiquidityModel) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hidden = LocalHideAmounts.current
    val hero = io.buddybudget.core.domain.liquidity.LiquidityHero
    val account = model.selectedAccount
    val month = model.month.valueOrNull
    val value = account?.balance ?: month?.accounts?.total
    val points = model.heroPoints
    val delta = points?.let { hero.delta(it) }
    val label = account?.name ?: l10n(R.string.total_cash_0f5380)
    val money = { v: Double -> BBFormat.formatCurrency(v, model.currency, locale, maximumFractionDigits = 0, masked = hidden) }
    Column {
        BBText(label, BBTextStyle.BodyLarge, color = c.text2)
        if (value != null) MoneyHero(value, model.currency) else BBSkeleton(width = 200.dp, height = 48.dp)
        // Change over the period: «↗ +828 € negli ultimi 3 mesi».
        Row(Modifier.padding(top = BBSpacing.space3).heightIn(min = 20.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (delta != null) {
                val up = delta >= 0
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    BBIconView(if (up) BBIcon.TrendingUp else BBIcon.TrendingDown, size = 16.dp, color = if (up) c.pos else c.neg)
                    BBText((if (up) "+" else BBFormat.MINUS_SIGN) + money(kotlin.math.abs(delta)),
                        style = BBTextStyle.Body.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W600, fontFeatureSettings = "tnum"),
                        color = if (up) c.pos else c.neg)
                }
                BBText(tr(hero.phrase(model.heroPeriod)), BBTextStyle.Body, color = c.text2)
            }
        }
        // TX-076: imported data on its way into the balances.
        val shell = LocalShell.current
        val refresh = shell.chartRefresh(model.monthUpdatedAt, model.fetchingMonth)
        LaunchedEffect(model.monthUpdatedAt, model.fetchingMonth) { shell.settleChart(model.monthUpdatedAt, model.fetchingMonth) }
        if (refresh != null) io.buddybudget.app.features.overview.ChartRefreshNote(refresh, Modifier.padding(top = BBSpacing.space2))
        Box(Modifier.padding(top = BBSpacing.space2).fullBleed()) {
            if (points != null) {
                val first = points.firstOrNull()
                val summary = if (first == null) "$label: ${money(value ?: 0.0)}." else tr("{0}: da {1} a {2} {3}.",
                    mapOf("0" to label, "1" to money(first.value), "2" to money(value ?: 0.0), "3" to tr(hero.phrase(model.heroPeriod))))
                io.buddybudget.app.designsystem.components.BBTrendChart(
                    points.map { it.value }, money, labels = points.map { p -> CalendarDate.parse(p.date)?.let { BBFormat.formatLongDate(it, locale) } ?: p.date },
                    height = 260.dp, accessibilitySummary = summary,
                )
            } else {
                BBSkeleton(Modifier.fillMaxWidth(), height = 260.dp, radius = 0.dp)
            }
        }
        Box(Modifier.fillMaxWidth().padding(top = BBSpacing.space3), contentAlignment = Alignment.Center) {
            io.buddybudget.app.designsystem.components.PeriodSelector(hero.periods.map { it to hero.label(it) }, model.heroPeriod, { model.updateHeroPeriod(it) },
                accessibilityLabel = tr("Periodo del grafico"))
        }
    }
}

/** Full-bleed horizontal row: cancels the 16 dp screen gutter and puts it back inside the scroll. */
private fun Modifier.fullBleed(): Modifier = layout { measurable, constraints ->
    val extra = (BBSpacing.space4 * 2).roundToPx()
    val placeable = measurable.measure(constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.minWidth + extra))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}

/** Account tiles (web `AccountChips`, TX-012/013). */
@Composable
private fun AccountChips(model: LiquidityModel) {
    val accounts = model.accounts
    if (accounts == null) {
        BBSkeleton(height = 60.dp, radius = BBRadius.radius2xl)
        return
    }
    if (accounts.isEmpty()) return
    val a11y = l10n(R.string.filter_by_account_7af32e)
    Row(
        Modifier.fullBleed().horizontalScroll(rememberScrollState()).padding(horizontal = BBSpacing.space4)
            .semantics { contentDescription = a11y },
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5),
    ) {
        AccountTile(l10n(R.string.all_accounts_029a38), model.month.valueOrNull?.accounts?.total ?: accounts.sumOf { it.balance }, model.currency,
            isSelected = model.selectedAccount == null) { model.selectAccount(null) }
        for (account in accounts) {
            AccountTile(account.name, account.balance, model.currency, needsAttention = account.health?.needsRenewal == true,
                isSelected = model.selectedAccount?.id == account.id) { model.selectAccount(account.id) }
        }
        // TX-012: dashed «+ Conto» tile opening the New-account dialog.
        val shell = LocalShell.current
        val c = BuddyBudgetTheme.colors
        Row(
            Modifier.heightIn(min = 56.dp).dashedBorder(c.border, BBRadius.radius2xl)
                .bbPressable({ shell.open("/liquidita/conti?nuovo=1") }, RoundedCornerShape(BBRadius.radius2xl), translate = false)
                .padding(horizontal = BBSpacing.space4),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
        ) {
            BBIconView(BBIcon.Plus, size = 16.dp, color = c.primary)
            BBText(tr("Conto"), style = BBTextStyle.BodyLarge.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W600), color = c.primary)
        }
    }
}

/**
 * Account filter tile (web `AccountChips`): amount on top (font-heading medium), name below (text-sm `--text-2`),
 * radius 2xl; selected = `--primary` 1.5 border on `--primary @ 10%`, otherwise `--foreground @ 4%`.
 */
@Composable
fun AccountTile(name: String, amount: Double, currency: String, needsAttention: Boolean = false, isSelected: Boolean, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.radius2xl)
    val text = BBFormat.formatCurrency(amount, currency, LocalBBLocale.current, maximumFractionDigits = 0, masked = LocalHideAmounts.current)
    Column(
        Modifier.heightIn(min = 56.dp)
            .background(if (isSelected) c.alphaPrimary10 else c.foreground.copy(alpha = 0.04f), shape)
            .border(1.5.dp, if (isSelected) c.primary else Color.Transparent, shape)
            .bbPressable(onClick, shape, translate = false)
            .semantics { selected = isSelected }
            .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space1_5),
        verticalArrangement = Arrangement.Center,
    ) {
        BBText(text, style = BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W500, fontFeatureSettings = "tnum"), maxLines = 1)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            BBText(name, BBTextStyle.Body, color = c.text2, maxLines = 1)
            if (needsAttention) BBIconView(BBIcon.TriangleAlert, size = 14.dp, color = c.neg)
        }
    }
}

/** Toolbar buttons of Movimenti (web `MovementsToolbar`): 44 high, radius xl, text-sm semibold. */
enum class ToolbarChipStyle { Plain, NegActive, Primary, PrimarySoft }

@Composable
fun ToolbarChip(label: String, style: ToolbarChipStyle, icon: BBIcon? = null, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val (bg, fg, border) = when (style) {
        ToolbarChipStyle.Plain -> Triple(c.card, c.foreground, c.border)
        ToolbarChipStyle.NegActive -> Triple(c.negSoft, c.neg, c.neg)
        ToolbarChipStyle.Primary -> Triple(c.alphaPrimary10, c.primary, c.primary.copy(alpha = 0.3f))
        ToolbarChipStyle.PrimarySoft -> Triple(c.alphaPrimary10, c.primary, Color.Transparent)
    }
    val shape = RoundedCornerShape(BBRadius.xl)
    Row(
        Modifier.heightIn(min = 44.dp).background(bg, shape).border(1.5.dp, border, shape)
            .bbPressable(onClick, shape, translate = false)
            .semantics { selected = style == ToolbarChipStyle.NegActive }
            .padding(horizontal = BBSpacing.space3_5),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
    ) {
        if (icon != null) BBIconView(icon, size = 16.dp, color = fg)
        BBText(label, style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600), color = fg, maxLines = 1)
    }
}

/** Toolbar (TX-014…017). */
@Composable
private fun MovementsToolbar(model: LiquidityModel) {
    val shell = LocalShell.current
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        io.buddybudget.app.designsystem.components.SearchField(model.search, { model.searchChanged(it) }, l10n(R.string.search_transactions_add855))
        val toFix = model.uncategorizedCount
        val filter = model.categoryFilter
        Row(
            Modifier.fullBleed().horizontalScroll(rememberScrollState()).padding(horizontal = BBSpacing.space4),
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SegmentedControl(
                listOf(
                    MovementType.tutte to l10n(R.string.all_148ba1), MovementType.uscita to l10n(R.string.expenses_6db1a3),
                    MovementType.entrata to l10n(R.string.income_5a21be),
                ),
                model.type, { model.updateType(it) }, accessibilityLabel = l10n(R.string.transaction_type_2b7af3),
            )
            if (toFix > 0) {
                ToolbarChip(l10n(R.string.to_review_0_881a1f, toFix.toString()), if (model.uncategorizedOnly) ToolbarChipStyle.NegActive else ToolbarChipStyle.Plain) {
                    model.toggleUncategorized()
                }
            }
        }
        if (toFix > 0 || filter != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
                if (toFix > 0) {
                    ToolbarChip(l10n(R.string.categorise_with_ai_e40e03), ToolbarChipStyle.Primary, BBIcon.Sparkles) {
                        shell.push(ShellRoute.Destination(AppDestination.Categorize))
                    }
                }
                if (filter != null) ToolbarChip(filter.name, ToolbarChipStyle.PrimarySoft, BBIcon.X) { model.updateCategoryFilter(null) }
            }
        }
    }
}

/** Feed (TX-018…022). */
@Composable
private fun MovementsFeed(model: LiquidityModel, onAdd: () -> Unit, onOpen: (MovementSheet) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shell = LocalShell.current
    val segment = LocalLiquiditySegment.current
    when (model.feedState) {
        FeedState.Loading -> BBSkeletonRows(5)
        FeedState.Failed -> LoadError(l10n(R.string.unable_to_load_transactions_43bc45), { model.launch { model.reloadFeed() } })
        FeedState.Loaded -> if (model.feed.isEmpty) {
            when {
                model.query.hasFilters ->
                    BBText(l10n(R.string.no_transactions_match_the_filters_d9a227), BBTextStyle.Body, Modifier.padding(vertical = BBSpacing.space4), color = c.mutedForeground)
                model.accounts.orEmpty().isEmpty() -> EmptyState(
                    BBIcon.Landmark, l10n(R.string.first_add_an_account_83aa48), l10n(R.string.transactions_belong_to_an_account_create_2adce6),
                    primary = BBStateAction(l10n(R.string.create_an_account_ff3b93)) { segment?.select(LiquiditySegment.Accounts) },
                )
                else -> EmptyState(
                    BBIcon.Receipt, l10n(R.string.no_transactions_yet_29377d), l10n(R.string.import_your_bank_s_csv_or_statement_or_r_ef02d6),
                    // TX-022: «Importa un file» (/importazioni) and «Aggiungi un movimento».
                    primary = BBStateAction(io.buddybudget.app.tr("Importa un file")) { shell.open(io.buddybudget.core.domain.shell.AppDestination.Imports) },
                    secondary = BBStateAction(l10n(R.string.add_transaction_6c6135), onAdd),
                )
            }
        } else {
            val groups = model.feed.groups(model.today, LocalBBLocale.current)
            Column {
                for (group in groups) {
                    Column {
                        DayHeader(tr(group.label), group.total, model.currency)
                        for (movement in group.items) {
                            androidx.compose.runtime.key(movement.id) {
                                MovementRow(
                                    model, movement, showAccount = model.selectedAccount == null,
                                    onTap = { shell.openMovement(movement.id, movement) },
                                    onCategory = { onOpen(MovementSheet.Category(movement)) },
                                    onActions = { onOpen(MovementSheet.Actions(movement)) },
                                )
                            }
                        }
                    }
                }
            }
            if (model.feed.hasMore) {
                BBButton(
                    l10n(R.string.show_more_transactions_a07bc6), { model.launch { model.loadMore() } },
                    variant = BBButtonVariant.Outline, size = BBButtonSize.Touch, fullWidth = true, isLoading = model.loadingMore,
                )
            }
            if (model.remoteLogoShown) LogoCredit()
        }
    }
}

/**
 * TX-008: «Hai X su N conti.» + the server pace line (strong parts in bold) + «N movimenti aspettano una categoria.».
 * The height is reserved while loading.
 */
@Composable
fun MonthSentence(model: LiquidityModel) {
    val c = BuddyBudgetTheme.colors
    val month = model.month.valueOrNull
    if (month == null) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBSkeleton(height = 18.dp)
            BBSkeleton(width = 220.dp, height = 18.dp)
        }
        return
    }
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val accountsText = if (month.accounts.count >= 1) {
        val total = BBFormat.formatCurrency(month.accounts.total, model.currency, locale, maximumFractionDigits = 0, masked = hide)
        if (month.accounts.count == 1) l10n(R.string.you_have_0_in_1_account_d3e2c2, total)
        else l10n(R.string.you_have_0_across_1_accounts_4d9169, total, month.accounts.count.toString())
    } else {
        null
    }
    val waiting = when {
        month.toFix == 1 -> l10n(R.string.s_1_transaction_is_waiting_for_a_category_b476a2)
        month.toFix > 1 -> l10n(R.string.s_0_transactions_are_waiting_for_a_categor_6ea7ce, month.toFix.toString())
        else -> null
    }
    val text = buildAnnotatedString {
        if (accountsText != null) {
            // Only the amount is strong, as on the web («Hai **23.915 €** su 6 conti.»).
            val total = BBFormat.formatCurrency(month.accounts.total, model.currency, locale, maximumFractionDigits = 0, masked = hide)
            val at = accountsText.indexOf(total)
            if (at >= 0) {
                append(accountsText.substring(0, at))
                withStyle(SpanStyle(color = c.foreground, fontWeight = FontWeight.W500)) { append(total) }
                append(accountsText.substring(at + total.length) + " ")
            } else {
                append("$accountsText ")
            }
        }
        for (line in month.voice) {
            for (segment in line.segments) {
                val value = if (hide) VoiceText.masked(segment.text) else segment.text
                withStyle(SpanStyle(color = if (segment.strong) c.foreground else c.text2, fontWeight = if (segment.strong) FontWeight.W500 else null)) {
                    append(value)
                }
            }
            append(" ")
        }
        if (waiting != null) withStyle(SpanStyle(color = c.text2)) { append(waiting) }
    }
    androidx.compose.material3.Text(text, style = MonthVoice.copy(color = c.text2))
}

/** text-lg leading-relaxed (web voice sentence). */
val MonthVoice = BBTextStyle.BodyLarge.style.copy(fontSize = 18.sp, lineHeight = 29.sp)

/** The month column of Movimenti (web `MonthAside`, TX-049/050): «Il mese», «Da decidere», «Gruppi di spesa». */
@Composable
fun MonthCard(model: LiquidityModel, modifier: Modifier = Modifier) {
    val shell = LocalShell.current
    val segment = LocalLiquiditySegment.current
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    Column(modifier, verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        BBSection(
            l10n(R.string.the_month_7a4f03),
            actionLabel = if (segment != null) l10n(R.string.analysis_aa653b) else null,
            onAction = { segment?.select(LiquiditySegment.Analysis) },
        ) {
            when (val m = model.month) {
                Loadable.Loading -> Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) { repeat(3) { BBSkeleton(height = 56.dp, radius = BBRadius.radius2xl) } }
                Loadable.Failed -> LoadError(l10n(R.string.unable_to_load_transactions_43bc45), { model.launch { model.loadMonth() } })
                is Loadable.Loaded -> {
                    val month = m.value
                    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                        BBSoftRow(l10n(R.string.income_5a21be)) { AmountText(month.income, model.currency, tone = AmountTone.Pos, signed = true, style = BBStyles.rowAmount) }
                        BBSoftRow(l10n(R.string.expenses_2f97bc)) { AmountText(-month.spent, model.currency, tone = AmountTone.Neg, signed = true, style = BBStyles.rowAmount) }
                        val hint = month.pace.typicalSoFar?.let {
                            l10n(R.string.typically_by_now_0_spent_22104e, BBFormat.formatCurrency(it, model.currency, locale, maximumFractionDigits = 0, masked = hide))
                        }
                        BBSoftRow(l10n(R.string.surplus_so_far_13cbb8), hint = hint) {
                            AmountText(month.surplus, model.currency, tone = AmountTone.Signed, signed = true, style = BBStyles.rowAmount)
                        }
                    }
                }
            }
        }
        val month = model.month.valueOrNull
        if (month != null) {
            if (month.toFix > 0) {
                BBSection(l10n(R.string.to_review_88b521)) {
                    BBSoftRow(
                        if (month.toFix == 1) l10n(R.string.s_1_transaction_71be35) else l10n(R.string.s_0_transactions_57cb30, month.toFix.toString()),
                        hint = l10n(R.string.uncategorized_review_groups_using_sugges_4605f5),
                    ) {
                        BBButton(l10n(R.string.categorise_2e91fc), { shell.push(ShellRoute.Destination(AppDestination.Categorize)) }, size = BBButtonSize.Touch)
                    }
                }
            }
            SpendGroupsSection(month.groups, model.currency)
        }
    }
}

/** «Gruppi di spesa» of the month (web `MonthAside`): the four expense groups with a bar each, scaled to the largest. */
@Composable
private fun SpendGroupsSection(groups: List<LiquidityMonth.Group>, currency: String) {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    val hide = LocalHideAmounts.current
    val shown = listOf("dovuta", "voluta", "futuro", "saltuaria").mapNotNull { key -> groups.firstOrNull { it.key == key } }
    if (shown.isEmpty()) return
    val top = maxOf(shown.maxOf { it.amount }, 1.0)
    BBSection(io.buddybudget.app.tr("Gruppi di spesa")) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3_5)) {
            for (group in shown) {
                Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BBText(tr(group.label), Modifier.weight(1f), BBTextStyle.BodyLarge.style.copy(fontWeight = FontWeight.W600))
                        BBText(BBFormat.formatCurrency(group.amount, currency, locale, masked = hide), style = BBTextStyle.BodyLarge.style.copy(fontFeatureSettings = "tnum"))
                    }
                    Box(Modifier.fillMaxWidth().height(10.dp).background(c.muted, CircleShape)) {
                        Box(Modifier.fillMaxWidth((group.amount.coerceAtLeast(0.0) / top).toFloat()).fillMaxHeight().background(groupColor(c, group.key), CircleShape))
                    }
                }
            }
        }
    }
}

private fun groupColor(c: io.buddybudget.app.designsystem.generated.BBColors, key: String): Color = when (key) {
    "dovuta" -> c.categoryGroupDovuta
    "voluta" -> c.categoryGroupVoluta
    "futuro" -> c.categoryGroupFuturo
    "saltuaria" -> c.categoryGroupSaltuaria
    else -> c.categoryGroupUncategorized
}

/** Day header of the feed (TX-018): label and the day's net effective total. */
@Composable
fun DayHeader(label: String, total: Double, currency: String) {
    Row(
        Modifier.fillMaxWidth().padding(start = BBSpacing.space1_5, end = BBSpacing.space1_5, top = BBSpacing.space5, bottom = BBSpacing.space1).semantics { heading() },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Web `capitalize`: every word starts with a capital («Domenica 18 Ottobre»).
        val shown = label.split(" ").joinToString(" ") { w -> w.replaceFirstChar { it.titlecase() } }
        BBText(shown, Modifier.weight(1f), BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600), color = BuddyBudgetTheme.colors.text2)
        AmountText(total, currency, tone = AmountTone.Signed, signed = true, style = BBTextStyle.BodyStrong.style.copy(fontWeight = FontWeight.W600))
    }
}


/** 1 dp dashed rounded outline (the «+ Conto» tile). */
private fun Modifier.dashedBorder(color: androidx.compose.ui.graphics.Color, radius: androidx.compose.ui.unit.Dp) = drawBehind {
    val stroke = 1.dp.toPx()
    drawRoundRect(color, topLeft = androidx.compose.ui.geometry.Offset(stroke / 2, stroke / 2),
        size = androidx.compose.ui.geometry.Size(size.width - stroke, size.height - stroke),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius.toPx()),
        style = androidx.compose.ui.graphics.drawscope.Stroke(stroke, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
}
