import BuddyBudgetKit
import SwiftUI
import UIKit

// Lists, states and logos (spec: design/components.md §3.7–3.9, decisions/0003). Android: BBLists.kt.

// MARK: - BBListRow

/// Standard row (MovementRow geometry, §3.9): min height 60, gap 14, padding 6×10; leading avatar (36),
/// title (font-semibold, 1 line) + subtitle (text-sm `--text-2`), trailing slot (amount) and optional chevron.
struct BBListRow<Leading: View, Trailing: View>: View {
    let title: String
    var subtitle: String?
    var subtitleColor: Color = .bbText2
    var showsChevron = false
    var onClick: (() -> Void)?
    let leading: Leading
    let trailing: Trailing

    init(title: String, subtitle: String? = nil, subtitleColor: Color = .bbText2, showsChevron: Bool = false,
         onClick: (() -> Void)? = nil, @ViewBuilder leading: () -> Leading, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.subtitle = subtitle
        self.subtitleColor = subtitleColor
        self.showsChevron = showsChevron
        self.onClick = onClick
        self.leading = leading()
        self.trailing = trailing()
    }

    var body: some View {
        if let onClick {
            Button(action: onClick) { row }
                .buttonStyle(BBPressableStyle(pressedBackground: .bbAlphaMuted50, shape: AnyShape(RoundedRectangle.bb(BBRadius.xl)), translate: false))
        } else {
            row
        }
    }

    private var row: some View {
        HStack(spacing: BBSpacing.space3_5) {
            leading
            VStack(alignment: .leading, spacing: 0) {
                BBText(title, style: .rowTitle, lineLimit: 1)
                if let subtitle {
                    BBText(subtitle, style: BBTypography.body, color: subtitleColor, lineLimit: 1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing
            if showsChevron {
                BBIconView(.chevronRight, size: .md, color: .bbText3)
            }
        }
        .padding(.horizontal, BBSpacing.space1_5)
        .padding(.vertical, BBSpacing.space2_5)
        .frame(minHeight: 60)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

extension BBListRow where Leading == EmptyView {
    init(title: String, subtitle: String? = nil, subtitleColor: Color = .bbText2, showsChevron: Bool = false,
         onClick: (() -> Void)? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.init(title: title, subtitle: subtitle, subtitleColor: subtitleColor, showsChevron: showsChevron,
                  onClick: onClick, leading: { EmptyView() }, trailing: trailing)
    }
}

extension BBListRow where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil, subtitleColor: Color = .bbText2, showsChevron: Bool = false,
         onClick: (() -> Void)? = nil, @ViewBuilder leading: () -> Leading) {
        self.init(title: title, subtitle: subtitle, subtitleColor: subtitleColor, showsChevron: showsChevron,
                  onClick: onClick, leading: leading, trailing: { EmptyView() })
    }
}

/// Category/account avatar: 36 circle, swatch color @ 16 % fill, icon 16 in the swatch color (§3.7).
struct BBAvatar: View {
    let icon: BBIcon
    var color: Color = .bbSwatchSlate
    var body: some View { BBIconBadge(icon: icon, color: color, diameter: 36, iconSize: 16) }
}

// MARK: - Swipe to delete (decision 0003)

/// Swipe left to delete, for lists where the web deletes immediately. The row slides out and `onDelete` runs; the
/// caller removes the item locally and shows `ToastCenter.showUndo` (5 s) before sending the API call.
/// Threshold: 40 % of the width, or a fast fling. Only horizontal drags are captured; vertical scrolling still works.
struct BBSwipeToDelete<Content: View>: View {
    let onDelete: () -> Void
    var deleteLabel: String = L10n.delete_6b177b
    /// Initial reveal (0…1 of the width), for the component gallery.
    var previewFraction: CGFloat = 0
    let content: Content

    @State private var offset: CGFloat = 0
    @State private var width: CGFloat = 0
    @State private var horizontal: Bool?
    @Environment(\.colorScheme) private var scheme

    init(onDelete: @escaping () -> Void, deleteLabel: String = L10n.delete_6b177b, previewFraction: CGFloat = 0,
         @ViewBuilder content: () -> Content) {
        self.onDelete = onDelete
        self.deleteLabel = deleteLabel
        self.previewFraction = previewFraction
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            RoundedRectangle.bb(BBRadius.xl)
                .fill(scheme == .dark ? Color.bbAlphaDestructive20 : Color.bbAlphaDestructive10)
                .overlay(alignment: .trailing) {
                    BBIconView(.trash2, size: .lg, color: .bbDestructive)
                        .padding(.trailing, BBSpacing.space5)
                }
                .opacity(offset < 0 ? 1 : 0)
            content
                .background(Color.bbBackground)
                .offset(x: offset)
        }
        .background(GeometryReader { proxy in
            Color.clear.onAppear {
                width = proxy.size.width
                if previewFraction > 0 { offset = -previewFraction * proxy.size.width }
            }
        })
        .clipped()
        .simultaneousGesture(
            DragGesture(minimumDistance: 12)
                .onChanged { g in
                    if horizontal == nil { horizontal = abs(g.translation.width) > abs(g.translation.height) }
                    guard horizontal == true else { return }
                    offset = min(0, g.translation.width)
                }
                .onEnded { g in
                    defer { horizontal = nil }
                    guard horizontal == true else { return }
                    let fling = g.predictedEndTranslation.width < -width * 0.8
                    if -offset > width * 0.4 || fling {
                        withAnimation(.easeIn(duration: BBMotion.durationSheetExit)) { offset = -width }
                        DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationSheetExit) {
                            onDelete()
                            offset = 0
                        }
                    } else {
                        withAnimation(.bb(BBMotion.springSheetSnapBack)) { offset = 0 }
                    }
                }
        )
        .accessibilityAction(named: deleteLabel, onDelete)
    }
}

// MARK: - EmptyState

struct BBStateAction {
    let label: String
    let action: () -> Void
}

enum BBStateAlign: Sendable { case start, center }

/// No card around it: 44 circle with a tinted icon 20, title (font-heading text-xl), description (text-sm
/// `--text-2`, max 448), actions 44 high (primary = default, secondary = ghost) (§3.8).
struct EmptyState: View {
    let icon: BBIcon
    let title: String
    let description: String
    var primary: BBStateAction?
    var secondary: BBStateAction?
    var color: Color = .bbSwatchTeal
    var align: BBStateAlign = .start

    var body: some View {
        let horizontal: HorizontalAlignment = align == .center ? .center : .leading
        VStack(alignment: horizontal, spacing: BBSpacing.space3) {
            BBIconBadge(icon: icon, color: color, diameter: 44, iconSize: 20)
            VStack(alignment: horizontal, spacing: BBSpacing.space1) {
                BBText(title, style: BBTypography.sectionTitle)
                BBText(description, style: BBTypography.body, color: .bbText2)
            }
            .multilineTextAlignment(align == .center ? .center : .leading)
            .frame(maxWidth: 448, alignment: align == .center ? .center : .leading)
            if primary != nil || secondary != nil {
                HStack(spacing: BBSpacing.space2) {
                    if let primary { BBButton(primary.label, size: .touch, action: primary.action) }
                    if let secondary { BBButton(secondary.label, variant: .ghost, size: .touch, action: secondary.action) }
                }
            }
        }
        .padding(.vertical, BBSpacing.space2)
        .frame(maxWidth: .infinity, alignment: align == .center ? .center : .leading)
    }
}

// MARK: - LoadError / PageError

/// Alert box: radius xl, 1 pt `--destructive @ 30%`, fill `--destructive @ 5%`, text-sm `--destructive`, then
/// `Segnala questo problema` (inside the signed-in shell) and an outline sm "Riprova" button (§3.8, web `LoadError`).
struct LoadError: View {
    let message: String
    let onRetry: () -> Void
    /// Operation attached when the user reports the error (default: loading the page).
    var reportArea: ReportErrorArea = .caricamento
    @Environment(\.quickReport) private var quickReport

    var body: some View {
        Group {
            if quickReport == nil {
                HStack(spacing: BBSpacing.space3) {
                    messageText
                    retry
                }
            } else {
                VStack(alignment: .leading, spacing: BBSpacing.space2) {
                    messageText
                    HStack(spacing: BBSpacing.space3) {
                        ReportErrorLink(area: reportArea, error: message)
                        retry
                    }
                }
            }
        }
        .padding(BBSpacing.space4)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbDestructive.opacity(0.05)))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbDestructive.opacity(0.3), lineWidth: 1))
        .accessibilityElement(children: .contain)
    }

    private var messageText: some View {
        BBText(message, style: BBTypography.body, color: .bbDestructive)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var retry: some View {
        BBButton(L10n.retry, variant: .outline, size: .sm, action: onRetry)
    }
}

/// Full-page error for unrecoverable screen errors: title, description, error code (server request id), retry.
struct PageError: View {
    let title: String
    let description: String
    var code: String?
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBText(title, style: BBTextStyle.screenTitle)
            BBText(description, style: BBTypography.body, color: .bbText2)
            if let code { BBText(code, style: BBTypography.mono, color: .bbText3) }
            BBButton(L10n.retry, size: .touch, action: onRetry)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Loading skeletons

/// `--muted` block pulsing opacity 1 → 0.5 → 1 over 2 s (`animate-pulse`); no shimmer gradient (§3.8).
struct BBSkeleton: View {
    var width: CGFloat?
    var height: CGFloat
    var radius: CGFloat = BBRadius.md

    @State private var dim = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        RoundedRectangle.bb(radius)
            .fill(Color.bbMuted)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .opacity(dim ? 0.5 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.timingCurve(0.4, 0, 0.6, 1, duration: 1).repeatForever(autoreverses: true)) { dim = true }
            }
            .accessibilityHidden(true)
    }
}

/// Skeleton of `rows` list rows with the exact `BBListRow` geometry (avatar 36, two lines, trailing amount).
struct BBSkeletonRows: View {
    var rows = 4

    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<rows, id: \.self) { _ in
                HStack(spacing: BBSpacing.space3_5) {
                    BBSkeleton(width: 36, height: 36, radius: 18)
                    VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                        BBSkeleton(width: 140, height: 16)
                        BBSkeleton(width: 96, height: 12)
                    }
                    Spacer(minLength: 0)
                    BBSkeleton(width: 64, height: 16)
                }
                .padding(.horizontal, BBSpacing.space1_5)
                .padding(.vertical, BBSpacing.space2_5)
                .frame(minHeight: 60)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(L10n.loading)
    }
}

/// Generic page skeleton (§3.8): title 32×192, subtitle 16×288, hero block 176, two 256 blocks.
struct BBPageSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBSkeleton(width: 192, height: 32)
            BBSkeleton(width: 288, height: 16)
            BBSkeleton(height: 176, radius: BBRadius.xl)
            BBSkeleton(height: 256, radius: BBRadius.xl)
            BBSkeleton(height: 256, radius: BBRadius.xl)
        }
        .accessibilityElement()
        .accessibilityLabel(L10n.loading)
    }
}

// MARK: - MerchantLogo

enum MerchantLogoSize: Sendable {
    case sm, md, lg

    var diameter: CGFloat { self == .sm ? 36 : (self == .md ? 44 : 56) }
    var inset: CGFloat { self == .sm ? 6 : (self == .md ? 8 : 10) }
    var textStyle: BBTextStyle {
        let base = BBTextStyle(role: .sans, size: 14, lineHeight: 20, weight: 600, letterSpacingEm: 0,
                               tabularNums: false, uppercase: false, anchor: .subheadline)
        switch self {
        case .sm: return base
        case .md: return base.with(size: 16, lineHeight: 24)
        case .lg: return base.with(size: 20, lineHeight: 28)
        }
    }
}

/// Merchant/bank logo (§3.7): circle; while loading or without a logo, the initial (or `fallback` icon) on
/// `--foreground @ 6%` in `--text-2`; once loaded, a white tile in both themes with a 1 pt `--border` ring.
/// Images come from `LogoLoader` (authenticated, cached). Decorative: the name is always written next to it.
struct MerchantLogo: View {
    let name: String
    var logoPath: String?
    var size: MerchantLogoSize = .sm
    var fallback: BBIcon?
    var onRemoteLogo: (() -> Void)?
    /// Coloured-initial fallback (subscriptions): the initial in this color on the color @ 16 % instead of the neutral tile.
    var initialColor: Color?
    /// A whole view shown instead of the initial while loading or without a logo (the movement's category avatar, web
    /// `fallback={categoryAvatar(…)}`).
    var fallbackView: AnyView?

    @Environment(\.bbLogoLoader) private var loader
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image {
                Circle().fill(Color.white)
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(size.inset)
                    .clipShape(Circle())
                Circle().strokeBorder(Color.bbBorder, lineWidth: 1)
            } else if let fallbackView {
                fallbackView
            } else {
                Circle().fill(initialColor?.opacity(0.16) ?? Color.bbForeground.opacity(0.06))
                if let fallback {
                    BBIconView(fallback, size: .md, color: initialColor ?? .bbText2)
                } else {
                    BBText(MerchantInitial.of(name), style: size.textStyle, color: initialColor ?? .bbText2)
                }
            }
        }
        .frame(width: size.diameter, height: size.diameter)
        .accessibilityHidden(true)
        .task(id: logoPath) {
            image = nil
            guard let logoPath, let loader else { return }
            if let data = await loader.data(for: logoPath), let decoded = UIImage(data: data) {
                image = decoded
                onRemoteLogo?()
            }
        }
    }
}

/// "Loghi forniti da Logo.dev" under any list that showed a remote logo (Logo.dev free-plan condition).
struct LogoCredit: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            if let url = URL(string: "https://logo.dev") { openURL(url) }
        } label: {
            BBText("\(L10n.logosProvidedBy) Logo.dev", style: BBTypography.caption, color: .bbMutedForeground)
                .bbHitArea(height: 16)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - BBSoftRow

/// A row on a soft fill instead of a rule or a box (web `SoftRow`, #417/#427): radius 2xl, `--foreground @ 4%`,
/// min height 56, padding 12×16, title semibold, optional hint (text-sm `--text-2`), optional leading and trailing.
struct BBSoftRow<Trailing: View>: View {
    let title: String
    var hint: String?
    var leading: AnyView?
    let trailing: Trailing

    init(title: String, hint: String? = nil, leading: AnyView? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.hint = hint
        self.leading = leading
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: BBSpacing.space3_5) {
            if let leading { leading }
            VStack(alignment: .leading, spacing: 0) {
                BBText(title, style: BBTypography.bodyLarge.with(weight: 600))
                if let hint { BBText(hint, style: BBTypography.body, color: .bbText2) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing
        }
        .padding(.horizontal, BBSpacing.space4)
        .padding(.vertical, BBSpacing.space3)
        .frame(minHeight: 56)
        .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbForeground.opacity(0.04)))
        .accessibilityElement(children: .combine)
    }
}
