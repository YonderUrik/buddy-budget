package io.buddybudget.app.designsystem.components

import androidx.compose.ui.semantics.selected
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.l10n
import kotlinx.coroutines.launch

// Surfaces & layout (spec: design/components.md §1.3, §1.9, §3.5, §3.12). iOS: BBSurfaces.swift.

/** Room the shell's floating bottom bar takes at the end of every screen (0 outside the signed-in shell). */
val LocalBottomBarSpace = androidx.compose.runtime.compositionLocalOf { 0.dp }

/**
 * Screen scaffold: `--background` edge to edge, a custom 56 dp top bar (components.md §3.12), a large title in the
 * display face that scrolls with the content, optional pull-to-refresh, system-bar insets respected. Tab roots (no
 * back action) show the web's phone top bar: `--sidebar` surface with a bottom border, the brand centred and
 * «Scrivici» on the right; pushed screens show back and the title collapsing into the bar.
 * Content gets the 16 dp phone gutter (full-bleed children such as charts use a negative horizontal offset).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BBScreen(
    title: String?,
    modifier: Modifier = Modifier,
    eyebrow: String? = null,
    onBack: (() -> Unit)? = null,
    onRefresh: (suspend () -> Unit)? = null,
    scrollable: Boolean = true,
    /** Style of the large title (the Panoramica greeting is larger, 44 sp). */
    titleStyle: TextStyle = BBStyles.screenTitle,
    actions: @Composable RowScope.() -> Unit = {},
    /** Pinned below the scrolling content (e.g. the German plan save bar); nothing by default. */
    bottomBar: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    val scroll = rememberScrollState()
    // DEBUG-only `bbScrollY`: scroll down after loading (screenshots); 0 in release.
    val debugScroll = io.buddybudget.app.debug.DebugLaunch.scrollY
    if (debugScroll > 0) {
        val density = androidx.compose.ui.platform.LocalDensity.current
        androidx.compose.runtime.LaunchedEffect(Unit) {
            kotlinx.coroutines.delay(7000)
            scroll.scrollTo(with(density) { debugScroll.dp.roundToPx() })
        }
    }
    var titleBottom by remember { mutableIntStateOf(Int.MAX_VALUE) }
    val collapsed by remember(title) { derivedStateOf { title != null && scroll.value > titleBottom } }
    val barAlpha by animateFloatAsState(if (collapsed) 1f else 0f, tween(150), label = "topBar")
    val isRoot = onBack == null

    Column(modifier.fillMaxSize().background(c.background)) {
        // Top bar
        Box(
            Modifier.fillMaxWidth().background(if (isRoot) c.sidebarBackground else c.background).statusBarsPadding().height(BBLayout.topBarHeight),
            contentAlignment = Alignment.Center,
        ) {
            if (isRoot) {
                Row(
                    Modifier.semantics(mergeDescendants = true) { heading() },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
                ) {
                    BBLogoMark(height = 24.dp)
                    BBText(l10n(io.buddybudget.app.generated.L10n.appName), style = BBStyles.brandName, color = c.sidebarForeground)
                }
            } else if (title != null) {
                BBText(title, Modifier.padding(horizontal = 56.dp).alpha(barAlpha), BBStyles.topBarTitle, maxLines = 1)
            }
            Row(Modifier.fillMaxSize().padding(horizontal = BBSpacing.space2), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) {
                    val back = l10n(io.buddybudget.app.R.string.back_83c968)
                    Box(
                        Modifier.size(BBLayout.minTouchTarget)
                            .bbPressable(onBack, CircleShape, pressedBackground = c.muted)
                            .semantics { contentDescription = back },
                        contentAlignment = Alignment.Center,
                    ) { BBIconView(BBIcon.ChevronLeft, size = BBIconSize.Xl.dp, color = c.foreground) }
                }
                Spacer(Modifier.weight(1f))
                // SHELL-023: «Scrivici» on the tab roots (set by the shell only there).
                val openScrivici = io.buddybudget.app.features.help.LocalOpenScrivici.current
                Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                    // Tab roots carry their actions next to the large title (web: page actions beside the title).
                    if (!isRoot || title == null) actions()
                    if (onBack == null && openScrivici != null) {
                        BBIconButton(BBIcon.MessageCircleQuestionMark, io.buddybudget.app.tr("Scrivici: segnala un problema, una domanda o un'idea"), onClick = openScrivici)
                    }
                }
            }
            Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(1.dp).alpha(if (isRoot) 1f else barAlpha).background(c.sidebarBorder))
        }

        val largeTitle: @Composable () -> Unit = {
            if (title != null) {
                // #427: no small section name above the title on the phone (`eyebrow` is kept for TalkBack only).
                Row(
                    Modifier.fillMaxWidth().padding(start = BBSpacing.space4, end = BBSpacing.space2, top = BBSpacing.space6, bottom = BBSpacing.space4)
                        .onGloballyPositioned { titleBottom = it.size.height },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BBText(
                        title,
                        Modifier.weight(1f).semantics { heading(); if (eyebrow != null) contentDescription = "$eyebrow, $title" },
                        titleStyle,
                    )
                    if (isRoot) Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1), verticalAlignment = Alignment.CenterVertically) { actions() }
                }
            }
        }

        if (scrollable) {
            val body: @Composable () -> Unit = {
                Column(Modifier.fillMaxSize().verticalScroll(scroll)) {
                    largeTitle()
                    Column(Modifier.fillMaxWidth().padding(horizontal = BBSpacing.space4), content = content)
                    Spacer(Modifier.navigationBarsPadding().height(BBSpacing.space6 + LocalBottomBarSpace.current))
                }
            }
            Box(Modifier.weight(1f)) {
            if (onRefresh != null) {
                val scope = rememberCoroutineScope()
                var refreshing by remember { mutableStateOf(false) }
                val state = rememberPullToRefreshState()
                PullToRefreshBox(
                    isRefreshing = refreshing,
                    onRefresh = { scope.launch { refreshing = true; try { onRefresh() } finally { refreshing = false } } },
                    state = state,
                    modifier = Modifier.fillMaxSize(),
                    indicator = {
                        PullToRefreshDefaults.Indicator(
                            state = state, isRefreshing = refreshing, modifier = Modifier.align(Alignment.TopCenter),
                            containerColor = c.popover, color = c.mutedForeground,
                        )
                    },
                ) { body() }
            } else {
                body()
            }
            }
            if (bottomBar != null) Box(Modifier.padding(bottom = LocalBottomBarSpace.current)) { bottomBar() }
        } else {
            Column(Modifier.fillMaxSize().navigationBarsPadding().padding(bottom = LocalBottomBarSpace.current)) {
                largeTitle()
                Column(Modifier.fillMaxWidth().padding(horizontal = BBSpacing.space4), content = content)
            }
        }
    }
}

/** 44 dp round icon button for top bars and rows. */
@Composable
fun BBIconButton(icon: BBIcon, accessibilityLabel: String, color: Color = BuddyBudgetTheme.colors.text2, onClick: () -> Unit) {
    Box(
        Modifier.size(BBLayout.minTouchTarget)
            .bbPressable(onClick, RoundedCornerShape(BBRadius.xl), pressedBackground = BuddyBudgetTheme.colors.muted, translate = false)
            .semantics { contentDescription = accessibilityLabel },
        contentAlignment = Alignment.Center,
    ) { BBIconView(icon, size = BBIconSize.Lg.dp, color = color) }
}

enum class BBCardSize { Default, Sm }

/** Filled `--card` surface, radius xl, no ring and no shadow (#417); padding and gap = 16 (sm 12). */
@Composable
fun BBCard(modifier: Modifier = Modifier, size: BBCardSize = BBCardSize.Default, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    val pad = if (size == BBCardSize.Sm) BBLayout.cardPaddingSm else BBLayout.cardPadding
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(
        modifier.fillMaxWidth().background(c.card, shape).padding(pad),
        verticalArrangement = Arrangement.spacedBy(pad),
        content = content,
    )
}

/** Card header: title (font-heading text-base medium), optional description and trailing action. */
@Composable
fun BBCardHeader(title: String, description: String? = null, size: BBCardSize = BBCardSize.Default, action: @Composable () -> Unit = {}) {
    val c = BuddyBudgetTheme.colors
    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
            val style = BBTextStyle.CardTitle.style
            BBText(title, style = if (size == BBCardSize.Sm) style.copy(fontSize = BBTextStyle.Body.style.fontSize, lineHeight = BBTextStyle.Body.style.lineHeight) else style)
            if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        }
        action()
    }
}

/**
 * Open section (`SECTION_TITLE`): the title in the display face with no icon (#427), an optional link-style action on
 * the right, then the content 16 dp below. [icon]/[color] are accepted for call-site compatibility and not drawn.
 */
@Composable
fun BBSection(
    title: String,
    modifier: Modifier = Modifier,
    icon: BBIcon? = null,
    color: Color = BuddyBudgetTheme.colors.primary,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = BuddyBudgetTheme.colors
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(title, Modifier.weight(1f).semantics { heading() }, BBStyles.sectionHeading)
            if (actionLabel != null && onAction != null) {
                Row(
                    Modifier.offset(x = BBSpacing.space2)
                        .heightIn(min = BBLayout.minTouchTarget)
                        .bbPressable(onAction, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
                        .padding(horizontal = BBSpacing.space2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
                ) {
                    BBText(actionLabel, style = BBStyles.link, color = c.primary)
                    BBIconView(BBIcon.ArrowRight, color = c.primary)
                }
            }
        }
        content()
    }
}

/** 1 dp `--border` line (horizontal by default). */
@Composable
fun BBSeparator(modifier: Modifier = Modifier, vertical: Boolean = false) {
    val color = BuddyBudgetTheme.colors.border
    Box(if (vertical) modifier.width(1.dp).fillMaxHeight().background(color) else modifier.fillMaxWidth().height(1.dp).background(color))
}

// ---------------------------------------------------------------- SectionViewsHeading

/** One view of a section with several views (Liquidità: Movimenti, Analisi, …) in the views sheet. */
data class SectionViewItem(
    val id: String,
    val label: String,
    val description: String? = null,
    val icon: BBIcon? = null,
    val isActive: Boolean = false,
    val action: () -> Unit,
)

/**
 * Phone heading of a section with several views (web `SectionHeading` below `lg`, #427): the current view as the
 * title in the display face with a round chevron, opening a sheet with every view and its description; an optional
 * trailing action (the section's yellow main button). No tabs and no section name above the title.
 */
@Composable
fun SectionViewsHeading(
    sectionTitle: String,
    items: List<SectionViewItem>,
    modifier: Modifier = Modifier,
    trailing: @Composable () -> Unit = {},
) {
    val c = BuddyBudgetTheme.colors
    // `--es bbSheet views:<Italian section title>` (debug only, e.g. `views:Investimenti`): that section's views sheet starts open.
    val debugSheet = io.buddybudget.app.debug.DebugLaunch.value("bbSheet")
    val debugOpen = debugSheet?.startsWith("views:") == true && io.buddybudget.app.tr(debugSheet.removePrefix("views:")) == sectionTitle
    var open by remember { mutableStateOf(debugOpen) }
    val scope = rememberCoroutineScope()
    val active = items.firstOrNull { it.isActive } ?: items.firstOrNull()
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        if (active != null) {
            val label = io.buddybudget.app.tr("{0}: cambia vista di {1}", mapOf("0" to active.label, "1" to sectionTitle))
            Row(
                Modifier.heightIn(min = BBLayout.minTouchTarget)
                    .bbPressable({ open = true }, RoundedCornerShape(BBRadius.lg), translate = false)
                    .semantics(mergeDescendants = true) { heading(); contentDescription = label },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
            ) {
                BBText(active.label, style = if (active.label.length > 12) BBStyles.viewTitleLong else BBStyles.sectionHeading, maxLines = 1)
                Box(Modifier.size(28.dp).background(c.muted, CircleShape), contentAlignment = Alignment.Center) {
                    BBIconView(BBIcon.ChevronDown, size = 16.dp, color = c.text2)
                }
            }
        }
        Spacer(Modifier.weight(1f))
        trailing()
    }
    BBSheet(visible = open, onDismiss = { open = false }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(sectionTitle, Modifier.padding(horizontal = BBSpacing.space1).semantics { heading() }, BBStyles.titleSmall)
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                items.forEach { item ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 56.dp)
                            .background(if (item.isActive) c.muted else Color.Transparent, RoundedCornerShape(BBRadius.xl))
                            .bbPressable({
                                open = false
                                if (!item.isActive) scope.launch { kotlinx.coroutines.delay(180); item.action() }
                            }, RoundedCornerShape(BBRadius.xl), pressedBackground = c.alphaMuted60, translate = false)
                            .semantics { selected = item.isActive }
                            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
                    ) {
                        if (item.icon != null) BBIconView(item.icon, size = 20.dp, color = if (item.isActive) c.primary else c.text2)
                        Column(Modifier.weight(1f)) {
                            BBText(item.label, style = BBTextStyle.BodyLarge.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500))
                            if (item.description != null) BBText(item.description, BBTextStyle.Body, color = c.text2)
                        }
                        if (item.isActive) BBIconView(BBIcon.Check, size = 16.dp, color = c.primary)
                    }
                }
            }
        }
    }
}

/** The page's main action as a yellow circle (web `Button variant="sun"` `size-11` with a plus on the phone). */
@Composable
fun BBSunIconButton(accessibilityLabel: String, icon: BBIcon = BBIcon.Plus, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Box(
        Modifier.size(BBLayout.minTouchTarget)
            .background(c.sun, CircleShape)
            .bbPressable(onClick, CircleShape, pressedBackground = c.sunHover)
            .semantics { contentDescription = accessibilityLabel },
        contentAlignment = Alignment.Center,
    ) { BBIconView(icon, size = 16.dp, color = c.onSun) }
}

// ---------------------------------------------------------------- SimulationResult

enum class SimulationResultTone { Neutral, Pos, Neg }

/**
 * The answer of a simulator (#411): a short label, the result as one big figure (Hanken, never the condensed face) and
 * one line of context. Every «what if» reads the same way.
 */
@Composable
fun SimulationResult(label: String, value: String, modifier: Modifier = Modifier, tone: SimulationResultTone = SimulationResultTone.Neutral, caption: String? = null) {
    val c = BuddyBudgetTheme.colors
    Column(modifier.fillMaxWidth().semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(label, BBTextStyle.Body, color = c.text2)
        BBText(value, style = BBTextStyle.Display.style, color = when (tone) {
            SimulationResultTone.Pos -> c.pos
            SimulationResultTone.Neg -> c.neg
            SimulationResultTone.Neutral -> c.foreground
        })
        if (caption != null) BBText(caption, Modifier.padding(top = BBSpacing.space1), BBTextStyle.Body.style, color = c.text2)
    }
}
