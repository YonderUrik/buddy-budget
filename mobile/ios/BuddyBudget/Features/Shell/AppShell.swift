import BuddyBudgetKit
import SwiftUI
import UIKit

/// The signed-in app (SHELL-012…027): one navigation stack per tab, kept alive while switching, and the custom
/// `BottomNav`. Screens come from `FeatureRegistry`.
struct AppShell: View {
    @Environment(AppEnvironment.self) private var env
    @State private var shell: ShellModel?

    var body: some View {
        Group {
            if let shell {
                ShellContent(shell: shell)
                    .environment(shell)
            } else {
                Color.bbBackground.ignoresSafeArea()
            }
        }
        .task {
            if shell == nil {
                let model = ShellModel(env: env)
                model.start()
                shell = model
            }
        }
    }
}

private struct ShellContent: View {
    @Bindable var shell: ShellModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(AppEnvironment.self) private var env
    @Environment(\.bbLocale) private var locale

    var body: some View {
        VStack(spacing: 0) {
            DemoBanner()
            ZStack {
                ForEach(shell.tabs, id: \.self) { tab in
                    TabStack(shell: shell, tab: tab)
                        .opacity(tab == shell.tab ? 1 : 0)
                        .allowsHitTesting(tab == shell.tab)
                        .accessibilityHidden(tab != shell.tab)
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: shell.tab)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                // IMP-058: the import island on every screen, above the bottom bar (content scrolls above it).
                ImportIsland(model: shell.imports) { id in shell.open(path: "/importazioni?job=\(id)") }
            }
            // The floating capsule: content scrolls under it (web `BOTTOM_NAV_HEIGHT_REM` leaves room at the end).
            .safeAreaInset(edge: .bottom, spacing: 0) {
                BottomNav(tabs: shell.tabs, selected: shell.tab) { shell.select($0) }
            }
        }
        .background(Color.bbBackground.ignoresSafeArea())
        // 16-help-support: report links, the «Segnala» toast action and «Scrivici» open one sheet.
        .environment(\.quickReport, env.quickReport)
        .quickReportHost(env.quickReport)
        .onChange(of: scenePhase) { _, phase in shell.setForeground(phase == .active) }
        // TX-064: the movement detail, from any list; changes reload the screens behind when it closes.
        .movementDetailHost(request: $shell.movementDetail,
                            openSettings: {
                                shell.movementDetail = nil
                                shell.open(path: "/impostazioni?sezione=notifiche")
                            },
                            onChanged: { shell.dataChanged() })
        .onChange(of: env.incoming) { _, incoming in
            guard let incoming else { return }
            env.incoming = nil
            shell.receive(incoming, locale: locale)
        }
        .onAppear {
            if let incoming = env.incoming {
                env.incoming = nil
                shell.receive(incoming, locale: locale)
            }
        }
    }
}

private struct TabStack: View {
    @Bindable var shell: ShellModel
    let tab: AppTab
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        NavigationStack(path: Binding(get: { shell.path(tab) }, set: { shell.setPath($0, for: tab) })) {
            root
                .environment(\.openScrivici, { env.quickReport.open(source: .pulsante) })
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: ShellRoute.self) { route in
                    FeatureRegistry.screen(for: route)
                        .environment(\.shellBack, { shell.back() })
                        .toolbar(.hidden, for: .navigationBar)
                }
        }
    }

    @ViewBuilder private var root: some View {
        if let destination = tab.root {
            FeatureRegistry.screen(for: .destination(destination))
        } else {
            MoreMenuScreen()
        }
    }
}

// MARK: - Back action for pushed screens

private struct ShellBackKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: (() -> Void)? = nil
}

extension EnvironmentValues {
    /// Set for screens pushed on a tab stack (nil for tab roots): pass it to `BBScreen(onBack:)`.
    var shellBack: (() -> Void)? {
        get { self[ShellBackKey.self] }
        set { self[ShellBackKey.self] = newValue }
    }
}

/// Keeps the swipe-back gesture with the system navigation bar hidden (screens draw their own top bar).
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        viewControllers.count > 1
    }
}

// MARK: - BottomNav

/// Bottom tab bar (components.md §3.12, SHELL-013…016; web decision 2026-10-17-barra-in-basso-a-capsula): a floating
/// capsule inset 12 pt from the sides and from the bottom (+ safe area), translucent `--sidebar` with blur, 1 pt
/// `--sidebar-border`, shadow-lg (a floating layer). Icons 24, labels 11 medium; one light grey pill
/// (`--sidebar-accent`) slides to the active tab, whose icon and label turn `--sidebar-primary` (no badge, web #451).
struct BottomNav: View {
    let tabs: [AppTab]
    let selected: AppTab
    let onSelect: (AppTab) -> Void

    @Namespace private var pill
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.self) { tab in
                let active = tab == selected
                let tint = active ? Color.bbSidebarPrimary : Color.bbSidebarForeground.opacity(0.6)
                Button {
                    withAnimation(.bbMotion(.bb(BBMotion.springSnappy), reduceMotion: reduceMotion)) { onSelect(tab) }
                } label: {
                    VStack(spacing: 2) {
                        BBIconView(BBIcon.forKey(tab.iconKey) ?? .ellipsis, size: .xl, color: tint)
                            .frame(width: 40, height: 28)
                        BBText(L10n.lookup(italian: tab.title), style: BBTypography.micro.with(lineHeight: 12).tracking(-0.025),
                               color: tint, lineLimit: 1)
                            .padding(.horizontal, 2)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background {
                        if active {
                            Capsule().fill(Color.bbSidebarAccent)
                                .padding(.vertical, BBSpacing.space1)
                                .matchedGeometryEffect(id: "pill", in: pill)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? [.isSelected, .isButton] : .isButton)
            }
        }
        .padding(.horizontal, BBSpacing.space1)
        .frame(height: BBLayout.bottomNavHeight)
        .background(Capsule().fill(.ultraThinMaterial))
        .background(Capsule().fill(Color.bbSidebarBackground.opacity(0.9)))
        .overlay(Capsule().strokeBorder(Color.bbSidebarBorder, lineWidth: 1))
        .bbShadow(BBShadow.lg)
        .padding(.horizontal, BBLayout.bottomNavInset)
        .padding(.bottom, BBLayout.bottomNavInset)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L10n.mainNavigation)
    }
}
