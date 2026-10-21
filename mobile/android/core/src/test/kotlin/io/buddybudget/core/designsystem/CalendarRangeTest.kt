package io.buddybudget.core.designsystem

import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDay
import io.buddybudget.core.domain.periods.CalendarRange
import io.buddybudget.core.domain.periods.RangeDraft
import io.buddybudget.core.domain.periods.RangeGranularity
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// PeriodSelector custom range (design/components.md «PeriodSelector», web lib/calc/calendar-range.test.ts, #408).
// The same cases run on iOS in BuddyBudgetKit/Tests/BuddyBudgetKitTests/CalendarRangeTests.swift.
class CalendarRangeTest {
    @Test
    fun DS_periodCalendar_monthGridIsSixMondayFirstWeeks() {
        val grid = CalendarRange.monthGrid(2026, 9) // October 2026 starts on a Thursday
        assertEquals(42, grid.size)
        assertEquals(CalendarDay("2026-09-28", 28, false), grid[0])
        assertEquals(CalendarDay("2026-10-01", 1, true), grid[3])
        assertEquals(CalendarDay("2026-10-31", 31, true), grid[33])
        assertEquals(CalendarDay("2026-11-08", 8, false), grid[41])
        // A month starting on Monday has no leading days.
        assertEquals("2026-06-01", CalendarRange.monthGrid(2026, 5)[0].key)
    }

    @Test
    fun DS_periodCalendar_pickTwoTaps() {
        var draft = RangeDraft("2026-10-01", "2026-10-20")
        draft = CalendarRange.pick(draft, "2026-03-03")
        assertEquals(RangeDraft("2026-03-03", null), draft)
        // Tapping before the start moves the start.
        draft = CalendarRange.pick(draft, "2026-02-10")
        assertEquals(RangeDraft("2026-02-10", null), draft)
        draft = CalendarRange.pick(draft, "2026-04-17")
        assertEquals(RangeDraft("2026-02-10", "2026-04-17"), draft)
        // Same day twice is a one-day range.
        assertEquals(RangeDraft("2026-05-05", "2026-05-05"), CalendarRange.pick(RangeDraft("2026-05-05", null), "2026-05-05"))
    }

    @Test
    fun DS_periodCalendar_insideBoundsAndSpan() {
        assertTrue(CalendarRange.inDraft(RangeDraft("2026-03-03", null), "2026-03-03"))
        assertFalse(CalendarRange.inDraft(RangeDraft("2026-03-03", null), "2026-03-04"))
        assertTrue(CalendarRange.inDraft(RangeDraft("2026-03-03", "2026-03-10"), "2026-03-10"))
        assertTrue(CalendarRange.outOfBounds("2026-10-21", null, "2026-10-20"))
        assertFalse(CalendarRange.outOfBounds("2026-10-20", "2026-01-01", "2026-10-20"))
        assertEquals(31, CalendarRange.span("2026-03-01", "2026-03-31", RangeGranularity.Day))
        assertEquals(4, CalendarRange.span("2025-11", "2026-02", RangeGranularity.Month))
        assertEquals("2027-01", CalendarRange.monthKey(2026, 12))
        assertEquals("2025-12", CalendarRange.monthKey(2026, -1))
    }

    @Test
    fun DS_periodCalendar_shortLabels() {
        assertEquals("3 mar – 17 ott", CalendarRange.shortLabel("2026-03-03", "2026-10-17", RangeGranularity.Day, BBLocale.IT_IT, 2026))
        assertEquals("20 dic 2025 – 6 gen 2026", CalendarRange.shortLabel("2025-12-20", "2026-01-06", RangeGranularity.Day, BBLocale.IT_IT, 2026))
        assertEquals("3 mar", CalendarRange.shortLabel("2026-03-03", "2026-03-03", RangeGranularity.Day, BBLocale.IT_IT, 2026))
        assertEquals("gen 2025 – dic 2025", CalendarRange.shortLabel("2025-01", "2025-12", RangeGranularity.Month, BBLocale.IT_IT, 2026))
        assertEquals(listOf("L", "M", "M", "G", "V", "S", "D"), CalendarRange.weekdayInitials(BBLocale.IT_IT))
        assertEquals("ottobre 2026", CalendarRange.monthTitle("2026-10", BBLocale.IT_IT))
        assertEquals("ott", CalendarRange.shortMonth(2026, 9, BBLocale.IT_IT))
    }
}
