import BuddyBudgetKit
import SwiftUI

/// Category avatar from a category's stored icon and color (CAT-008).
struct CategoryAvatar: View {
    let category: MovementCategory?
    var diameter: CGFloat = 36

    var body: some View {
        BBIconBadge(icon: BBIcon.category(category?.icon), color: .bbSwatch(category?.color ?? "slate"), diameter: diameter,
                    iconSize: diameter >= 36 ? 16 : 14)
    }
}

/// Color of a spending group (`GROUP_DISPLAY`).
extension Color {
    static func bbGroup(_ key: String) -> Color {
        switch key {
        case "dovuta": .bbCategoryGroupDovuta
        case "voluta": .bbCategoryGroupVoluta
        case "futuro": .bbCategoryGroupFuturo
        case "saltuaria": .bbCategoryGroupSaltuaria
        default: .bbCategoryGroupUncategorized
        }
    }
}

/// «Scegli la categoria» content (CAT-090…092, TX-028), shown inside a `BBSheet`: search (empty on every open, not
/// auto-focused), a most-used row, then a 4-column icon grid per group in alphabetical order. One tap picks.
/// Android: CategorySheetContent in CategorySheet.kt.
struct CategorySheetContent<Footer: View>: View {
    let categories: [MovementCategory]
    let usage: [String: Int]
    var selectedId: String?
    var description: String?
    var searchPlaceholder: String = L10n.searchCategories_236af4
    /// «Per te» (5, Categorizza) or «Più usate» (6, movement picker).
    var mostUsedLabel: String = L10n.forYou
    var mostUsedLimit: Int = CategoryPicker.mostUsedLimit
    let onPick: (MovementCategory) -> Void
    @ViewBuilder var footer: () -> Footer

    @State private var query = ""

    private let columns = Array(repeating: GridItem(.flexible(), spacing: BBSpacing.space2, alignment: .top), count: 4)

    var body: some View {
        let sections = CategoryPicker.sections(categories, usage: usage, query: query, mostUsedLimit: mostUsedLimit)
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            if let description {
                BBText(description, style: BBTypography.body, color: .bbMutedForeground, lineLimit: 2)
            }
            BBTextField(text: $query, placeholder: searchPlaceholder, height: 44, submitLabel: .search, onSubmit: {
                if let first = sections.first?.categories.first { onPick(first) }
            })
            if sections.isEmpty {
                BBText(L10n.noCategoriesFound, style: BBTypography.body, color: .bbMutedForeground)
                    .padding(.vertical, BBSpacing.space4)
            }
            ForEach(sections, id: \.key) { section in
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    if let label = section.label {
                        BBText(section.key == "most-used" ? mostUsedLabel : L10n.lookup(italian: label),
                               style: BBTypography.overline, color: .bbText3)
                    }
                    LazyVGrid(columns: columns, alignment: .leading, spacing: BBSpacing.space2) {
                        ForEach(section.categories) { category in
                            tile(category)
                        }
                    }
                }
            }
            footer()
        }
    }

    private func tile(_ category: MovementCategory) -> some View {
        let selected = category.id == selectedId
        return Button { onPick(category) } label: {
            VStack(spacing: BBSpacing.space1_5) {
                CategoryAvatar(category: category, diameter: 40)
                BBText(category.name, style: BBTypography.caption, color: .bbForeground, lineLimit: 2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(.vertical, BBSpacing.space2)
            .padding(.horizontal, BBSpacing.space1)
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .top)
            .background(RoundedRectangle.bb(BBRadius.lg).fill(selected ? Color.bbAlphaPrimary10 : Color.clear))
            .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(selected ? Color.bbPrimary : Color.clear, lineWidth: 1.5))
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

extension CategorySheetContent where Footer == EmptyView {
    init(categories: [MovementCategory], usage: [String: Int], selectedId: String? = nil, description: String? = nil,
         searchPlaceholder: String = L10n.searchCategories_236af4, mostUsedLabel: String = L10n.forYou,
         mostUsedLimit: Int = CategoryPicker.mostUsedLimit, onPick: @escaping (MovementCategory) -> Void) {
        self.init(categories: categories, usage: usage, selectedId: selectedId, description: description,
                  searchPlaceholder: searchPlaceholder, mostUsedLabel: mostUsedLabel, mostUsedLimit: mostUsedLimit,
                  onPick: onPick, footer: { EmptyView() })
    }
}

/// A switch row used as sheet footer («Ricordala…», «Usa sempre questa categoria…»).
struct BBSwitchRow: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            HStack(spacing: BBSpacing.space3) {
                BBText(label, style: BBTypography.body, lineLimit: 2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BBSwitch(isOn: $isOn, accessibilityLabel: label)
            }
            .frame(minHeight: BBLayout.minTouchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
