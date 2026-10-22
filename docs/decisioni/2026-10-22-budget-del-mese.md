# 2026-10-22 — Budget of the month: proposals, rollover, one-month amounts

- **Problem**: the budget was one monthly amount per category, a bar in Analisi and an email at 80% and 100%. No carrying over, no plan for the month, nothing proposed: thin for people looking for a budgeting method (the analysis of 2026-10-22).
- **Decision**: a **Budget** tab in Liquidità (`/liquidita/budget`). It opens on «Puoi ancora spendere», the money per day to the end of the month, a tick where spending should be today and usual income − budgets; each category says what is left and, from the usual rest of the month, «a questo ritmo arrivi a …».
- **The app decides first**: budgets are proposed from the user's own months (median month for Dovute and Volute, a twelfth of the year for Saltuarie) and accepted with one tap; rollover is on by itself for Saltuarie. «Copia il mese scorso» is not needed (a budget repeats every month); «Cifra diversa solo a <mese>» covers the month known to be different.
- **Not done on purpose**: YNAB-style envelopes (assigning every euro by hand each month is the opposite of «asks less»); the income − budgets line gives the gist.
- **Data**: migration 0049 (`budgets.rollover`, `rollover_from`, `budget_months`); changing an amount keeps the past months' amount. Alerts, the monthly summary and Panoramica read the same month (carried leftover included).
- **Signals**: logs `budget.monthly.saved` (`outcome` created/updated), `budget.proposals.accepted` (`count`); Umami `budget_proposals_accepted`, `budget_rollover_toggled`, `budget_single_month_set`, `liquidity_tab_viewed{tab:budget}`.
- **Deferred**: Analisi still scales the standing amount to the period; a budget for «Te futuro» as a savings target is left to Obiettivi.
