# 2026-10-17 — One period selector with a real calendar

Every time-period choice (Panoramica, Liquidità chart and Analisi, Investimenti, Performance, security chart, dividend years, Analitiche) now uses `PeriodSelector` in `components/domain/shared`. Presets stay on one line that never wraps (it scrolls sideways as a last resort, e.g. many dividend years) and are 44 px tall on the phone. «Personalizzato» is no longer a long text segment: it is a calendar icon that opens a sheet (bottom sheet on the phone) with «Dal → Al», a day calendar (tap first and last day, arrows, title opens a month view to jump back) or a month grid for Analitiche, the reason a range is not valid, and «Applica». The chosen dates appear under the presets where the page does not already write them.

- Own calendar (`range-calendar.tsx`, `month-grid.tsx`, pure logic in `lib/calc/calendar-range.ts`) instead of react-day-picker + date-fns: no new dependency and full control of the tokens.
- Umami: `period_calendar_opened` and `period_range_applied` (surface, granularity, span as a count). The second `investment_chart_period_changed` with `custom` on every range change was removed; it now fires once when switching to the custom period.
- Deferred: two months side by side on desktop, typing a date by keyboard.
