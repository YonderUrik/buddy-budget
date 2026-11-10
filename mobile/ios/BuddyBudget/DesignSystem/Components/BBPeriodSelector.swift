import BuddyBudgetKit
import SwiftUI

// The app's one period selector (spec: design/components.md «PeriodSelector»; web components/domain/shared/
// period-selector.tsx, decision 2026-10-17-selettore-del-periodo, #408). Presets on one line that never wraps (it
// scrolls sideways as a last resort), 44 pt tall; when a screen allows a custom range, a calendar button opens a bottom
// sheet with «Dal → Al», a day calendar (or a month grid) and «Applica». Logic: `CalendarRange` in BuddyBudgetKit.
// Android: BBPeriodSelector.kt.

/// The custom range a `PeriodSelector` can offer.
struct PeriodCustom<Value: Hashable> {
    /// Value the selection takes while the custom range is in use.
    let value: Value
    var granularity: RangeGranularity = .day
    /// Last applied range: `YYYY-MM-DD` for days, `YYYY-MM` for months.
    let range: DateKeyRange
    var min: String?
    /// Usually today (days) or the last full month (months).
    var max: String?
    /// Why a range cannot be used (already translated), or nil.
    var validate: ((DateKeyRange) -> String?)?
    /// Show the chosen range under the presets (off where the screen already writes it).
    var showCaption = true
    let onApply: (DateKeyRange) -> Void
}

struct PeriodSelector<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var accessibilityLabel: String = ""
    var custom: PeriodCustom<Value>?
    /// Full width with equal segments.
    var stretch = false

    @State private var open = false
    @Namespace private var pill
    @Environment(\.bbLocale) private var locale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var customActive: Bool { custom.map { $0.value == selection } ?? false }

    var body: some View {
        VStack(spacing: BBSpacing.space1_5) {
            if stretch {
                bar.frame(maxWidth: .infinity)
            } else {
                ScrollView(.horizontal) { bar }
                    .scrollIndicators(.hidden)
                    .fixedSize(horizontal: false, vertical: true)
                    .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            }
            if let custom, customActive, custom.showCaption {
                Button { open = true } label: {
                    BBText(label(custom), style: BBTypography.caption, color: .bbMutedForeground)
                        .monospacedDigit()
                        .padding(.horizontal, BBSpacing.space1_5)
                        .bbHitArea(height: 16)
                }
                .buttonStyle(.plain)
            }
        }
        #if DEBUG
        // `-BBPeriodOpen`: opens the calendar sheet of the first selector with a custom range (screenshots).
        .task { if custom != nil, DebugLaunch.flag("-BBPeriodOpen") { try? await Task.sleep(for: .seconds(1)); open = true } }
        #endif
        .bbSheet(isPresented: $open) {
            if let custom {
                PeriodRangePanel(custom: custom, onApply: { range in
                    custom.onApply(range)
                    if selection != custom.value { selection = custom.value }
                    open = false
                }, onCancel: { open = false })
            }
        }
    }

    private var bar: some View {
        HStack(spacing: BBSpacing.space1) {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                segment(active: option.value == selection) {
                    BBText(option.label, style: BBTypography.bodyStrong,
                           color: option.value == selection ? .bbForeground : .bbMutedForeground, lineLimit: 1)
                } action: {
                    withAnimation(.bbMotion(.bb(BBMotion.springBouncy), reduceMotion: reduceMotion)) { selection = option.value }
                }
                .accessibilityAddTraits(option.value == selection ? .isSelected : [])
            }
            if let custom {
                segment(active: customActive) {
                    BBIconView(.calendarDays, size: .md, color: customActive ? .bbForeground : .bbMutedForeground)
                } action: { open = true }
                .accessibilityLabel(customActive
                    ? L10n.lookup(italian: "Date scelte: {0}. Cambia le date", ["0": label(custom)])
                    : L10n.lookup(italian: custom.granularity == .day ? "Scegli le date" : "Scegli i mesi"))
                .accessibilityAddTraits(customActive ? .isSelected : [])
            }
        }
        .padding(BBSpacing.space1)
        .frame(maxWidth: stretch ? .infinity : nil)
        .background(Capsule().fill(Color.bbMuted))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityLabel)
    }

    private func segment<Label: View>(active: Bool, @ViewBuilder label: () -> Label, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            label()
                .padding(.horizontal, BBSpacing.space2_5)
                .frame(minWidth: BBLayout.periodSegmentHeight, maxWidth: stretch ? .infinity : nil,
                       minHeight: BBLayout.periodSegmentHeight)
                .background {
                    if active {
                        Capsule().fill(Color.bbBackground).matchedGeometryEffect(id: "pill", in: pill)
                    }
                }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func label(_ custom: PeriodCustom<Value>) -> String {
        CalendarRange.shortLabel(from: custom.range.from, to: custom.range.to, granularity: custom.granularity,
                                 locale: locale, currentYear: CalendarDate.of(Date(), in: .current).year)
    }
}

/// Body of the custom-range sheet: the two ends («Dal», «Al»), a calendar of days or months, the reason a range
/// cannot be used, and «Applica». It keeps its own draft, so closing without applying changes nothing.
struct PeriodRangePanel<Value: Hashable>: View {
    let custom: PeriodCustom<Value>
    let onApply: (DateKeyRange) -> Void
    let onCancel: () -> Void

    @State private var draft: RangeDraft
    @State private var monthYear: Int
    @Environment(\.bbLocale) private var locale

    init(custom: PeriodCustom<Value>, onApply: @escaping (DateKeyRange) -> Void, onCancel: @escaping () -> Void) {
        self.custom = custom
        self.onApply = onApply
        self.onCancel = onCancel
        _draft = State(initialValue: RangeDraft(from: custom.range.from, to: custom.range.to))
        _monthYear = State(initialValue: CalendarRange.parseMonth(custom.range.to).year)
    }

    var body: some View {
        let complete = draft.to.map { DateKeyRange(from: draft.from, to: $0) }
        let error = complete.flatMap { custom.validate?($0) }
        let day = custom.granularity == .day
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            BBText(L10n.lookup(italian: day ? "Scegli le date" : "Scegli i mesi"), style: BBTypography.cardTitle.with(lineHeight: 24))
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: BBSpacing.space2) {
                end(L10n.lookup(italian: "Dal"), CalendarRange.endLabel(draft.from, granularity: custom.granularity, locale: locale), waiting: false)
                BBIconView(.arrowRight, size: .md, color: .bbText3)
                end(L10n.lookup(italian: "Al"),
                    draft.to.map { CalendarRange.endLabel($0, granularity: custom.granularity, locale: locale) }
                        ?? L10n.lookup(italian: day ? "Tocca l'ultimo giorno" : "Tocca l'ultimo mese"),
                    waiting: draft.to == nil)
            }
            if day {
                RangeCalendar(draft: draft, min: custom.min, max: custom.max) { draft = CalendarRange.pick(draft, $0) }
            } else {
                MonthGrid(year: $monthYear, min: custom.min, max: custom.max,
                          isEdge: { $0 == draft.from || $0 == draft.to }, isInside: { CalendarRange.inDraft(draft, $0) },
                          onPick: { draft = CalendarRange.pick(draft, $0) })
            }
            if let error { BBText(error, style: BBTypography.caption, color: .bbNeg) }
            VStack(spacing: BBSpacing.space2) {
                BBButton(L10n.lookup(italian: "Applica"), size: .touch, fullWidth: true, isDisabled: complete == nil || error != nil) {
                    if let complete { onApply(complete) }
                }
                BBButton(L10n.lookup(italian: "Annulla"), variant: .ghost, size: .touch, fullWidth: true, action: onCancel)
            }
        }
    }

    private func end(_ label: String, _ value: String, waiting: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            BBText(label, style: BBTypography.caption, color: .bbMutedForeground)
            BBText(value, style: BBTypography.bodyStrong, color: waiting ? .bbMutedForeground : .bbForeground, lineLimit: 1)
                .monospacedDigit()
        }
        .padding(.horizontal, BBSpacing.space3)
        .padding(.vertical, BBSpacing.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle.bb(BBRadius.lg).strokeBorder(waiting ? Color.bbPrimary : Color.bbBorder, lineWidth: 1))
        .background(RoundedRectangle.bb(BBRadius.lg + 2).stroke(waiting ? Color.bbPrimary.opacity(0.2) : .clear, lineWidth: 2).padding(-1))
    }
}

/// One month of days for picking a range by tapping its first and last day; the title opens a month view.
struct RangeCalendar: View {
    let draft: RangeDraft
    var min: String?
    var max: String?
    let onPick: (String) -> Void

    @State private var visible: String
    @State private var monthsView = false
    @State private var monthYear: Int
    @Environment(\.bbLocale) private var locale

    init(draft: RangeDraft, min: String?, max: String?, onPick: @escaping (String) -> Void) {
        self.draft = draft
        self.min = min
        self.max = max
        self.onPick = onPick
        let key = CalendarRange.monthOf(draft.to ?? draft.from)
        _visible = State(initialValue: key)
        _monthYear = State(initialValue: CalendarRange.parseMonth(key).year)
    }

    var body: some View {
        let m = CalendarRange.parseMonth(visible)
        if monthsView {
            MonthGrid(year: $monthYear, min: min, max: max, isEdge: { $0 == visible }, isInside: { _ in false }) { key in
                visible = key
                monthsView = false
            }
        } else {
            let minMonth = min.map(CalendarRange.monthOf)
            let maxMonth = max.map(CalendarRange.monthOf)
            VStack(spacing: BBSpacing.space1) {
                CalendarNav(label: BBFormat.capitalize(CalendarRange.monthTitle(visible, locale: locale)),
                            previousLabel: L10n.lookup(italian: "Mese precedente"), nextLabel: L10n.lookup(italian: "Mese successivo"),
                            canPrevious: minMonth.map { visible > $0 } ?? true, canNext: maxMonth.map { visible < $0 } ?? true,
                            onPrevious: { visible = CalendarRange.monthKey(year: m.year, monthIndex: m.monthIndex - 1) },
                            onNext: { visible = CalendarRange.monthKey(year: m.year, monthIndex: m.monthIndex + 1) },
                            onLabel: {
                                monthYear = m.year
                                monthsView = true
                            }, labelAction: L10n.lookup(italian: "scegli il mese"))
                HStack(spacing: 0) {
                    ForEach(Array(CalendarRange.weekdayInitials(locale: locale).enumerated()), id: \.offset) { _, day in
                        BBText(day, style: BBTypography.caption, color: .bbText3).frame(maxWidth: .infinity).padding(.vertical, BBSpacing.space1)
                    }
                }
                .accessibilityHidden(true)
                let days = CalendarRange.monthGrid(year: m.year, monthIndex: m.monthIndex)
                VStack(spacing: 2) {
                    ForEach(0..<6, id: \.self) { week in
                        HStack(spacing: 0) {
                            ForEach(days[(week * 7)..<(week * 7 + 7)], id: \.key) { day in dayCell(day) }
                        }
                    }
                }
            }
        }
    }

    private func dayCell(_ day: CalendarDay) -> some View {
        let disabled = CalendarRange.outOfBounds(day.key, min: min, max: max)
        let edge = day.key == draft.from || day.key == draft.to
        let inside = !edge && CalendarRange.inDraft(draft, day.key)
        let spans = draft.to != nil && draft.to != draft.from
        let leftFlat = inside || (spans && day.key == draft.to)
        let rightFlat = inside || (spans && day.key == draft.from)
        let shape = UnevenRoundedRectangle(topLeadingRadius: leftFlat ? 0 : BBRadius.lg, bottomLeadingRadius: leftFlat ? 0 : BBRadius.lg,
                                           bottomTrailingRadius: rightFlat ? 0 : BBRadius.lg, topTrailingRadius: rightFlat ? 0 : BBRadius.lg,
                                           style: .circular)
        return Button { onPick(day.key) } label: {
            BBText(String(day.day), style: edge ? BBTypography.body.with(weight: 600) : BBTypography.body,
                   color: edge ? .bbPrimaryForeground : (day.inMonth ? .bbForeground : .bbText3))
                .monospacedDigit()
                .frame(maxWidth: .infinity, minHeight: BBLayout.minTouchTarget)
                .background(shape.fill(edge ? Color.bbPrimary : (inside ? Color.bbPrimary.opacity(0.12) : .clear)))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.3 : 1)
        .accessibilityLabel(CalendarDate(iso: day.key).map { BBFormat.formatDate($0, .EEEEdMMMMy, locale: locale) } ?? day.key)
        .accessibilityAddTraits(edge || inside ? .isSelected : [])
    }
}

/// Twelve months of one year with arrows to change year (Analitiche's month range, the day calendar's month jump).
struct MonthGrid: View {
    @Binding var year: Int
    var min: String?
    var max: String?
    let isEdge: (String) -> Bool
    let isInside: (String) -> Bool
    let onPick: (String) -> Void

    @Environment(\.bbLocale) private var locale

    init(year: Binding<Int>, min: String?, max: String?, isEdge: @escaping (String) -> Bool,
         isInside: @escaping (String) -> Bool, onPick: @escaping (String) -> Void) {
        _year = year
        self.min = min
        self.max = max
        self.isEdge = isEdge
        self.isInside = isInside
        self.onPick = onPick
    }

    var body: some View {
        let minYear = min.map { CalendarRange.parseMonth($0).year }
        let maxYear = max.map { CalendarRange.parseMonth($0).year }
        VStack(spacing: BBSpacing.space2) {
            CalendarNav(label: String(year), previousLabel: L10n.lookup(italian: "Anno precedente"),
                        nextLabel: L10n.lookup(italian: "Anno successivo"),
                        canPrevious: minYear.map { year > $0 } ?? true, canNext: maxYear.map { year < $0 } ?? true,
                        onPrevious: { year -= 1 }, onNext: { year += 1 })
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: BBSpacing.space1), count: 3), spacing: BBSpacing.space1) {
                ForEach(0..<12, id: \.self) { index in
                    let key = CalendarRange.monthKey(year: year, monthIndex: index)
                    let disabled = CalendarRange.outOfBounds(key, min: min.map(CalendarRange.monthOf), max: max.map(CalendarRange.monthOf))
                    let edge = isEdge(key)
                    let inside = isInside(key)
                    Button { onPick(key) } label: {
                        BBText(BBFormat.capitalize(CalendarRange.shortMonth(year: year, monthIndex: index, locale: locale)),
                               style: BBTypography.bodyStrong, color: edge ? .bbPrimaryForeground : .bbForeground)
                            .frame(maxWidth: .infinity, minHeight: BBLayout.minTouchTarget)
                            .background(RoundedRectangle.bb(BBRadius.lg).fill(edge ? Color.bbPrimary : (inside ? Color.bbPrimary.opacity(0.12) : .clear)))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(disabled)
                    .opacity(disabled ? 0.35 : 1)
                    .accessibilityAddTraits(edge || inside ? .isSelected : [])
                }
            }
        }
    }
}

/// Header of a calendar page: «‹ Ottobre 2026 ›»; with `onLabel` the title is a button.
struct CalendarNav: View {
    let label: String
    let previousLabel: String
    let nextLabel: String
    let canPrevious: Bool
    let canNext: Bool
    let onPrevious: () -> Void
    let onNext: () -> Void
    var onLabel: (() -> Void)?
    var labelAction: String?

    var body: some View {
        HStack(spacing: BBSpacing.space1) {
            arrow(.chevronLeft, previousLabel, enabled: canPrevious, action: onPrevious)
            Spacer(minLength: 0)
            if let onLabel {
                Button(action: onLabel) {
                    BBText(label, style: BBTypography.cardTitle)
                        .padding(.horizontal, BBSpacing.space3)
                        .frame(minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
                .accessibilityLabel(labelAction.map { "\(label), \($0)" } ?? label)
            } else {
                BBText(label, style: BBTypography.cardTitle)
            }
            Spacer(minLength: 0)
            arrow(.chevronRight, nextLabel, enabled: canNext, action: onNext)
        }
    }

    private func arrow(_ icon: BBIcon, _ label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            BBIconView(icon, size: .md, color: .bbText2)
                .frame(width: BBLayout.minTouchTarget, height: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.lg)), translate: false))
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.3)
        .accessibilityLabel(label)
    }
}
