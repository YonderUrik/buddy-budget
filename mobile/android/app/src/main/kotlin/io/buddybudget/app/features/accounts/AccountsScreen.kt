package io.buddybudget.app.features.accounts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import io.buddybudget.app.BuildConfig
import io.buddybudget.app.LocalEnv
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBCardSize
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.Sparkline
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.liquidity.LiquiditySegmentBar
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.app.tr
import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountStatusLine
import io.buddybudget.core.data.AccountStatusTone
import io.buddybudget.core.data.SyncJob
import io.buddybudget.core.data.SyncJobAccount
import io.buddybudget.core.data.SyncJobStatus
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.accounts.AccountGroup
import io.buddybudget.core.domain.accounts.AccountsPaths
import io.buddybudget.core.domain.accounts.RenewalAlert
import io.buddybudget.core.domain.accounts.RenewalAlerts
import io.buddybudget.core.domain.accounts.SyncBar
import io.buddybudget.core.domain.accounts.SyncJobs
import io.buddybudget.core.domain.accounts.SyncTone
import io.buddybudget.core.domain.format.BBFormat

/**
 * Liquidità · Conti (04-accounts-bank-sync, ACC-001…010, 043…051): renewal banner, sync jobs, accounts grouped by bank
 * then manual, «Aggiungi un conto»; hosts the New-account and detail sheets and «Conti trovati». Twin of
 * `AccountsScreen` on iOS.
 */
@Composable
fun AccountsScreen() {
    val env = LocalEnv.current
    val shell = LocalShell.current
    val context = LocalContext.current
    val model = remember { AccountsModel(env, shell) }
    // Kept while the sheets animate out after their model is cleared.
    var shownNew by remember { mutableStateOf<NewAccountModel?>(null) }
    var shownDetail by remember { mutableStateOf<Account?>(null) }
    model.newAccount?.let { if (shownNew !== it) shownNew = it }
    model.detail?.let { if (shownDetail != it) shownDetail = it }

    LaunchedEffect(model) {
        model.start()
        model.consume(shell.accountsIntent)
        if (BuildConfig.DEBUG) context.findActivity()?.intent?.getStringExtra("bbAccounts")?.let { AccountsDebug.apply(it, model) }
    }
    LaunchedEffect(shell.accountsIntent) { model.consume(shell.accountsIntent) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> BankBrowser.onAppPaused()
                Lifecycle.Event.ON_RESUME -> BankBrowser.onAppResumed()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            model.stop()
        }
    }

    val found = model.found
    if (found != null) {
        FoundAccountsScreen(found) { model.finishFound(it) }
        return
    }
    BBScreen(null, onRefresh = {
        model.refresh()
        model.loadJobs()
    }) {
        LiquiditySegmentBar()
        AccountsContent(model)
    }
    BBSheet(model.newAccount != null, { model.newAccount = null }) {
        (model.newAccount ?: shownNew)?.let { NewAccountSheet(it) }
    }
    BBSheet(model.detailId != null, { model.detailId = null }) {
        (model.detail ?: shownDetail)?.let { account -> androidx.compose.runtime.key(account.id) { AccountDetailSheet(model, account) } }
    }
}

@Composable
private fun AccountsContent(model: AccountsModel) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) {
        model.jobs.forEach { job ->
            SyncJobCard(job, onDismiss = { model.dismiss(job) }, onCategorize = { model.navigate(AccountsPaths.CATEGORIZE) })
        }
        val alerts = model.alerts
        if (alerts.isNotEmpty()) RenewalBanner(alerts) { model.openNewAccount(true) }
        when (val state = model.accounts) {
            is Loadable.Loading -> AccountsSkeleton()
            is Loadable.Failed -> LoadError(tr("Impossibile caricare i conti."), { model.retry() })
            is Loadable.Loaded -> if (state.value.isEmpty()) {
                EmptyState(
                    BBIcon.Landmark, tr("Nessun conto ancora"), tr("Collega la banca o aggiungi un conto a mano: bastano un nome e il saldo."),
                    primary = BBStateAction(tr("Aggiungi il primo conto")) { model.openNewAccount(false) },
                    secondary = BBStateAction(tr("Importa un file")) { model.navigate(AccountsPaths.IMPORTS) },
                )
            } else {
                model.groups.forEach { AccountGroupSection(it, model) }
                BBButton(tr("Aggiungi un conto"), { model.openNewAccount(false) }, icon = BBIcon.Plus, size = BBButtonSize.Touch)
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------- Groups and rows

@Composable
private fun AccountGroupSection(group: AccountGroup, model: AccountsModel) {
    val c = BuddyBudgetTheme.colors
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            BBText(tr(group.label), Modifier.weight(1f).semantics { heading() }, BBStyles.sectionHeading, maxLines = 1)
            AmountText(group.total, model.currency)
        }
        BBText(tr(group.hint), Modifier.padding(top = BBSpacing.space1, bottom = BBSpacing.space3), BBTextStyle.Body.style, color = c.text2)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            group.accounts.forEach { account ->
                AccountLine(account, model.status(account), model.currency, onOpen = { model.detailId = account.id }, onMovements = { model.showMovements(account) })
            }
        }
    }
}

/**
 * Account row (web `AccountLine`): avatar 44, name, type, status with tone, 30-day sparkline (linked, phone too, under
 * the balance), balance; trailing list button → Movimenti filtered on the account.
 */
@Composable
fun AccountLine(account: Account, status: AccountStatusLine, currency: String, onOpen: () -> Unit, onMovements: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.radius2xl)
    val amount = BBFormat.formatCurrency(account.balance, currency, LocalBBLocale.current, masked = LocalHideAmounts.current)
    val label = tr("{0}, {1}, {2}. {3}. Apri i dettagli", mapOf("0" to account.name, "1" to account.type, "2" to amount, "3" to tr(status.label)))
    val movementsLabel = tr("Vedi i movimenti di {0}", mapOf("0" to account.name))
    Row(
        Modifier.fillMaxWidth().height(IntrinsicSize.Min).background(c.foreground.copy(alpha = 0.04f), shape),
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1),
    ) {
        Row(
            Modifier.weight(1f).heightIn(min = 68.dp)
                .bbPressable(onOpen, shape, pressedBackground = c.foreground.copy(alpha = 0.04f), translate = false)
                .clearAndSetSemantics { contentDescription = label }
                .padding(horizontal = BBSpacing.space4, vertical = BBSpacing.space3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
        ) {
            BBIconBadge(BBIcon.account(account.icon), bbSwatch(account.color), 44.dp, 19.dp)
            Column(Modifier.weight(1f)) {
                BBText(account.name, style = BBStyles.rowTitle, maxLines = 1)
                BBText(account.type, BBTextStyle.Body, color = c.text2, maxLines = 1)
                AccountStatusText(status)
            }
            // Phone: the 30-day sparkline sits under the balance so the name keeps its width.
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                AmountText(
                    account.balance, currency, tone = if (account.balance < 0) AmountTone.Neg else AmountTone.Neutral,
                    style = BBStyles.rowAmount.copy(fontSize = 18.sp, lineHeight = 28.sp),
                )
                val trend = account.trend
                if (trend != null && account.isLinked) Sparkline(trend, width = 64.dp, height = 20.dp)
            }
        }
        Box(
            Modifier.width(48.dp).fillMaxHeight()
                .bbPressable(onMovements, shape, pressedBackground = c.foreground.copy(alpha = 0.06f), translate = false)
                .semantics { contentDescription = movementsLabel },
            contentAlignment = Alignment.Center,
        ) { BBIconView(BBIcon.ListOrdered, size = BBIconSize.Lg.dp, color = c.text2) }
    }
}

/** Status line with tone: warning = triangle + neg medium, progress = spinner + primary, else `--text-2`. */
@Composable
fun AccountStatusText(status: AccountStatusLine) {
    val c = BuddyBudgetTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        when (status.tone) {
            AccountStatusTone.Warning -> BBIconView(BBIcon.TriangleAlert, size = BBIconSize.Sm.dp, color = c.neg)
            AccountStatusTone.Progress -> BBSpinner(BBIconSize.Sm.dp, c.primary)
            else -> Unit
        }
        val color = when (status.tone) {
            AccountStatusTone.Warning -> c.neg
            AccountStatusTone.Progress -> c.primary
            else -> c.text2
        }
        BBText(tr(status.label), style = if (status.tone == AccountStatusTone.Warning) BBTextStyle.BodyStrong.style else BBTextStyle.Body.style, color = color, maxLines = 1)
    }
}

// ---------------------------------------------------------------------------------------------------------- Renewal banner (ACC-007)

@Composable
private fun RenewalBanner(alerts: List<RenewalAlert>, onRenew: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Row(
        Modifier.fillMaxWidth().background(c.destructive.copy(alpha = 0.1f), shape).border(1.dp, c.destructive.copy(alpha = 0.3f), shape)
            .padding(BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBIconView(BBIcon.TriangleAlert, size = 18.dp, color = c.destructive)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
            alerts.forEach { BBText(accountsText(RenewalAlerts.message(it)), BBTextStyle.Body) }
        }
        BBButton(tr("Rinnova"), onRenew, size = BBButtonSize.Sm)
    }
}

// ---------------------------------------------------------------------------------------------------------- Sync jobs (ACC-047…050)

@Composable
fun SyncJobCard(job: SyncJob, onDismiss: () -> Unit, onCategorize: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val finished = SyncJobs.isFinished(job)
    val failed = job.status == SyncJobStatus.Failed || job.interrupted
    val title = accountsText(SyncJobs.title(job))
    BBCard(size = BBCardSize.Sm) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) {
                when {
                    !finished -> BBSpinner(BBIconSize.Md.dp, c.primary)
                    failed -> BBIconView(BBIcon.CircleAlert, size = BBIconSize.Lg.dp, color = c.neg)
                    else -> BBIconView(BBIcon.CircleCheck, size = BBIconSize.Lg.dp, color = c.pos)
                }
            }
            BBText(title, Modifier.weight(1f), BBTextStyle.BodyStrong.style, maxLines = 1)
            if (finished) Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                BBIconButton(BBIcon.X, tr("Chiudi riepilogo"), c.mutedForeground, onDismiss)
            }
        }
        val overall = SyncJobs.overallProgress(job)
        if (!finished && overall is SyncBar.Determinate) ProgressBar(BBProgressState.Determinate(overall.value, overall.max), label = title)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            job.accounts.forEach { SyncAccountRow(it, job.interrupted) }
        }
        // SHELL-046: a finished job with errors offers the report (area `sync_banca`), then «Categorizza».
        val someError = failed || job.accounts.any { SyncJobs.describe(it, job.interrupted).tone == SyncTone.Error }
        if (finished && (someError || SyncJobs.uncategorized(job) > 0)) {
            Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3), verticalAlignment = Alignment.CenterVertically) {
                if (someError) io.buddybudget.app.features.help.ReportErrorLink(io.buddybudget.core.domain.support.ReportErrorArea.SyncBanca, accountsText(SyncJobs.title(job)))
                if (SyncJobs.uncategorized(job) > 0) BBButton(tr("Categorizza"), onCategorize, size = BBButtonSize.Sm)
            }
        }
    }
}

@Composable
private fun SyncAccountRow(account: SyncJobAccount, interrupted: Boolean) {
    val c = BuddyBudgetTheme.colors
    val progress = SyncJobs.describe(account, interrupted)
    val label = tr("Avanzamento {0}", mapOf("0" to account.name))
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
        BBText(account.name, BBTextStyle.BodyStrong, maxLines = 1)
        BBText(
            accountsText(progress.text), BBTextStyle.Caption,
            color = when (progress.tone) {
                SyncTone.Error -> c.neg
                SyncTone.Success -> c.foreground
                SyncTone.Normal -> c.mutedForeground
            },
        )
        when (val bar = progress.bar) {
            SyncBar.None -> Unit
            SyncBar.Indeterminate -> ProgressBar(BBProgressState.Indeterminate, label = label)
            is SyncBar.Determinate -> ProgressBar(
                BBProgressState.Determinate(bar.value, bar.max), label = label, color = if (progress.tone == SyncTone.Success) c.pos else c.primary,
            )
        }
    }
}

// ---------------------------------------------------------------------------------------------------------- Loading

@Composable
private fun AccountsSkeleton() {
    val loading = l10n(L10n.loading)
    Column(Modifier.clearAndSetSemantics { contentDescription = loading }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5)) {
            BBSkeleton(width = 36.dp, height = 36.dp, radius = 18.dp)
            BBSkeleton(width = 140.dp, height = 20.dp)
            Spacer(Modifier.weight(1f))
            BBSkeleton(width = 80.dp, height = 20.dp)
        }
        BBSkeleton(width = 120.dp, height = 14.dp)
        repeat(3) { BBSkeleton(height = 68.dp, radius = BBRadius.radius2xl) }
    }
}
