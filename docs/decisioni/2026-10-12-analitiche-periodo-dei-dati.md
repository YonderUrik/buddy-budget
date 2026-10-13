# Analitiche: periodo dei dati scelto dall'utente

Data: 2026-10-12

- Sopra i cursori si sceglie il periodo da cui vengono risparmio, spesa e rendimento: ultimi 12 mesi (default), ultimi 24 o mesi a scelta (da 3 mesi a 10 anni). Vale per tutta la pagina e per il modulo FIRE della sidebar, si salva nelle ipotesi (campo `dataPeriod` nel JSON, nessuna migration). Supera la regola «24 mesi, altrimenti 12» del rendimento.
- Solo mesi interi: il mese in corso non conta mai. Spesa e risparmio sono la media mensile × 12 dal primo mese con movimenti (prima erano la somma dei 12 mesi, che sottostimava chi registra da poco); giroconti e parti escluse con «Dividi» restano fuori come nel resto dell'app.
- Il rendimento usa lo stesso periodo (gli ultimi N mesi fino a oggi, o i mesi scelti), da quando si investe se è dopo; serve almeno un anno, sotto resta il 4% prudente con il motivo.
- Sotto i cursori di risparmio e spesa: «Dai tuoi dati» o «Inserito a mano» con «Usa i tuoi dati (cifra)»; per il rendimento la riga esistente con le stesse parole. Con meno di 3 mesi di movimenti la cifra si scrive a mano come prima.
- Corretto anche: il modulo FIRE della sidebar non usava il rendimento dallo storico e non si aggiornava salvando le ipotesi.
- Osservabilità: log `analytics.data_period.changed`; eventi Umami `analytics_period_changed`, `analytics_figure_reset_to_data`, `analytics_cashflow_source_shown` e `storico-personalizzato` in `analytics_return_source_shown`.
- Rimandato: periodo diverso per ciascuna cifra, money-weighted.
