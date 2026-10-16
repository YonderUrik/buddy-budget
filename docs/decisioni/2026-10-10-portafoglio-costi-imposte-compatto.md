# 2026-10-10 — Portafoglio (Portfolio): «Costi e imposte» ("Costs and taxes") in a button, tabs without scrollbar

- The «e se costi e imposte fossero rimasti investiti?» ("what if costs and taxes had stayed invested?") simulation is no longer a block of text with two toggles below the chart: it is the «Costi e imposte» button next to the period selector, which opens a popover with the same two toggles. Default: simulation off. With the simulation on, the button is tinted and shows «· 1/2»; the «Simulazione · +X €» row below the amount remains.
- Umami event `investment_reinvest_toggled` unchanged.
- Section tabs and account chips scroll sideways without drawing the scrollbar (`.scrollbar-hidden`, also `overflow-y: hidden`): on narrow windows the horizontal scrollbar of the tabs added to the page's vertical one.
- Not reproduced with demo data: a second nested vertical scrollbar. If it persists, a screenshot/browser is needed to locate it.
