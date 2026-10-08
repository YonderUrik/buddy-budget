# Pensione nello stile della Panoramica

Data: 2026-10-08

- Tutta la sezione Pensione (pagina, cinque schede, form, dialog di import CSV/Excel, stato vuoto) adotta lo stile standard di Panoramica e Liquidità: importo grande con decimali attenuati, grafici a tutta larghezza, sezioni aperte con icona tinta, niente riquadri grigi.
- Riusati `SectionTitle`, `MoneyHero` e `InfoHint`; l'unico componente nuovo è `PensionSection` (titolo + descrizione + suggerimento), per non ripetere la stessa intestazione in otto schede. L'anello e le card di riepilogo sono sostituiti da `PensionHero` e `PensionInsights`.
- Nel dialog di import ogni passo è diviso in sotto-sezioni con lo stesso titolo (Scegli il file, Colonne, Anteprima, Cosa cambia).
- Solo presentazione: nessun cambio a calcoli, dati, eventi Umami, log o migration.
- Screenshot prima/dopo nella cartella `pensione-stile/` del progetto. Rimandato: il form «Aggiorna i valori» resta in pagina (non diventa un dialog).
