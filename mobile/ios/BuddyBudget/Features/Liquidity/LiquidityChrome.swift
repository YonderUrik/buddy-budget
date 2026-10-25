import BuddyBudgetKit
import SwiftUI

/// Liquidità's main action (TX-002): the yellow `Aggiungi` circle with the add menu and the add-transaction sheet
/// («Categorie e regole» moved to the views sheet, #427). Android: LiquidityChrome.kt.
struct LiquidityTopActions: View {
    let model: LiquidityModel
    @Environment(ShellModel.self) private var shell
    @Environment(\.liquiditySegment) private var segment
    @State private var addMenu = false
    @State private var addTransaction = false

    var body: some View {
        BBSunIconButton(accessibilityLabel: L10n.add) { addMenu = true }
        .bbSheet(isPresented: $addMenu, title: L10n.add) {
            VStack(spacing: 0) {
                SheetActionRow(icon: .receiptText, label: L10n.aTransaction) {
                    addMenu = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.05) { addTransaction = true }
                }
                SheetActionRow(icon: .landmark, label: L10n.anAccountOrBank) {
                    addMenu = false
                    shell.open(path: "/liquidita/conti?nuovo=1")
                }
                // TX-002: «Importa da CSV o Excel» → /importazioni.
                SheetActionRow(icon: .fileSpreadsheet, label: L10n.lookup(italian: "Importa da CSV o Excel")) {
                    addMenu = false
                    shell.open(.imports)
                }
            }
        }
        .bbSheet(isPresented: $addTransaction, title: L10n.newTransaction) {
            AddTransactionSheet(model: model, onClose: { addTransaction = false }, onAddAccount: {
                addTransaction = false
                segment?.wrappedValue = .accounts
            })
        }
        .onChange(of: model.addRequested) { _, requested in
            if requested {
                model.addRequested = false
                addTransaction = true
            }
        }
    }
}

/// One tappable action in a sheet: icon 20 + label, 48 pt high; destructive in `--destructive`.
struct SheetActionRow: View {
    let icon: BBIcon
    let label: String
    var destructive = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space3) {
                BBIconView(icon, size: .lg, color: destructive ? .bbDestructive : .bbText2)
                BBText(label, style: BBTypography.bodyLarge, color: destructive ? .bbDestructive : .bbForeground, lineLimit: 1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, BBSpacing.space1)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
    }
}
