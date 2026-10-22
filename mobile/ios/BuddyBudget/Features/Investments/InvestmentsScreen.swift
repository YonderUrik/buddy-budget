import BuddyBudgetKit
import SwiftUI

/// Investimenti section frame (07-investments): title, `Registra` action, the six tabs as a scrollable segmented bar
/// (INV-002, country-gated INV-003), the broker chip (INV-008) and the active tab, with «Importazioni fatte» and
/// «Importa» (INV-001, INV-092…110). Twin of `InvestmentsScreen` on Android.
struct InvestmentsScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.investments
        let planning = model.planning
        // DE Tasse / Dividendi are the German plan (13-planning-de): bottom save bar and the unsaved-changes sheet.
        let german = model.countryContent == .germanPlan && (model.state.tab == .taxes || model.state.tab == .income)
        BBScreen(title: nil, onBack: back.map { back in { planning.confirmLeave(back) } },
                 onRefresh: { await model.reloadAll() }) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                VStack(alignment: .leading, spacing: BBSpacing.space3) {
                    // #427: on the phone the current tab is the title («Portafoglio ⌄») and opens the views sheet.
                    SectionViewsHeading(sectionTitle: L10n.lookup(italian: "Investimenti"), items: model.state.visibleTabs.map { tab in
                        SectionViewItem(id: tab.rawValue, label: L10n.lookup(italian: tab.title),
                                        description: L10n.lookup(italian: tab.subtitle), icon: BBIcon.forKey(tab.iconKey),
                                        isActive: tab == model.state.tab) {
                            if model.state.tab == .taxes, tab != .taxes { planning.confirmLeave { model.select(tab) } } else { model.select(tab) }
                        }
                    }) {
                        HStack(spacing: BBSpacing.space2) {
                            BBIconButton(icon: .database, accessibilityLabel: L10n.lookup(italian: "Importazioni fatte"), color: .bbForeground) {
                                shell.importManagementOpen = true
                            }
                            BBButton(L10n.lookup(italian: "Importa"), icon: .upload, variant: .outline, size: .iconTouch) { shell.brokerImport.present() }
                            BBSunIconButton(accessibilityLabel: L10n.lookup(italian: "Registra operazione")) { model.openRegister() }
                        }
                    }
                    .padding(.top, BBSpacing.space4)
                    if let brokers = model.anyView?.brokers, InvestmentsRules.showsBrokerSelector(brokers) {
                        BrokerSelector(model: model, brokers: brokers)
                    }
                }
                switch model.state.tab {
                case .portfolio: PortfolioTab(model: model)
                case .performance: PerformanceTab(model: model)
                case .diversification: DiversificationTab(model: model)
                case .operations: OperationsTab(model: model)
                case .income: IncomeTab(model: model)
                case .taxes: TaxesTab(model: model)
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if german { GermanPlanSaveBar(model: planning) }
        }
        .bbSheet(isPresented: Binding(get: { planning.pendingLeave != nil }, set: { if !$0 { planning.pendingLeave = nil } }),
                 title: planningText("Unsaved changes")) {
            UnsavedPlanSheet(model: planning)
        }
        .bbAlertSheet(isPresented: Binding(get: { planning.reloadPrompt }, set: { planning.reloadPrompt = $0 }),
                      title: planningText("Reload"), description: planningText("Reload the plan? Your unsaved changes will be lost."),
                      confirmLabel: planningText("Reload"), confirmVariant: .default) {
            Task { await planning.reload() }
        }
        .task { await model.start() }
        .onChange(of: shell.dataVersion) { _, _ in Task { await model.reloadAll() } }
        .formDialog(isPresented: Binding(get: { model.registerForm != nil && model.registerHost.isEmpty }, set: { if !$0 { model.registerForm = nil; model.editing = nil } })) {
            if let form = model.registerForm {
                RegisterOperationView(model: model, initial: form)
            }
        }
        .formDialog(isPresented: Binding(get: { shell.brokerImport.isOpen }, set: { shell.brokerImport.isOpen = $0 })) {
            BrokerImportView(model: shell.brokerImport, currency: model.anyView?.currency ?? model.env.session.currency,
                             suggestions: model.anyView?.instruments ?? [],
                             onOpenImports: { id in
                                 shell.brokerImport.close()
                                 shell.open(path: id.map { "/importazioni?job=\($0)" } ?? "/importazioni")
                             },
                             onManage: {
                                 shell.brokerImport.close()
                                 DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationBase + 0.05) { shell.importManagementOpen = true }
                             },
                             onNavigate: { path in
                                 shell.brokerImport.close()
                                 shell.open(path: path)
                             })
        }
        .formDialog(isPresented: Binding(get: { shell.importManagementOpen }, set: { shell.importManagementOpen = $0 })) {
            ImportManagementView(model: shell.importManagement) { id in
                shell.importManagementOpen = false
                shell.open(path: "/importazioni?job=\(id)")
            }
        }
        .formDialog(isPresented: Binding(get: { model.manualPriceFor != nil }, set: { if !$0 { model.manualPriceFor = nil } })) {
            if let instrument = model.manualPriceFor {
                ManualPriceView(model: model, instrument: instrument)
            }
        }
    }
}

/// The unsaved-changes sheet of the German plan (mobile adaptation, 13-planning-de): save, discard or stay.
private struct UnsavedPlanSheet: View {
    let model: GermanPlanningModel

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(planningText("Save your changes to the plan before leaving?"), style: BBTypography.body, color: .bbMutedForeground)
            VStack(spacing: BBSpacing.space2) {
                BBButton(planningText("Save plan"), size: .touch, fullWidth: true, isLoading: model.editor?.saving ?? false,
                         isDisabled: !(model.editor?.canSave ?? false)) {
                    Task { await model.resolveLeave(save: true) }
                }
                BBButton(planningText("Discard changes"), variant: .outline, size: .touch, fullWidth: true) {
                    Task { await model.resolveLeave(save: false) }
                }
                BBButton(L10n.cancel, variant: .ghost, size: .touch, fullWidth: true) { model.pendingLeave = nil }
            }
        }
    }
}
