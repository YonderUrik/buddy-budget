import BuddyBudgetKit
import SwiftUI

// Full-screen form dialog and date field (spec: design/components.md §0.2, §1.4, §1.7). Android: BBFormDialog.kt.

// MARK: - FormDialog

extension View {
    /// `FormDialogContent` on phone: full-screen `--popover` modal, no handle, close `x` (20) in a 44 circle at
    /// top 12 / right 12, scrolling content with gap 20, optional `footer` pinned at the bottom (actions).
    /// Enter: slide up 24 pt + fade, 200 ms; exit reversed.
    func formDialog<Content: View, Footer: View>(isPresented: Binding<Bool>, closeLabel: String = L10n.close,
                                                 @ViewBuilder content: @escaping () -> Content,
                                                 @ViewBuilder footer: @escaping () -> Footer) -> some View {
        modifier(FormDialogPresenter(isPresented: isPresented) {
            FormDialogLayer(isPresented: isPresented, closeLabel: closeLabel, content: content, footer: footer)
        })
    }

    func formDialog<Content: View>(isPresented: Binding<Bool>, closeLabel: String = L10n.close,
                                   @ViewBuilder content: @escaping () -> Content) -> some View {
        formDialog(isPresented: isPresented, closeLabel: closeLabel, content: content, footer: { EmptyView() })
    }
}

private struct FormDialogPresenter<Layer: View>: ViewModifier {
    @Binding var isPresented: Bool
    @ViewBuilder let layer: () -> Layer
    @State private var coverShown = false

    func body(content: Content) -> some View {
        content
            .fullScreenCover(isPresented: $coverShown) {
                layer()
                    .environment(\.formDialogGone, { setCover(false) })
                    .environment(\.openScrivici, nil)
                    .presentationBackground(.clear)
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

private struct FormDialogGoneKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: () -> Void = {}
}

private extension EnvironmentValues {
    var formDialogGone: () -> Void {
        get { self[FormDialogGoneKey.self] }
        set { self[FormDialogGoneKey.self] = newValue }
    }
}

private struct FormDialogLayer<Content: View, Footer: View>: View {
    @Binding var isPresented: Bool
    let closeLabel: String
    @ViewBuilder let content: () -> Content
    @ViewBuilder let footer: () -> Footer

    @State private var shown = false
    @Environment(\.formDialogGone) private var gone
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: BBSpacing.space5) { content() }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, BBSpacing.space4)
                    .padding(.top, BBSpacing.space4)
                    .padding(.bottom, BBSpacing.space6)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            if Footer.self != EmptyView.self {
                VStack(spacing: 0) {
                    BBSeparator()
                    footer()
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, BBSpacing.space4)
                        .padding(.vertical, BBSpacing.space3)
                }
                .background(Color.bbPopover)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button { isPresented = false } label: {
                BBIconView(.x, size: .lg, color: .bbMutedForeground)
                    .frame(width: BBLayout.minTouchTarget, height: BBLayout.minTouchTarget)
            }
            .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(Circle()), translate: false))
            .accessibilityLabel(closeLabel)
            .padding(.top, BBSpacing.space1)
            .padding(.trailing, BBSpacing.space1)
        }
        .background(Color.bbPopover.ignoresSafeArea())
        .offset(y: shown || reduceMotion ? 0 : 24)
        .opacity(shown ? 1 : 0)
        .onAppear {
            withAnimation(.easeOut(duration: BBMotion.durationBase)) { shown = true }
        }
        .onChange(of: isPresented) { _, presented in
            guard !presented else { return }
            withAnimation(.easeIn(duration: BBMotion.durationBase)) { shown = false }
            DispatchQueue.main.asyncAfter(deadline: .now() + BBMotion.durationBase + 0.02) { gone() }
        }
        .accessibilityAction(.escape) { isPresented = false }
    }
}

/// Header of a form dialog (`PanelDialogHeader`): tinted 40 circle with a 20 icon, title (font-heading text-lg),
/// description (text-sm `--muted-foreground`). Leaves room for the close button.
struct FormDialogHeader: View {
    let icon: BBIcon
    let title: String
    var description: String?
    var color: Color = .bbPrimary

    var body: some View {
        HStack(alignment: .top, spacing: BBSpacing.space3) {
            BBIconBadge(icon: icon, color: color, diameter: 40, iconSize: 20)
            VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
                BBText(title, style: BBTextStyle.titleSmall.with(lineHeight: 22))
                    .accessibilityAddTraits(.isHeader)
                if let description {
                    BBText(description, style: BBTypography.body, color: .bbMutedForeground)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.trailing, BBSpacing.space10)
    }
}

/// Sub-section of a form dialog (`DialogSection`): optional tinted 28 icon + text-sm semibold title, optional
/// muted description, then the content (gap 12).
struct FormDialogSection<Content: View>: View {
    let title: String
    var icon: BBIcon?
    var description: String?
    var color: Color = .bbPrimary
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(spacing: BBSpacing.space2) {
                if let icon { BBIconBadge(icon: icon, color: color, diameter: 28, iconSize: 14) }
                BBText(title, style: BBTypography.body.with(weight: 600)).accessibilityAddTraits(.isHeader)
            }
            if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - BBDateField

/// Date input (§1.4): looks like `BBSelect` (label, 32/44 pt field with the date and a calendar icon); tapping opens
/// the native graphical date picker in a `BBSheet`, which closes on selection. `date` is ISO `YYYY-MM-DD`.
/// Same parameters as `BBDateField` on Android (which opens the Material date picker).
struct BBDateField: View {
    var label: String?
    @Binding var date: String
    var height: CGFloat = BBLayout.inputHeight

    @State private var open = false
    @Environment(\.bbLocale) private var locale
    @Environment(\.colorScheme) private var scheme

    private static let utc = TimeZone(identifier: "UTC")!

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = Self.utc
        calendar.locale = Locale(identifier: locale.tag)
        return calendar
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            if let label { BBText(label, style: BBTypography.bodyStrong.with(lineHeight: 14)) }
            Button { open = true } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBText(BBFormat.formatDateWithYear(date, locale: locale), style: BBTypography.body, lineLimit: 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBIconView(.calendarDays, size: .md, color: .bbMutedForeground)
                }
                .padding(.horizontal, BBSpacing.space3)
                .frame(height: height)
                .background(RoundedRectangle.bb(BBRadius.lg).fill(scheme == .dark ? Color.bbAlphaInput30 : Color.clear))
                .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(Color.bbInput, lineWidth: 1))
                .contentShape(Rectangle())
                .bbHitArea(height: height)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label ?? "")
            .accessibilityValue(BBFormat.formatDateWithYear(date, locale: locale))
        }
        .bbSheet(isPresented: $open, title: label) {
            DatePicker("", selection: selection, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .tint(.bbPrimary)
                .environment(\.calendar, calendar)
                .environment(\.timeZone, Self.utc)
                .environment(\.locale, Locale(identifier: locale.tag))
        }
    }

    private var selection: Binding<Date> {
        Binding(
            get: {
                guard let d = CalendarDate(iso: date) else { return Date() }
                return Date(timeIntervalSince1970: TimeInterval(d.epochDay) * 86_400)
            },
            set: { new in
                date = CalendarDate.of(new, in: Self.utc).iso
                open = false
            })
    }
}
