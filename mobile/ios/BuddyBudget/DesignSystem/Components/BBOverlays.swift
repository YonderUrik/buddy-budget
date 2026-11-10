import BuddyBudgetKit
import SwiftUI

// Overlays (spec: design/components.md §1.7–1.8, tokens.md §6.3, decisions/0003). Android: BBOverlays.kt.
//
// BBSheet is a custom presenter on both platforms (the "choose one approach" of §1.7): a window-level layer
// (iOS: an animation-free `fullScreenCover` with a clear background; Android: a full-screen `Dialog`) that draws
// the 40 % scrim and a bottom panel: top corners 16, `--popover`, 36×4 handle, enter 280 ms
// cubic-bezier(0.32, 0.72, 0, 1), exit 180 ms ease-in, swipe down > 80 pt or > 0.6 pt/ms dismisses, otherwise it
// snaps back with the `sheetSnapBack` spring. Max height 85 % of the screen; taller content scrolls inside.

private let sheetEnter = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.28)
private let sheetExit = Animation.bb(BBMotion.easingIn, duration: BBMotion.durationSheetExit)

extension View {
    /// Bottom sheet with drag handle. `title` uses font-heading text-base medium.
    func bbSheet<SheetContent: View>(isPresented: Binding<Bool>, title: String? = nil,
                                     @ViewBuilder content: @escaping () -> SheetContent) -> some View {
        modifier(BBSheetPresenter(isPresented: isPresented, scrim: .bbScrimDialog) {
            BBSheetBody(title: title, content: content)
        })
    }

    /// Confirmation as a bottom sheet (AlertDialog on phone): optional icon, title, description, actions stacked
    /// with the confirm button on top; lighter 10 % scrim. Use for every destructive confirmation.
    func bbAlertSheet(isPresented: Binding<Bool>, title: String, description: String, confirmLabel: String,
                      confirmVariant: BBButtonVariant = .destructive, cancelLabel: String = L10n.cancel,
                      icon: BBIcon? = nil, onConfirm: @escaping () -> Void) -> some View {
        modifier(BBSheetPresenter(isPresented: isPresented, scrim: .bbScrimAlert) {
            BBAlertSheetBody(title: title, description: description, confirmLabel: confirmLabel,
                             confirmVariant: confirmVariant, cancelLabel: cancelLabel, icon: icon,
                             onConfirm: {
                                 isPresented.wrappedValue = false
                                 onConfirm()
                             },
                             onCancel: { isPresented.wrappedValue = false })
        })
    }
}

private struct BBSheetPresenter<Panel: View>: ViewModifier {
    @Binding var isPresented: Bool
    let scrim: Color
    @ViewBuilder let panel: () -> Panel
    @State private var coverShown = false

    func body(content: Content) -> some View {
        content
            .fullScreenCover(isPresented: $coverShown) {
                BBSheetLayer(isPresented: $isPresented, scrim: scrim, onGone: { setCover(false) }, panel: panel)
                    .presentationBackground(.clear)
                    .environment(\.openScrivici, nil)
            }
            .onChange(of: isPresented) { _, presented in if presented { setCover(true) } }
            .onAppear { if isPresented { setCover(true) } }
    }

    private func setCover(_ shown: Bool) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) { coverShown = shown }
    }
}

private struct SheetContentHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

private struct BBSheetLayer<Panel: View>: View {
    @Binding var isPresented: Bool
    let scrim: Color
    let onGone: () -> Void
    @ViewBuilder let panel: () -> Panel

    @State private var shown = false
    @State private var drag: CGFloat = 0
    @State private var contentHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                scrim
                    .ignoresSafeArea()
                    .opacity(shown ? 1 : 0)
                    .onTapGesture { isPresented = false }
                    .accessibilityHidden(true)
                let maxHeight = (proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom)
                    * BBLayout.sheetMaxHeightFraction - 28
                VStack(spacing: 0) {
                    handle
                    // Content hugs its height up to 85 % of the screen, then scrolls inside the sheet.
                    ScrollView {
                        panel()
                            .padding(.horizontal, BBSpacing.space4)
                            .padding(.bottom, max(BBSpacing.space5, proxy.safeAreaInsets.bottom))
                            .background(GeometryReader { p in
                                Color.clear.preference(key: SheetContentHeightKey.self, value: p.size.height)
                            })
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollIndicators(.hidden)
                    .frame(height: min(contentHeight, maxHeight))
                    .onPreferenceChange(SheetContentHeightKey.self) { contentHeight = $0 }
                }
                .frame(maxWidth: .infinity)
                .background(
                    UnevenRoundedRectangle(topLeadingRadius: BBRadius.xl, topTrailingRadius: BBRadius.xl, style: .circular)
                        .fill(Color.bbPopover)
                        .overlay(UnevenRoundedRectangle(topLeadingRadius: BBRadius.xl, topTrailingRadius: BBRadius.xl, style: .circular)
                            .strokeBorder(Color.bbAlphaForeground10, lineWidth: 1))
                        .bbShadow(BBShadow.lg)
                        .ignoresSafeArea(edges: .bottom)
                )
                .offset(y: shown ? max(0, drag) : proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom)
                .gesture(dragGesture)
                .accessibilityAddTraits(.isModal)
            }
            .ignoresSafeArea(.container, edges: .bottom) // the keyboard still pushes the panel up (text inputs in sheets)
        }
        .onAppear {
            withAnimation(reduceMotion ? .linear(duration: BBMotion.durationFast) : sheetEnter) { shown = true }
        }
        .onChange(of: isPresented) { _, presented in
            if !presented { dismissAnimated() }
        }
        .accessibilityAction(.escape) { isPresented = false }
    }

    private var handle: some View {
        Capsule()
            .fill(Color.bbBorder)
            .frame(width: 36, height: 4)
            .padding(.top, 10)
            .frame(maxWidth: .infinity)
            .frame(height: 28, alignment: .top)
            .contentShape(Rectangle())
            .accessibilityHidden(true)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 4)
            .onChanged { g in drag = max(0, g.translation.height) }
            .onEnded { g in
                let velocity = g.velocity.height / 1000 // pt/ms
                if g.translation.height > BBLayout.sheetCloseDistance || velocity > BBLayout.sheetCloseVelocity {
                    isPresented = false
                } else {
                    withAnimation(.bb(BBMotion.springSheetSnapBack)) { drag = 0 }
                }
            }
    }

    private func dismissAnimated() {
        withAnimation(reduceMotion ? .linear(duration: BBMotion.durationFast) : sheetExit) {
            shown = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit + 0.02) {
            drag = 0
            onGone()
        }
    }
}

private struct BBSheetBody<Content: View>: View {
    let title: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        column
    }

    private var column: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            if let title {
                BBText(title, style: BBTypography.cardTitle.with(lineHeight: 24)).accessibilityAddTraits(.isHeader)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct BBAlertSheetBody: View {
    let title: String
    let description: String
    let confirmLabel: String
    let confirmVariant: BBButtonVariant
    let cancelLabel: String
    let icon: BBIcon?
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            if let icon {
                BBIconBadge(icon: icon, color: confirmVariant == .destructive ? .bbDestructive : .bbPrimary, diameter: 44, iconSize: 20)
            }
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(title, style: BBTypography.cardTitle.with(lineHeight: 24)).accessibilityAddTraits(.isHeader)
                BBText(description, style: BBTypography.body, color: .bbMutedForeground)
            }
            VStack(spacing: BBSpacing.space2) {
                BBButton(confirmLabel, variant: confirmVariant, size: .touch, fullWidth: true, action: onConfirm)
                BBButton(cancelLabel, variant: .outline, size: .touch, fullWidth: true, action: onCancel)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Toasts

enum BBToastKind: Sendable { case plain, success, info, warning, error, loading }

struct BBToast: Identifiable {
    let id = UUID()
    let kind: BBToastKind
    let message: String
    var actionLabel: String?
    var onAction: (() -> Void)?
    /// Runs when the toast goes away without its action (timeout, swipe, pushed out of the stack).
    var onDismiss: (() -> Void)?
    var duration: TimeInterval = 4
}

/// One global queue of toasts (sonner): bottom-center, auto-dismiss 4 s, at most 3 visible, swipe to dismiss,
/// optional action. Same API on Android (`ToastCenter.show`).
@MainActor @Observable
final class ToastCenter {
    private(set) var toasts: [BBToast] = []
    static let maxVisible = 3
    /// Set by the signed-in shell: the `Segnala` action of error toasts (`showError`, SUP-023).
    @ObservationIgnored var reportAction: ((ReportError) -> Void)?

    func show(_ kind: BBToastKind, _ message: String, actionLabel: String? = nil, onAction: (() -> Void)? = nil,
              onDismiss: (() -> Void)? = nil, duration: TimeInterval = 4) {
        let toast = BBToast(kind: kind, message: message, actionLabel: actionLabel, onAction: onAction,
                            onDismiss: onDismiss, duration: duration)
        toasts.append(toast)
        while toasts.count > Self.maxVisible { dismiss(toasts[0].id) }
        if kind != .loading {
            let id = toast.id
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(duration))
                self?.dismiss(id)
            }
        }
    }

    /// Delete with Undo (decision 0003): the caller already removed the item locally. `onUndo` restores it;
    /// `onCommit` (after 5 s, a swipe, or when pushed out) sends the API call.
    func showUndo(_ message: String, undoLabel: String = L10n.undo, onUndo: @escaping () -> Void,
                  onCommit: @escaping () -> Void) {
        show(.plain, message, actionLabel: undoLabel, onAction: onUndo, onDismiss: onCommit, duration: 5)
    }

    func dismiss(_ id: UUID) {
        guard let index = toasts.firstIndex(where: { $0.id == id }) else { return }
        let toast = toasts.remove(at: index)
        toast.onDismiss?()
    }

    func performAction(_ id: UUID) {
        guard let index = toasts.firstIndex(where: { $0.id == id }) else { return }
        let toast = toasts.remove(at: index)
        toast.onAction?()
    }
}

extension View {
    /// Hosts the toast stack above this view (put it at the app root).
    func bbToastHost(_ center: ToastCenter) -> some View {
        overlay(alignment: .bottom) { BBToastStack(center: center) }
    }
}

private struct BBToastStack: View {
    let center: ToastCenter
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: BBSpacing.space2) {
            ForEach(center.toasts) { toast in
                BBToastView(toast: toast, onAction: { center.performAction(toast.id) }, onClose: { center.dismiss(toast.id) })
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.horizontal, BBSpacing.space4)
        .padding(.bottom, BBSpacing.space4)
        .animation(.bbMotion(.bb(BBMotion.springSnappy), reduceMotion: reduceMotion), value: center.toasts.map(\.id))
    }
}

/// Toast card: `--popover`, 1 pt `--border`, radius lg, padding 16, icon 16, text-sm; action = default sm button.
struct BBToastView: View {
    let toast: BBToast
    var onAction: () -> Void = {}
    var onClose: () -> Void = {}
    @State private var drag: CGSize = .zero

    var body: some View {
        HStack(spacing: BBSpacing.space2) {
            icon
            BBText(toast.message, style: BBTypography.body, color: .bbPopoverForeground)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let label = toast.actionLabel {
                BBButton(label, size: .sm, action: onAction)
            }
        }
        .padding(.horizontal, BBSpacing.space4)
        .frame(minHeight: 52)
        .background(RoundedRectangle.bb(BBRadius.lg).fill(Color.bbPopover))
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbBorder, lineWidth: 1))
        .bbShadow(BBShadow.lg)
        .offset(x: drag.width, y: max(0, drag.height))
        .gesture(
            DragGesture(minimumDistance: 8)
                .onChanged { drag = $0.translation }
                .onEnded { g in
                    if abs(g.translation.width) > 80 || g.translation.height > 40 { onClose() }
                    withAnimation(.bb(BBMotion.springSnappy)) { drag = .zero }
                }
        )
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }

    @ViewBuilder private var icon: some View {
        switch toast.kind {
        case .plain: EmptyView()
        case .success: BBIconView(.circleCheck, size: .md, color: .bbPopoverForeground)
        case .info: BBIconView(.info, size: .md, color: .bbPopoverForeground)
        case .warning: BBIconView(.triangleAlert, size: .md, color: .bbPopoverForeground)
        case .error: BBIconView(.octagonX, size: .md, color: .bbPopoverForeground)
        case .loading: BBSpinner(size: .md, color: .bbPopoverForeground)
        }
    }
}
