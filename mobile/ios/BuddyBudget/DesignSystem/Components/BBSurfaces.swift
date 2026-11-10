import SwiftUI

// Surfaces & layout (spec: design/components.md §1.3, §1.9, §3.5, §3.12). Android: BBSurfaces.kt.

// MARK: - BBScreen

private struct LargeTitleBottomKey: PreferenceKey {
    static let defaultValue: CGFloat = .greatestFiniteMagnitude
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// Screen scaffold: `--background` edge to edge, a custom 56 pt top bar (no `NavigationStack` large titles, which
/// would diverge from Android — components.md §3.12), a large title in the display face that scrolls with the
/// content, optional pull-to-refresh, safe areas respected. Tab roots (no back action) show the web's phone top bar:
/// `--sidebar` surface with a bottom border, the brand centred and «Scrivici» on the right; pushed screens show back
/// and the title collapsing into the bar. Content gets the 16 pt phone gutter
/// (full-bleed children such as charts use a negative horizontal padding of 16). Same parameters as `BBScreen` on Android.
struct BBScreen<Content: View, Actions: View>: View {
    let title: String?
    var eyebrow: String?
    var onBack: (() -> Void)?
    var onRefresh: (@MainActor @Sendable () async -> Void)?
    var scrollable: Bool
    /// Style of the large title (the Panoramica greeting is larger, 44 pt).
    var titleStyle: BBTextStyle = .screenTitle
    let actions: Actions
    let content: Content

    @State private var collapsed = false
    /// SHELL-023: «Scrivici» on the tab roots (set by the shell only there).
    @Environment(\.openScrivici) private var openScrivici

    init(title: String?, eyebrow: String? = nil, onBack: (() -> Void)? = nil,
         onRefresh: (@MainActor @Sendable () async -> Void)? = nil, scrollable: Bool = true,
         titleStyle: BBTextStyle = .screenTitle,
         @ViewBuilder actions: () -> Actions, @ViewBuilder content: () -> Content) {
        self.titleStyle = titleStyle
        self.title = title
        self.eyebrow = eyebrow
        self.onBack = onBack
        self.onRefresh = onRefresh
        self.scrollable = scrollable
        self.actions = actions()
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            if scrollable {
                scrollBody
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    largeTitle
                    content.padding(.horizontal, BBSpacing.space4)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .background(Color.bbBackground.ignoresSafeArea())
    }

    @ViewBuilder private var scrollBody: some View {
        let scroll = ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                largeTitle
                    .background(GeometryReader { proxy in
                        Color.clear.preference(key: LargeTitleBottomKey.self,
                                               value: proxy.frame(in: .named("bbScreen")).maxY)
                    })
                content.padding(.horizontal, BBSpacing.space4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, BBSpacing.space6)
        }
        .coordinateSpace(name: "bbScreen")
        .scrollIndicators(.hidden)
        .bbDebugScroll()
        .onPreferenceChange(LargeTitleBottomKey.self) { bottom in
            let next = title != nil && bottom < 0
            if next != collapsed { withAnimation(.linear(duration: BBMotion.durationFast)) { collapsed = next } }
        }
        if let onRefresh {
            scroll.refreshable { await onRefresh() }
        } else {
            scroll
        }
    }

    @ViewBuilder private var largeTitle: some View {
        if let title {
            // #427: no small section name above the title on the phone (`eyebrow` is kept for VoiceOver only).
            HStack(alignment: .center, spacing: BBSpacing.space1) {
                BBText(title, style: titleStyle)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityLabel(eyebrow.map { "\($0), \(title)" } ?? title)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if isRoot { actions }
            }
            .padding(.leading, BBSpacing.space4)
            .padding(.trailing, isRoot ? BBSpacing.space2 : BBSpacing.space4)
            .padding(.top, BBSpacing.space6)
            .padding(.bottom, BBSpacing.space4)
        }
    }

    /// Tab root: brand bar like the web's `MobileTopbar`.
    private var isRoot: Bool { onBack == nil }

    private var topBar: some View {
        ZStack {
            if isRoot {
                HStack(spacing: BBSpacing.space2) {
                    BBLogoMark(height: 24)
                    BBText(L10n.appName, style: .brandName, color: .bbSidebarForeground)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            } else if let title {
                BBText(title, style: .topBarTitle, lineLimit: 1)
                    .padding(.horizontal, 56)
                    .opacity(collapsed ? 1 : 0)
                    .accessibilityHidden(!collapsed)
            }
            HStack(spacing: 0) {
                if let onBack {
                    Button(action: onBack) {
                        BBIconView(.chevronLeft, size: .xl, color: .bbForeground)
                            .frame(width: BBLayout.minTouchTarget, height: BBLayout.minTouchTarget)
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(Circle())))
                    .accessibilityLabel(L10n.back)
                }
                Spacer(minLength: 0)
                HStack(spacing: BBSpacing.space1) {
                    // Tab roots carry their actions next to the large title (web: page actions beside the title).
                    if !isRoot || title == nil { actions }
                    if onBack == nil, let openScrivici {
                        BBIconButton(icon: .messageCircleQuestionMark,
                                     accessibilityLabel: L10n.lookup(italian: "Scrivici: segnala un problema, una domanda o un'idea"),
                                     action: openScrivici)
                    }
                }
            }
            .padding(.horizontal, BBSpacing.space2)
        }
        .frame(height: BBLayout.topBarHeight)
        .frame(maxWidth: .infinity)
        .background((isRoot ? Color.bbSidebarBackground : Color.bbBackground).ignoresSafeArea(edges: .top))
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.bbSidebarBorder).frame(height: 1).opacity(isRoot || collapsed ? 1 : 0)
        }
    }
}

extension BBScreen where Actions == EmptyView {
    init(title: String?, eyebrow: String? = nil, onBack: (() -> Void)? = nil,
         onRefresh: (@MainActor @Sendable () async -> Void)? = nil, scrollable: Bool = true,
         titleStyle: BBTextStyle = .screenTitle, @ViewBuilder content: () -> Content) {
        self.init(title: title, eyebrow: eyebrow, onBack: onBack, onRefresh: onRefresh, scrollable: scrollable,
                  titleStyle: titleStyle, actions: { EmptyView() }, content: content)
    }
}

/// 44 pt round icon button for top bars and rows (`size="icon"` with a touch-size target).
struct BBIconButton: View {
    let icon: BBIcon
    let accessibilityLabel: String
    var color: Color = .bbText2
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BBIconView(icon, size: .lg, color: color)
                .frame(width: BBLayout.minTouchTarget, height: BBLayout.minTouchTarget)
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - BBCard

enum BBCardSize: Sendable { case `default`, sm }

/// Filled `--card` surface, radius xl, no ring and no shadow (#417); padding and gap = 16 (sm 12).
struct BBCard<Content: View>: View {
    var size: BBCardSize = .default
    let content: Content

    init(size: BBCardSize = .default, @ViewBuilder content: () -> Content) {
        self.size = size
        self.content = content()
    }

    var body: some View {
        let pad = size == .sm ? BBLayout.cardPaddingSm : BBLayout.cardPadding
        VStack(alignment: .leading, spacing: pad) { content }
            .padding(pad)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbCard))
    }
}

/// Card header: title (font-heading text-base medium), optional description and trailing action.
struct BBCardHeader<Action: View>: View {
    let title: String
    var description: String?
    var size: BBCardSize = .default
    let action: Action

    init(title: String, description: String? = nil, size: BBCardSize = .default, @ViewBuilder action: () -> Action) {
        self.title = title
        self.description = description
        self.size = size
        self.action = action()
    }

    var body: some View {
        HStack(alignment: .top, spacing: BBSpacing.space2) {
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                BBText(title, style: size == .sm ? BBTypography.cardTitle.with(size: 14, lineHeight: 20) : BBTypography.cardTitle)
                if let description {
                    BBText(description, style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            Spacer(minLength: 0)
            action
        }
    }
}

extension BBCardHeader where Action == EmptyView {
    init(title: String, description: String? = nil, size: BBCardSize = .default) {
        self.init(title: title, description: description, size: size) { EmptyView() }
    }
}

// MARK: - BBSection

/// Open section (`SECTION_TITLE`): the title in the display face with no icon (#427), an optional link-style action
/// on the right, then the content 16 pt below. `icon`/`color` are accepted for call-site compatibility and not drawn.
struct BBSection<Content: View>: View {
    let title: String
    var icon: BBIcon?
    var color: Color = .bbPrimary
    var actionLabel: String?
    var onAction: (() -> Void)?
    let content: Content

    init(title: String, icon: BBIcon? = nil, color: Color = .bbPrimary, actionLabel: String? = nil,
         onAction: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.color = color
        self.actionLabel = actionLabel
        self.onAction = onAction
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            HStack(alignment: .lastTextBaseline, spacing: BBSpacing.space3) {
                BBText(title, style: .sectionHeading)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                if let actionLabel, let onAction {
                    Button(action: onAction) {
                        HStack(spacing: BBSpacing.space1) {
                            BBText(actionLabel, style: .link, color: .bbPrimary)
                            BBIconView(.arrowRight, size: .md, color: .bbPrimary)
                        }
                        .padding(.horizontal, BBSpacing.space2)
                        .frame(minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                    .padding(.trailing, -BBSpacing.space2)
                }
            }
            content
        }
    }
}

// MARK: - BBSeparator

/// 1 pt `--border` line (horizontal by default).
struct BBSeparator: View {
    var vertical = false

    var body: some View {
        Rectangle()
            .fill(Color.bbBorder)
            .frame(width: vertical ? 1 : nil, height: vertical ? nil : 1)
            .frame(maxWidth: vertical ? nil : .infinity, maxHeight: vertical ? .infinity : nil)
            .accessibilityHidden(true)
    }
}

// MARK: - SectionViewsHeading

/// One view of a section with several views (Liquidità: Movimenti, Analisi, …) in the views sheet.
struct SectionViewItem: Identifiable {
    let id: String
    let label: String
    var description: String?
    var icon: BBIcon?
    var isActive = false
    let action: () -> Void
}

/// Phone heading of a section with several views (web `SectionHeading` below `lg`, #427): the current view as the
/// title in the display face with a round chevron, opening a sheet with every view and its description; an optional
/// trailing action (the section's yellow main button). No tabs and no section name above the title.
struct SectionViewsHeading<Trailing: View>: View {
    let sectionTitle: String
    let items: [SectionViewItem]
    let trailing: Trailing

    @State private var open = false

    init(sectionTitle: String, items: [SectionViewItem], @ViewBuilder trailing: () -> Trailing) {
        self.sectionTitle = sectionTitle
        self.items = items
        self.trailing = trailing()
    }

    var body: some View {
        let active = items.first(where: \.isActive) ?? items.first
        HStack(alignment: .center, spacing: BBSpacing.space3) {
            if let active {
                Button { open = true } label: {
                    HStack(spacing: BBSpacing.space1_5) {
                        BBText(active.label, style: active.label.count > 12 ? .viewTitleLong : .sectionHeading, lineLimit: 1)
                        BBIconView(.chevronDown, size: .md, color: .bbText2)
                            .frame(width: 28, height: 28)
                            .background(Circle().fill(Color.bbMuted))
                    }
                    .frame(minHeight: BBLayout.minTouchTarget)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(.isHeader)
                .accessibilityLabel(L10n.lookup(italian: "{0}: cambia vista di {1}", ["0": active.label, "1": sectionTitle]))
            }
            Spacer(minLength: 0)
            trailing
        }
        .bbSheet(isPresented: $open, title: nil) {
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                BBText(sectionTitle, style: .titleSmall).padding(.horizontal, BBSpacing.space1).accessibilityAddTraits(.isHeader)
                VStack(spacing: BBSpacing.space1) {
                    ForEach(items) { item in
                        Button {
                            open = false
                            if !item.isActive {
                                DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit) { item.action() }
                            }
                        } label: {
                            HStack(spacing: BBSpacing.space3_5) {
                                if let icon = item.icon {
                                    BBIconView(icon, size: .lg, color: item.isActive ? .bbPrimary : .bbText2)
                                }
                                VStack(alignment: .leading, spacing: 0) {
                                    BBText(item.label, style: BBTypography.bodyLarge.with(weight: 500))
                                    if let description = item.description {
                                        BBText(description, style: BBTypography.body, color: .bbText2)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                if item.isActive { BBIconView(.check, size: .md, color: .bbPrimary) }
                            }
                            .padding(.horizontal, BBSpacing.space3)
                            .padding(.vertical, BBSpacing.space2)
                            .frame(minHeight: 56)
                            .background(RoundedRectangle.bb(BBRadius.xl).fill(item.isActive ? Color.bbMuted : .clear))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(BBPressableStyle(pressedBackground: .bbAlphaMuted60, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
                        .accessibilityAddTraits(item.isActive ? .isSelected : [])
                    }
                }
            }
        }
    }
}

/// The page's main action as a yellow circle (web `Button variant="sun"` `size-11` with a plus on the phone).
struct BBSunIconButton: View {
    var icon: BBIcon = .plus
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BBIconView(icon, size: .md, color: .bbOnSun)
                .frame(width: BBLayout.minTouchTarget, height: BBLayout.minTouchTarget)
        }
        .buttonStyle(BBPressableStyle(background: .bbSun, pressedBackground: .bbSunHover, shape: AnyShape(Circle())))
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - SimulationResult

enum SimulationResultTone: Sendable { case neutral, pos, neg }

/// The answer of a simulator (#411): a short label, the result as one big figure (Hanken, never the condensed face)
/// and one line of context. Every «what if» reads the same way.
struct SimulationResult: View {
    let label: String
    let value: String
    var tone: SimulationResultTone = .neutral
    var caption: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1) {
            BBText(label, style: BBTypography.body, color: .bbText2)
            BBText(value, style: BBTypography.display, color: tone == .pos ? .bbPos : (tone == .neg ? .bbNeg : .bbForeground))
            if let caption {
                BBText(caption, style: BBTypography.body, color: .bbText2).padding(.top, BBSpacing.space1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Debug scroll (screenshots)

extension View {
    /// DEBUG-only `-BBScrollY <pt>`: scrolls the screen down after loading, so screenshots reach lower content.
    @ViewBuilder func bbDebugScroll() -> some View {
        #if DEBUG
        if #available(iOS 18.0, *), let y = DebugLaunch.value("-BBScrollY").flatMap(Double.init) {
            modifier(DebugScrollY(y: y))
        } else {
            self
        }
        #else
        self
        #endif
    }
}

#if DEBUG
@available(iOS 18.0, *)
private struct DebugScrollY: ViewModifier {
    let y: Double
    @State private var position = ScrollPosition(edge: .top)

    func body(content: Content) -> some View {
        content
            .scrollPosition($position)
            .task {
                try? await Task.sleep(for: .seconds(7))
                position.scrollTo(y: y)
            }
    }
}
#endif
