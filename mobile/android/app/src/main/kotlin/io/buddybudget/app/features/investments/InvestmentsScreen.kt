package io.buddybudget.app.features.investments

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBSunIconButton
import io.buddybudget.app.designsystem.components.SectionViewItem
import io.buddybudget.app.designsystem.components.SectionViewsHeading
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.FormDialog
import io.buddybudget.app.designsystem.components.ScrollableSegmentedControl
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.features.planningde.GermanPlanSaveBar
import io.buddybudget.app.features.planningde.UnsavedPlanSheetContent
import io.buddybudget.app.tr
import io.buddybudget.core.domain.investments.InvestmentsCountryContent
import io.buddybudget.core.domain.investments.InvestmentsRules
import io.buddybudget.core.domain.investments.InvestmentsTab

/**
 * Investimenti section frame (07-investments): title, `Registra` action, the six tabs as a scrollable segmented bar
 * (INV-002, country-gated INV-003), the broker chip (INV-008) and the active tab. Twin of `InvestmentsScreen` on iOS.
 */
@Composable
fun InvestmentsScreen() {
    val shell = LocalShell.current
    val model = shell.investments
    LaunchedEffect(Unit) { model.start() }
    val version = remember { mutableStateOf(shell.dataVersion) }
    LaunchedEffect(shell.dataVersion) {
        if (version.value != shell.dataVersion) {
            version.value = shell.dataVersion
            model.reloadAll()
        }
    }
    val planning = model.planning
    // DE Tasse / Dividendi are the German plan (13-planning-de): bottom save bar and the unsaved-changes sheet.
    val german = model.countryContent == InvestmentsCountryContent.GermanPlan &&
        (model.state.tab == InvestmentsTab.Taxes || model.state.tab == InvestmentsTab.Income)
    val back = LocalShellBack.current
    BBScreen(null, onBack = back?.let { b -> { planning.confirmLeave(b) } }, onRefresh = { model.reloadAll() }, bottomBar = { if (german) GermanPlanSaveBar(planning) }) {
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
                // #427: on the phone the current tab is the title («Portafoglio ⌄») and opens the views sheet.
                SectionViewsHeading(
                    tr("Investimenti"),
                    model.state.visibleTabs.map { tab ->
                        SectionViewItem(tab.name, tr(tab.title), tr(tab.subtitle), BBIcon.forKey(tab.iconKey), tab == model.state.tab) {
                            if (model.state.tab == InvestmentsTab.Taxes && tab != InvestmentsTab.Taxes) planning.confirmLeave { model.select(tab) } else model.select(tab)
                        }
                    },
                    Modifier.padding(top = BBSpacing.space4),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                        BBIconButton(BBIcon.Database, tr("Importazioni fatte"), color = BuddyBudgetTheme.colors.foreground) { shell.importManagementOpen = true }
                        BBButton(tr("Importa"), { shell.brokerImport.present() }, icon = BBIcon.Upload, variant = BBButtonVariant.Outline, size = BBButtonSize.IconTouch)
                        BBSunIconButton(tr("Registra operazione")) { model.openRegister() }
                    }
                }
                val brokers = model.anyView?.brokers
                if (brokers != null && InvestmentsRules.showsBrokerSelector(brokers)) BrokerSelector(model, brokers)
            }
            when (model.state.tab) {
                InvestmentsTab.Portfolio -> PortfolioTab(model)
                InvestmentsTab.Performance -> PerformanceTab(model)
                InvestmentsTab.Diversification -> DiversificationTab(model)
                InvestmentsTab.Operations -> OperationsTab(model)
                InvestmentsTab.Income -> IncomeTab(model)
                InvestmentsTab.Taxes -> TaxesTab(model)
            }
        }
    }
    val form = model.registerForm
    FormDialog(form != null && model.registerHost.isEmpty(), { model.registerForm = null; model.editing = null }) {
        if (form != null) RegisterOperationView(model, form)
    }
    BBSheet(planning.pendingLeave != null, { planning.pendingLeave = null }, tr("Unsaved changes")) {
        UnsavedPlanSheetContent(planning)
    }
    BBAlertSheet(planning.reloadPrompt, tr("Reload"), tr("Reload the plan? Your unsaved changes will be lost."), tr("Reload"),
        onConfirm = { planning.reloadPrompt = false; planning.launch { planning.reload() } }, onDismiss = { planning.reloadPrompt = false },
        confirmVariant = BBButtonVariant.Default)
    val broker = shell.brokerImport
    FormDialog(broker.isOpen, { broker.close() }) {
        io.buddybudget.app.features.imports.BrokerImportView(
            broker, model.anyView?.currency ?: model.env.session.currency, model.anyView?.instruments.orEmpty(),
            onOpenImports = { id -> broker.close(); shell.open(id?.let { "/importazioni?job=$it" } ?: "/importazioni") },
            onManage = { broker.close(); shell.importManagementOpen = true },
            onNavigate = { path -> broker.close(); shell.open(path) },
        )
    }
    FormDialog(shell.importManagementOpen, { shell.importManagementOpen = false }) {
        io.buddybudget.app.features.imports.ImportManagementView(shell.importManagement) { id ->
            shell.importManagementOpen = false
            shell.open("/importazioni?job=$id")
        }
    }
    val priced = model.manualPriceFor
    FormDialog(priced != null, { model.manualPriceFor = null }) {
        if (priced != null) ManualPriceView(model, priced)
    }
}
