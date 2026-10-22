import BuddyBudgetKit
import SwiftUI

/// Subscription row (SUB-014): logo or coloured initial, name, hint, amount and the old price / monthly equivalent;
/// optional quick actions underneath. Twin of `SubscriptionRow` on Android.
struct SubscriptionRow<Actions: View>: View {
    let item: SubscriptionItem
    let currency: String
    let today: String
    let text: SubscriptionText
    let onOpen: () -> Void
    let onRemoteLogo: () -> Void
    @ViewBuilder let actions: () -> Actions

    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onOpen) {
                HStack(spacing: BBSpacing.space3_5) {
                    MerchantLogo(name: item.name, logoPath: item.logoPath, size: .sm, onRemoteLogo: onRemoteLogo,
                                 initialColor: Color.bbSwatch(SubscriptionsView.avatarSwatch(item.key)))
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(item.name, style: .rowTitle, lineLimit: 1)
                        BBText(text.hint(item, today: today), style: BBTypography.body, color: .bbText2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    trailing
                }
                .padding(.horizontal, BBSpacing.space4)
                .padding(.vertical, BBSpacing.space3)
                .frame(minHeight: 64)
                .contentShape(Rectangle())
            }
            .buttonStyle(BBPressableStyle(pressedBackground: Color.bbForeground.opacity(0.04),
                                          shape: AnyShape(RoundedRectangle.bb(BBRadius.radius2xl)), translate: false))
            .accessibilityLabel(L10n.lookup(italian: "{0}: apri i dettagli", ["0": item.name]))

            if Actions.self != EmptyView.self {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: BBSpacing.space2) { actions() }
                    VStack(alignment: .leading, spacing: BBSpacing.space2) { actions() }
                }
                .padding(.leading, BBSpacing.space4)
                .padding(.trailing, BBSpacing.space4)
                .padding(.bottom, BBSpacing.space3)
            }
        }
        .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbForeground.opacity(0.04)))
    }

    @ViewBuilder private var trailing: some View {
        VStack(alignment: .trailing, spacing: 0) {
            if let amount = item.amount {
                AmountText(value: amount, currency: currency, style: .rowAmount)
            } else {
                BBText("—", style: .rowAmount)
            }
            if let rise = SubscriptionsView.rise(item) {
                HStack(spacing: BBSpacing.space1) {
                    BBIconView(.trendingUp, size: .sm, color: .bbNeg)
                    BBText(text.previousPrice(rise, currency: currency, masked: hideAmounts),
                           style: BBTypography.caption.with(weight: 600), color: .bbNeg, lineLimit: 1)
                }
            } else if SubscriptionsView.showsMonthlyEquivalent(item), let monthly = item.monthly {
                BBText(text.monthlySuffix(monthly, currency: currency, masked: hideAmounts), style: BBTypography.caption,
                       color: .bbText2, lineLimit: 1)
            }
        }
        .fixedSize()
    }
}
