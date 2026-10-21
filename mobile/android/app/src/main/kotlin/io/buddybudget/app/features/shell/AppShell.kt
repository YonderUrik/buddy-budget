package io.buddybudget.app.features.shell

import io.buddybudget.app.designsystem.components.bbShadow
import androidx.compose.ui.unit.em
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import io.buddybudget.app.features.overview.DemoBanner

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.rememberReduceMotion
import io.buddybudget.app.designsystem.generated.BBFontFamilies
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.domain.shell.AppTab
import io.buddybudget.core.domain.shell.Navigation

/** Back action for screens pushed on a tab stack (null for tab roots): pass it to `BBScreen(onBack = …)`. */
val LocalShellBack = compositionLocalOf<(() -> Unit)?> { null }

/** The signed-in shell model (for screens that navigate). */
val LocalShell = compositionLocalOf<ShellModel> { error("No ShellModel") }

/**
 * The signed-in app (SHELL-012…027): one back stack per tab, kept while switching, and the custom [BottomNav].
 * Screens come from [FeatureRegistry].
 */
@Composable
fun AppShell() {
    val env = LocalEnv.current
    val shell = remember { ShellModel(env).also { it.start() } }
    val c = BuddyBudgetTheme.colors
    val saveable = rememberSaveableStateHolder()
    val reduceMotion = rememberReduceMotion()
    BackHandler(enabled = shell.path(shell.tab).isNotEmpty()) { shell.back() }
    // Polling only in the foreground, refresh on return (14-imports mobile note).
    val lifecycle = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle
    androidx.compose.runtime.DisposableEffect(lifecycle) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_START -> shell.setForeground(true)
                androidx.lifecycle.Lifecycle.Event.ON_STOP -> shell.setForeground(false)
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    // Files and links handed to the app (share sheet, «Apri con», email links).
    val locale = io.buddybudget.app.designsystem.components.LocalBBLocale.current
    // Only the resumed screen takes it: a share can open a second MainActivity while an earlier one sits stopped in
    // another task, and both shells read the same environment.
    val lifecycleState by lifecycle.currentStateFlow.collectAsState()
    val resumed = lifecycleState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)
    androidx.compose.runtime.LaunchedEffect(env.incoming, resumed) {
        if (!resumed) return@LaunchedEffect
        val incoming = env.incoming ?: return@LaunchedEffect
        env.incoming = null
        shell.receive(incoming, locale)
    }
    // 16-help-support: report links, the «Segnala» toast action and «Scrivici» open one sheet.
    CompositionLocalProvider(LocalShell provides shell, io.buddybudget.app.features.help.LocalQuickReport provides env.quickReport) {
        Column(Modifier.fillMaxSize().background(c.background)) {
            // SHELL-048: demo banner above every screen; the screens below then skip the status-bar inset.
            val demo = shell.overview.demoActive
            if (demo) DemoBanner(Modifier.statusBarsPadding())
            Box(Modifier.weight(1f).fillMaxWidth().then(if (demo) Modifier.consumeWindowInsets(WindowInsets.statusBars) else Modifier)) {
              // The floating capsule: screens scroll under it and leave this much room at the end (web `BOTTOM_NAV_HEIGHT_REM`).
              CompositionLocalProvider(io.buddybudget.app.designsystem.components.LocalBottomBarSpace provides
                  (BBLayout.bottomNavHeight + BBLayout.bottomNavInset * 2)) {
                val tab = shell.tab
                val stack = shell.path(tab)
                AnimatedContent(
                    targetState = Triple(tab, stack.size, stack.lastOrNull()),
                    transitionSpec = {
                        val sameTab = initialState.first == targetState.first
                        if (reduceMotion || !sameTab) {
                            fadeIn(tween(if (sameTab) 150 else 200)) togetherWith fadeOut(tween(150))
                        } else if (targetState.second > initialState.second) {
                            slideInHorizontally(tween(260)) { it } togetherWith slideOutHorizontally(tween(260)) { -it / 4 }
                        } else {
                            slideInHorizontally(tween(260)) { -it / 4 } togetherWith slideOutHorizontally(tween(260)) { it }
                        }
                    },
                    label = "shell",
                ) { (t, depth, top) ->
                    saveable.SaveableStateProvider("$t-$depth-$top") {
                        if (top == null) {
                            val root = t.root
                            CompositionLocalProvider(io.buddybudget.app.features.help.LocalOpenScrivici provides {
                                env.quickReport.open(io.buddybudget.core.domain.support.ReportSource.Pulsante)
                            }) {
                                if (root != null) FeatureRegistry.Screen(ShellRoute.Destination(root)) else MoreMenuScreen()
                            }
                        } else {
                            CompositionLocalProvider(LocalShellBack provides { shell.back() }) { FeatureRegistry.Screen(top) }
                        }
                    }
                }
              }
                Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
                    // IMP-058: the import island on every screen, above the bottom bar.
                    io.buddybudget.app.features.imports.ImportIsland(shell.imports) { id -> shell.open("/importazioni?job=$id") }
                    BottomNav(shell.tabs, shell.tab, shell::select)
                }
            }
        }
        io.buddybudget.app.features.help.QuickReportHost(env.quickReport)
        // TX-064: the movement detail, from any list; changes reload the screens behind when it closes.
        io.buddybudget.app.features.liquidity.MovementDetailHost(
            env, shell.movementDetail,
            onDismiss = { shell.movementDetail = null },
            openSettings = { shell.movementDetail = null; shell.open("/impostazioni?sezione=notifiche") },
            onChanged = { shell.dataChanged() },
        )
    }
}

/**
 * Bottom tab bar (components.md §3.12, SHELL-013…016; web decision 2026-10-17-barra-in-basso-a-capsula): a floating
 * capsule inset 12 dp from the sides and from the bottom (+ nav-bar inset), translucent `--sidebar`, 1 dp
 * `--sidebar-border`, shadow-lg (a floating layer). Icons 24, labels 11 medium; one light grey pill
 * (`--sidebar-accent`) slides to the active tab, whose icon and label turn `--sidebar-primary` (no badge, web #451).
 */
@Composable
fun BottomNav(tabs: List<AppTab>, selected: AppTab, onSelect: (AppTab) -> Unit) {
    val c = BuddyBudgetTheme.colors
    val reduceMotion = rememberReduceMotion()
    val navLabel = l10n(R.string.main_navigation_ff5a3e)
    val shape = CircleShape
    Box(
        Modifier.fillMaxWidth().navigationBarsPadding()
            .padding(start = BBLayout.bottomNavInset, end = BBLayout.bottomNavInset, bottom = BBLayout.bottomNavInset)
            .semantics { contentDescription = navLabel },
    ) {
        BoxWithConstraints(
            Modifier.fillMaxWidth().height(BBLayout.bottomNavHeight)
                .bbShadow(io.buddybudget.app.designsystem.generated.BBShadow.lg, shape)
                .background(c.sidebarBackground.copy(alpha = 0.96f), shape)
                .border(1.dp, c.sidebarBorder, shape)
                .padding(horizontal = BBSpacing.space1),
        ) {
            val tabWidth = maxWidth / tabs.size
            val index = tabs.indexOf(selected).coerceAtLeast(0)
            val pillX by animateDpAsState(
                tabWidth * index,
                if (reduceMotion) tween(150) else BBMotion.springSnappy.spec(), label = "pill",
            )
            Box(Modifier.offset(x = pillX, y = BBSpacing.space1).size(tabWidth, BBLayout.bottomNavHeight - BBSpacing.space2).background(c.sidebarAccent, CircleShape))
            Row(Modifier.fillMaxSize()) {
                tabs.forEach { tab ->
                    val active = tab == selected
                    val title = tr(tab.title)
                    val tint = if (active) c.sidebarPrimary else c.sidebarForeground.copy(alpha = 0.6f)
                    Column(
                        Modifier.weight(1f).fillMaxSize()
                            .bbPressable({ onSelect(tab) }, CircleShape, translate = false)
                            .semantics { this.selected = active; contentDescription = title },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
                    ) {
                        Box(Modifier.size(40.dp, 28.dp), contentAlignment = Alignment.Center) {
                            BBIconView(BBIcon.forKey(tab.iconKey) ?: BBIcon.Ellipsis, size = 24.dp, color = tint)
                        }
                        BBText(
                            title, Modifier.padding(horizontal = 2.dp),
                            style = BBTextStyle.Micro.style.copy(lineHeight = 12.sp, letterSpacing = (-0.025).em),
                            color = tint, maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}
