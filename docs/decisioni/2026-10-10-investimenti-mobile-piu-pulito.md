# Investimenti (Investments) on mobile: less noise, period below the charts, broker comparison removed

**Date**: 2026-10-10

- On mobile (< 640 px) in the Portfolio the chart immediately follows value and daily change; the reading in words, the bar and the «Rimetti costi/imposte» ("Put costs/taxes back") toggles move below the chart and the period selector. On desktop nothing changes.
- In Performance, on mobile (< 1024 px) the period selector sits below the charts (before the heatmap); on desktop it stays at the top.
- Removed «Confronto tra broker» ("Broker comparison": card, `lib/investments/broker-comparison.ts`, `overlay` state, Umami event `investment_broker_overlay_changed`, tests). The «Broker inclusi» ("Included brokers") filter remains. No impact on catalog and landing.
