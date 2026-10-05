# 2026-10-05 — Debiti ridisegnata: "Priorità e azioni", Simulatore dentro i finanziamenti

- **Scelta**: tra tre prototipi (A elenco e dettaglio, B grafico nel tempo, C priorità e azioni) Daniele ha scelto C. Prototipi e confronto in `/mnt/project-files/debiti/proposte/` del progetto Claude.
- **Panoramica** (`/debiti`, niente più schede): prossime rate con "Segna pagata" senza entrare nel debito, "Dove paghi di più" (interessi di un anno al saldo e al tasso di oggi, per debito), "Come uscirne prima" (slider extra al mese, valanga, percorso a tappe con data libera e interessi risparmiati) ed elenco dei debiti.
- **Il Simulatore non è più una pagina**: `/debiti/simulatore` rimanda a `/debiti/finanziamenti`. Surroga, extra mensile ed estinzione stanno in "E se…" nel dettaglio del finanziamento; "Se l'indice sale" nel dettaglio della linea di credito; la valanga in panoramica. La palla di neve non è più esposta (nei casi tipici coincide con la valanga); il motore `simulatePayoff` la supporta ancora.
- **Dettaglio** (`/debiti/finanziamenti?id=`, `/debiti/lombard?id=`): anello di avanzamento con residuo e cifre chiave; senza `id` si apre il primo.
- Eventi Umami nuovi: `debt_simulation_opened` (`kind`: extra, estinzione, surroga) e `debt_exit_plan_used`.
- Rimandato: confronto delle strategie (valanga/palla di neve) in panoramica, piano rata per rata letto anno per anno (scelta B) e grafico del residuo nel tempo. Il seed demo ha ora tre finanziamenti (prima uno).
