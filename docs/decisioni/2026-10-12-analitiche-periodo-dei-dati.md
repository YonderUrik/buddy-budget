# Analitiche (Analytics): data period chosen by the user

Date: 2026-10-12

- Above the sliders you choose the period from which savings, spending and return come: last 12 months (default), last 24 or chosen months (from 3 months to 10 years). It applies to the whole page and to the sidebar FIRE module, and is saved in the assumptions (`dataPeriod` field in the JSON, no migration). It supersedes the «24 mesi, altrimenti 12» ("24 months, otherwise 12") rule for the return.
- Whole months only: the current month never counts. Spending and savings are the monthly average × 12 from the first month with transactions (previously they were the sum of the 12 months, which underestimated recent users); transfers and parts excluded with «Dividi» ("Split") stay out as in the rest of the app.
- The return uses the same period (the last N months up to today, or the chosen months), from when investing started if later; at least one year is needed, below that the prudent 4% remains with the reason.
- Below the savings and spending sliders: «Dai tuoi dati» ("From your data") or «Inserito a mano» ("Entered by hand") with «Usa i tuoi dati (cifra)» ("Use your data (figure)"); for the return the existing row with the same words. With fewer than 3 months of transactions the figure is typed by hand as before.
- Also fixed: the sidebar FIRE module did not use the historical return and did not update when saving the assumptions.
- Observability: log `analytics.data_period.changed`; Umami events `analytics_period_changed`, `analytics_figure_reset_to_data`, `analytics_cashflow_source_shown` and `storico-personalizzato` in `analytics_return_source_shown`.
- Postponed: a different period for each figure, money-weighted.
