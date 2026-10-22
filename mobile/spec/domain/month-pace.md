# Month pace and the Panoramica "voice"

Sources: `lib/calc/month-pace.ts`, `lib/overview/voice.ts`. Vectors: [`vectors/month-pace.json`](vectors/month-pace.json), [`vectors/overview-voice.json`](vectors/overview-voice.json).

## Where it runs today

**Client-side.** `computeMonthPace` runs in `app/(app)/panoramica/page.tsx`, `app/(app)/liquidita/page.tsx`, `liquidita/analisi/page.tsx`, `components/domain/liquidity/liquidity-overview.tsx` and `components/domain/overview/month-pace-chart.tsx`. `buildVoiceLines` runs in `components/domain/overview/overview-voice.tsx`. All of them work on raw transactions from the current month and the previous 3 months.

Recommendation: return `MonthPace` (and the voice lines already translated) from a `GET /api/overview/month-pace` endpoint. It is cheap to compute and removes the need to download 4 months of transactions on the phone.

## `computeMonthPace(transactions, budgets, today)`

Constant: `MONTH_PACE_LOOKBACK = 3`.

```
day        = startOfDay(today);  monthStart = startOfMonth(day)
elapsed    = [monthStart, day]
spentSoFar = computeSummary(txs, elapsed).speseEffettive
income     = computeIncomeSummary(txs, elapsed).entrateEffettive
daysInMonth = endOfMonth(day).day

for back in 1...3:
   from    = addMonths(monthStart, −back)        // always the 1st, so there is no overflow
   lastDay = daysInMonth(from)
   to      = Date(from.y, from.m, min(day.day, lastDay))
   if computeSummary(txs, [from, endOfMonth(from)]).uscite > 0:      // that month has any expense
        past.append(computeSummary(txs, [from, to]).speseEffettive)
        curve = cumulativeByDay(txs, from, lastDay)
        pastCurves.append( [ curve[min(i, lastDay−1)] for i in 0..<daysInMonth ] )   // pad short months with their last value
typicalSoFar = past.isEmpty ? null : mean(past)
typical      = pastCurves.isEmpty ? null : element-wise mean over pastCurves (length daysInMonth)
budgetTotal  = budgets.isEmpty ? null : Σ monthlyAmount
budgetSpent  = computeSummary(txs in budgeted categories, elapsed).speseEffettive
current      = cumulativeByDay(txs, monthStart, day.day)          // length = day of month
```

`cumulativeByDay(txs, monthStart, lastDay)` keeps transactions with `amount < 0` in that month whose `day ≤ lastDay`. For each one it adds `|amount| − |excludedAmount|` to `perDay[day−1]`, then takes the running sum. No rounding is applied.

The UI ("Ritmo del mese" chart) draws `current` (solid) against `typical` (dashed) with an x-axis of `1…daysInMonth`.

## `buildVoiceLines({language, pace, monthLabel, currency, nextDue, today})`

Constants: `VOICE_PACE_TOLERANCE = 0.05`, `VOICE_DUE_HORIZON_DAYS = 14`.

The function returns `VoiceLine[]`. Each line has a `key` (`"pace"` or `"due"`) and an array of `segments {text, strong?}`. Strong segments are rendered with emphasis: font-weight 600, color `foreground`.

Money is formatted with `formatCurrency(n, currency, {locale, maximumFractionDigits: 0})`, i.e. **no decimals**.

1. **Pace line** (always present):
   - If `typicalSoFar == null`, use `"{month}: finora hai speso "` + **money(spent)** + `"."`.
   - Otherwise compute `diff = spent − typical` and `tol = max(typical × 0.05, 1)`:
     - `|diff| ≤ tol`: `"{month} procede in linea con il solito: "` + **money(spent)** + `" spesi."`
     - else: `"{month} è partito sopra|sotto il solito: "` + **money(spent)** + `" spesi, "` + **`"{amount} in più|in meno"`** + `" della tua media a questo punto."`
   - `{month}` is `monthLabel` with only its first letter uppercased.
2. **Due line**:
   - `days = round((nextDue.date@00:00 local − today@00:00 local)/86 400 000)`.
   - The line is shown only if `days ≤ 14`, including negative values (overdue).
   - The `when` text is `"è scaduta"` if `days < 0`, `"scade oggi"` if `days == 0`, otherwise `"scade il {date}"` with `{date}` = `d MMMM`.
   - Full line: `"La rata {name} {when}: "` + **money(amount)** + `"."`.

All the quoted strings are catalog keys (Italian source). Translate them through the shared catalog (see formatting-localization.md); placeholders are replaced after translation.

The greeting (`greetingFor(hour)`) is "Buongiorno" before 12, "Buon pomeriggio" before 18, otherwise "Buonasera".

## Golden vectors (excerpt)

| id | expected (abridged) |
|---|---|
| monthPace.oct16 | spentSoFar 147.55, typicalSoFar 135.25, income 2620, budgetTotal 450, budgetSpent 147.55, dayOfMonth 16, daysInMonth 31, current[2]=55.25, current[15]=147.55 |
| monthPace.oct02 | spentSoFar 0, typicalSoFar 45.25, current [0,0] |
| monthPace.noHistory | typicalSoFar null, typical null, budgetTotal null |
| monthPace.clampShortMonth | today 2026-03-30 → typicalSoFar 14 (Feb clamped to day 28 = 28; Jan to day 30 = 0), typical[30] = 29.5 |
| voice.it.2026-10-16 | "Ottobre è partito sopra il solito: " **"148 €"** " spesi, " **"12 € in più"** " della tua media a questo punto." · "La rata Auto scade il 20 ottobre: " **"250 €"** "." |
| voice.en.2026-10-16 | "October started above your usual spending: " **"€148"** " spent, " **"€12 more"** … |
| voice.inline | 102 vs 100 → "in linea"; due date in the past → "è scaduta" |
