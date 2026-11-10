import BuddyBudgetKit
import SwiftUI

/// Movement row (TX-023…027): avatar (merchant logo or category) that changes the category, description,
/// «categoria · origine · conto · diviso», signed effective amount; split rows add the full amount struck through,
/// transfers show the full amount neutral with «Escluso dai conteggi»; uncategorized rows are highlighted.
/// Tapping the row opens its detail (TX-064, web #455); a long press or the accessibility action opens its actions.
/// Android: MovementRow.kt.
struct MovementRow: View {
    let model: LiquidityModel
    let movement: Movement
    var showAccount = true
    let onTap: () -> Void
    let onCategory: () -> Void
    var onActions: (() -> Void)?

    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts
    /// The merchant logo arrived (the category moves to a corner badge).
    @State private var logoShown = false

    var body: some View {
        let category = model.category(movement.categoryId)
        let kind = MovementKind.of(movement, category: category)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: BBSpacing.space3_5) {
                avatar(category)
                VStack(alignment: .leading, spacing: 0) {
                    BBText(movement.description, style: .rowTitle, lineLimit: 1)
                    subtitle(category, kind: kind)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                trailing(kind)
            }
            .padding(.horizontal, BBSpacing.space1_5)
            .padding(.vertical, BBSpacing.space2_5)
            .frame(minHeight: 60)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(kind == .uncategorized ? Color.bbAlphaDestructive10 : Color.clear))
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)
            .onLongPressGesture { (onActions ?? onTap)() }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction(named: L10n.moreActionsFor0(movement.description), onActions ?? onTap)
            if model.savingIds.contains(movement.id) {
                BBText(L10n.saving_f71782, style: BBTypography.caption, color: .bbText3).padding(.leading, 56).padding(.bottom, 4)
            } else if model.failedIds.contains(movement.id) {
                BBText(L10n.saveFailedTryAgain, style: BBTypography.caption, color: .bbDestructive).padding(.leading, 56).padding(.bottom, 4)
            }
        }
    }

    private func avatar(_ category: MovementCategory?) -> some View {
        Button(action: onCategory) {
            ZStack(alignment: .bottomTrailing) {
                if let logoPath = movement.logoPath {
                    // Web: the category avatar until (unless) the merchant logo arrives, then the category as a corner badge.
                    MerchantLogo(name: movement.description, logoPath: logoPath, size: .sm, onRemoteLogo: {
                        model.remoteLogoShown = true
                        logoShown = true
                    }, fallbackView: AnyView(CategoryAvatar(category: category)))
                    if logoShown {
                        CategoryAvatar(category: category, diameter: 16)
                            .overlay(Circle().stroke(Color.bbBackground, lineWidth: 1.5))
                            .offset(x: 3, y: 3)
                    }
                } else {
                    CategoryAvatar(category: category)
                }
            }
            .frame(width: 36, height: 36)
            .bbHitArea(height: 36, width: 36)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.category0TapToChangeIt(category?.name ?? L10n.uncategorized))
    }

    private func subtitle(_ category: MovementCategory?, kind: MovementKind) -> some View {
        HStack(spacing: BBSpacing.space1) {
            BBText(category?.name ?? L10n.uncategorized, style: BBTypography.body,
                   color: kind == .uncategorized ? .bbNeg : .bbText2, lineLimit: 1)
                .layoutPriority(1)
            if kind != .uncategorized, let origin = AutoOrigin.of(movement.categorySource) {
                AutoOriginBadge(source: origin, compact: true)
            }
            if showAccount, let account = model.account(movement.accountId) {
                BBText("· \(account.name)", style: BBTypography.body, color: .bbText2, lineLimit: 1)
            }
            if kind == .split {
                BBText(L10n.split_79d3ff, style: BBTypography.body, color: .bbText2, lineLimit: 1)
            }
        }
    }

    @ViewBuilder private func trailing(_ kind: MovementKind) -> some View {
        VStack(alignment: .trailing, spacing: 0) {
            switch kind {
            case .transfer:
                AmountText(value: movement.amount, currency: model.currency, tone: .neutral, signed: true, style: .rowAmount)
                BBText(L10n.excludedFromTotals_7570b0, style: BBTypography.caption, color: .bbText3, lineLimit: 1)
            case .split:
                AmountText(value: movement.effectiveAmount, currency: model.currency, tone: .signed, signed: true, style: .rowAmount)
                Text(verbatim: BBFormat.formatSignedCurrency(movement.amount, currency: model.currency, locale: locale, masked: hideAmounts))
                    .strikethrough()
                    .bbTextStyle(BBTypography.caption)
                    .foregroundStyle(Color.bbText3)
                    .accessibilityLabel(L10n.fullAmount)
            default:
                AmountText(value: movement.effectiveAmount, currency: model.currency, tone: .signed, signed: true, style: .rowAmount)
            }
        }
    }
}
