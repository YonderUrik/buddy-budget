# Import Fineco (2026-10-08)

- Nuovo provider «Fineco» nell'import Investimenti: legge l'export Excel «Movimenti Dossier Titoli» (anche in CSV), che è uno **storico di operazioni**, non una lista di posizioni. Importa acquisti e vendite (Segno A/V, data operazione, commissioni «amministrato»); dividendi e cedole se la descrizione li indica; ogni altra riga è ignorata con un messaggio nell'anteprima. Non importa saldi né liquidità.
- Implementazione: il foglio `.xlsx` si legge nel browser (`readXlsx` della Pensione), si pulisce in una tabella neutra (`lib/investments/import/fineco.ts`) e passa dalla mappatura/anteprima generica; nessun cambiamento server.
- Da verificare con file reali: il file d'esempio conteneva solo acquisti in EUR; il trattamento di vendite, dividendi e titoli in valuta estera è dedotto dalle intestazioni.
- Logo: fornito dal proprietario (`public/import-providers/fineco.png`), marchio di FinecoBank usato solo per indicare la fonte del file.
- Osservabilità: evento Umami `investments_import_file_read` con `provider: "fineco"` e `investments_imported` con `format: "fineco"`; nessuna nuova metrica.
