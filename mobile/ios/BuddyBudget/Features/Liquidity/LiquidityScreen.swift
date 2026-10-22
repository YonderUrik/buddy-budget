import BuddyBudgetKit
import SwiftUI

/// Liquidità section frame (TX-001): one root screen whose views are segments. Each view is its own screen
/// (`BBScreen` titled «Liquidità») and puts `LiquiditySegmentBar()` first in its content, so it keeps its own
/// refresh, actions and sheets. Twin of `LiquidityScreen` on Android.
struct LiquidityScreen: View {
    @Environment(ShellModel.self) private var shell

    var body: some View {
        @Bindable var shell = shell
        Group {
            switch shell.liquiditySegment {
            case .movements: MovementsScreen()
            case .analysis: AnalysisScreen()
            case .accounts: AccountsScreen()
            case .subscriptions: SubscriptionsScreen()
            }
        }
        .environment(\.liquiditySegment, $shell.liquiditySegment)
    }
}

/// Liquidità heading (web `LiquidityHeader` on the phone, #405/#427): the current view as the title, opening the views
/// sheet (the four views plus «Categorie e regole»), and the yellow «Aggiungi» button with the add menu. Renders nothing
/// outside the Liquidità frame.
struct LiquiditySegmentBar: View {
    @Environment(\.liquiditySegment) private var segment
    @Environment(ShellModel.self) private var shell

    var body: some View {
        if let segment {
            let items = LiquiditySegment.allCases.map { view in
                SectionViewItem(id: view.rawValue, label: L10n.lookup(italian: view.title),
                                description: L10n.lookup(italian: view.viewDescription), icon: BBIcon.forKey(view.iconKey),
                                isActive: view == segment.wrappedValue) { segment.wrappedValue = view }
            } + [SectionViewItem(id: "categorie", label: L10n.categoriesAndRules,
                                 description: L10n.lookup(italian: "Gruppi di spesa e regole automatiche"), icon: .tags) {
                shell.push(.destination(.categories))
            }]
            SectionViewsHeading(sectionTitle: L10n.cash_84f6d5, items: items) {
                LiquidityTopActions(model: shell.liquidity)
            }
            .padding(.top, BBSpacing.space4)
            .padding(.bottom, BBSpacing.space4)
        }
    }
}

/// TX-022 (web #444): before the first account, Movimenti, Analisi and Abbonamenti say what they will show, with
/// «Aggiungi un conto» (new-account sheet in Conti) and «Importa un file» (Importazioni).
struct LiquidityNoAccountsState: View {
    let segment: LiquiditySegment
    @Environment(ShellModel.self) private var shell

    var body: some View {
        if let content = LiquidityNoAccounts.content(segment) {
            EmptyState(icon: BBIcon.forKey(content.iconKey) ?? .landmark, title: L10n.lookup(italian: content.title),
                       description: L10n.lookup(italian: content.description),
                       primary: BBStateAction(label: L10n.lookup(italian: "Aggiungi un conto")) { shell.open(path: "/liquidita/conti?nuovo=1") },
                       secondary: BBStateAction(label: L10n.lookup(italian: "Importa un file")) { shell.open(.imports) })
        }
    }
}

private struct LiquiditySegmentKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: Binding<LiquiditySegment>? = nil
}

extension EnvironmentValues {
    var liquiditySegment: Binding<LiquiditySegment>? {
        get { self[LiquiditySegmentKey.self] }
        set { self[LiquiditySegmentKey.self] = newValue }
    }
}
