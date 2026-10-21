import Testing
@testable import BuddyBudgetKit

// PeriodSelector custom range (design/components.md «PeriodSelector», web lib/calc/calendar-range.test.ts, #408).
// The same cases run on Android in core/src/test/.../CalendarRangeTest.kt.

@Test func DS_periodCalendar_monthGridIsSixMondayFirstWeeks() {
    let grid = CalendarRange.monthGrid(year: 2026, monthIndex: 9) // October 2026 starts on a Thursday
    #expect(grid.count == 42)
    #expect(grid[0] == CalendarDay(key: "2026-09-28", day: 28, inMonth: false))
    #expect(grid[3] == CalendarDay(key: "2026-10-01", day: 1, inMonth: true))
    #expect(grid[33] == CalendarDay(key: "2026-10-31", day: 31, inMonth: true))
    #expect(grid[41] == CalendarDay(key: "2026-11-08", day: 8, inMonth: false))
    // A month starting on Monday has no leading days.
    #expect(CalendarRange.monthGrid(year: 2026, monthIndex: 5)[0].key == "2026-06-01")
}

@Test func DS_periodCalendar_pickTwoTaps() {
    var draft = RangeDraft(from: "2026-10-01", to: "2026-10-20")
    draft = CalendarRange.pick(draft, "2026-03-03")
    #expect(draft == RangeDraft(from: "2026-03-03", to: nil))
    // Tapping before the start moves the start.
    draft = CalendarRange.pick(draft, "2026-02-10")
    #expect(draft == RangeDraft(from: "2026-02-10", to: nil))
    draft = CalendarRange.pick(draft, "2026-04-17")
    #expect(draft == RangeDraft(from: "2026-02-10", to: "2026-04-17"))
    // Same day twice is a one-day range.
    #expect(CalendarRange.pick(RangeDraft(from: "2026-05-05", to: nil), "2026-05-05") == RangeDraft(from: "2026-05-05", to: "2026-05-05"))
}

@Test func DS_periodCalendar_insideBoundsAndSpan() {
    #expect(CalendarRange.inDraft(RangeDraft(from: "2026-03-03", to: nil), "2026-03-03"))
    #expect(!CalendarRange.inDraft(RangeDraft(from: "2026-03-03", to: nil), "2026-03-04"))
    #expect(CalendarRange.inDraft(RangeDraft(from: "2026-03-03", to: "2026-03-10"), "2026-03-10"))
    #expect(CalendarRange.outOfBounds("2026-10-21", min: nil, max: "2026-10-20"))
    #expect(!CalendarRange.outOfBounds("2026-10-20", min: "2026-01-01", max: "2026-10-20"))
    #expect(CalendarRange.span(from: "2026-03-01", to: "2026-03-31", granularity: .day) == 31)
    #expect(CalendarRange.span(from: "2025-11", to: "2026-02", granularity: .month) == 4)
    #expect(CalendarRange.monthKey(year: 2026, monthIndex: 12) == "2027-01")
    #expect(CalendarRange.monthKey(year: 2026, monthIndex: -1) == "2025-12")
}

@Test func DS_periodCalendar_shortLabels() {
    #expect(CalendarRange.shortLabel(from: "2026-03-03", to: "2026-10-17", granularity: .day, locale: .itIT, currentYear: 2026) == "3 mar – 17 ott")
    #expect(CalendarRange.shortLabel(from: "2025-12-20", to: "2026-01-06", granularity: .day, locale: .itIT, currentYear: 2026) == "20 dic 2025 – 6 gen 2026")
    #expect(CalendarRange.shortLabel(from: "2026-03-03", to: "2026-03-03", granularity: .day, locale: .itIT, currentYear: 2026) == "3 mar")
    #expect(CalendarRange.shortLabel(from: "2025-01", to: "2025-12", granularity: .month, locale: .itIT, currentYear: 2026) == "gen 2025 – dic 2025")
    #expect(CalendarRange.weekdayInitials(locale: .itIT) == ["L", "M", "M", "G", "V", "S", "D"])
    #expect(CalendarRange.monthTitle("2026-10", locale: .itIT) == "ottobre 2026")
    #expect(CalendarRange.shortMonth(year: 2026, monthIndex: 9, locale: .itIT) == "ott")
}
