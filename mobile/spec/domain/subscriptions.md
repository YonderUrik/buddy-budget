# Subscriptions (Abbonamenti) and category colors

Sources: `lib/calc/subscriptions.ts`, `lib/subscriptions/view.ts`, `lib/subscriptions/data.ts`, `lib/calc/distribute-colors.ts`, `lib/validation/shared-colors.ts`. Vectors: [`vectors/subscriptions.json`](vectors/subscriptions.json), [`vectors/category-colors.json`](vectors/category-colors.json).

## Where it runs today

**Server-side.** `GET /api/subscriptions` loads 26 months of expenses, runs `detectSubscriptions`, merges the user's saved decisions (`buildSubscriptionsView`) and adds merchant logos. The client components (`components/domain/subscriptions/*`) import only types, `CADENCE_LABELS` and `SUBSCRIPTION_CADENCES`.

**Mobile only displays this data.** It must not port the detection engine. The specification below is reference material so the UI copy ("reasons") and edge states are understood, plus the two small helpers mobile may use for optimistic UI.

## Cadences (`CADENCE_RULES`)

| cadence | gap window (days) | min charges | amount spread | months | grace days | per month |
|---|---|---|---|---|---|---|
| settimanale | 6–8 | 5 | 0.08 | 0 | 3 | 52/12 |
| mensile | 27–34 | 3 | 0.08 | 1 | 7 | 1 |
| trimestrale | 86–96 | 3 | 0.15 | 3 | 14 | 1/3 |
| semestrale | 174–190 | 3 | 0.25 | 6 | 21 | 1/6 |
| annuale | 355–376 | 2 | 0.25 | 12 | 30 | 1/12 |

Labels (catalog keys): "ogni settimana", "ogni mese", "ogni 3 mesi", "ogni 6 mesi", "ogni anno".

## Helpers mobile may need
- `monthlyEquivalent(amount, cadence) = round2(amount × perMonth)`
- `addMonthsIso(iso, months, day = iso.day)`: target month, with the day clamped to the month's length (UTC arithmetic).
- `nextChargeDate(last, cadence, day?)`: weekly adds 7 days; otherwise `addMonthsIso(last, months, day)`.

## Detection (server reference)
1. Expenses with `amount > 0` are grouped by `subscriptionKey(description)`. This is `merchantKey` (normalized lowercase, with noise tokens and company suffixes removed) minus every token that contains a digit.
2. For each series sorted by date, every cadence is tried from most to least frequent. A cadence is accepted when:
   - every gap falls in the cadence window, or in the "skipped once" window `[2·min−2, 2·max+2]`;
   - there is at most 1 skip;
   - there are at least 2 regular gaps (at least 1 for annual);
   - for month-based cadences, the day of month is within ±5 of the median (days ≥ 28 count as 29, with wrap-around);
   - the amount spread `(max−min)/median` is within tolerance, or there is exactly one clean price step with a ratio in [0.5, 2].
3. If the whole series fails, it is split into clusters by amount (±1% of the cluster median). A cluster needs at least 3 charges, and other charges from the same merchant must not exceed `5×cluster + 2`. The cluster key is `key#median.toFixed(2)`.
4. The candidate is built as follows:
   - `nextDate` = next charge from the last one, using the typical day (median day rounded).
   - `overdueDays = max(0, today − nextDate)`.
   - `state = overdue > graceDays ? "fermo" : "attivo"`.
   - The candidate is dropped when the last charge is more than 400 days ago.
   - `confidence = min(1, 0.45 + 0.07·min(n,6) + (exact ? 0.15 : 0.05) + (no skip ? 0.1 : 0) − (price change ? 0.05 : 0))`, rounded with round2. Candidates below 0.6 are hidden.
   - The result is sorted by `nextDate` ascending.

## View (server reference; mobile renders it)
- Detected and saved rows are merged by `key`. Saved-only rows: a **manual** row's `nextDate` is rolled forward by cadence until `today − next ≤ graceDays` (at most 600 steps). A non-manual row that is no longer detected becomes `fermo`.
- Sort: `nextDate` ascending, with null last.
- `totals.count/monthly` cover **confirmed and active** items. `yearly = round2(monthly·12)`. `pendingCount/pendingMonthly` cover active items still `da-confermare`.
- `upcomingCharges`: confirmed, active, and `nextDate − today ≤ 30` days (late ones included).
- `recentPriceRises`: `priceChange.to > from`, the decision is not `escluso` or `terminato`, and `since` is within 365 days.

## Category / account colors
Colors are stored as **names**, not hex. The pool is `SWATCH_COLORS` (48 entries): 16 base colors (`slate, blue, green, yellow, purple, orange, red, teal, pink, indigo, cyan, lime, amber, rose, violet, emerald`), then their `-light` variants, then their `-dark` variants. Pickers show only the 16 base colors. The name → hex map lives in `design/tokens.md`. `distributeColors(ids)` (server, `POST /api/categories/distribute-colors`) assigns `SWATCH_COLORS[i % 48]`. When that equals the previous id's color it uses `[(i+1) % 48]` instead.

The special stack color `"altro"` (expenses.md) maps to a neutral token (`--muted-foreground`) in charts.

## Golden vectors (excerpt)

| id | input | expected |
|---|---|---|
| subs.monthlyEquivalent.settimanale | 12, weekly | 52 |
| subs.monthlyEquivalent.annuale | 99, annual | 8.25 |
| subs.nextChargeDate.2026-01-31.mensile.- | | 2026-02-28 |
| subs.nextChargeDate.2024-02-29.annuale.- | | 2025-02-28 |
| subs.subscriptionKey.PAGAMENTO POS NETFLIX.COM 12/10 CARTA 1234 | | "netflix com" |
| subs.detect.mixed | Netflix ×5, gym ×2 annual, supermarket ×3 variable, Disney ×3 stopped in May, today 2026-10-16 | Disney: mensile, fermo, next 2026-06-05, conf 0.91 · Netflix: mensile, attivo, next 2026-11-12, conf 0.95 (12.99→13.99 is within the 8% spread, so no price change) · Gym: annuale, next 2027-10-02, conf 0.74 · supermarket rejected |
| subs.view | + confirmed Netflix + manual "Box auto" 80/month from 2026-07-01 | totals: count 1, monthly 80, yearly 960, pendingCount 2, pendingMonthly 48.99 |
