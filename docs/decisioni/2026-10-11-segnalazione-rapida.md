# 2026-10-11 — Segnalazione rapida: «Scrivici» ovunque e «Segnala questo problema» sotto gli errori

- Scelta di Daniele tra tre strade (solo pulsante, solo dagli errori, tutte e due): **tutte e due**. Un solo foglio (`QuickReportProvider` in `app/(app)/layout.tsx`) con il form «Scrivici» compatto, aperto dal pulsante in fondo alla sidebar e dall'icona in alto a destra su telefono, oppure dal link sotto un errore.
- Dal link d'errore la segnalazione porta con sé l'operazione fallita (enum chiuso `REPORT_ERROR_AREAS`) e il messaggio mostrato all'utente (max 300 caratteri), il tipo è fisso su «problema». Agganciato a: import dei movimenti e degli investimenti, sync e collegamento della banca, aggiunta di movimento, operazione, conto, debito, abbonamento e fondo pensione, `LoadError` e i toast d'errore (`errorToast` in `lib/support/request-report.ts`, azione «Segnala»).
- Pagina Aiuto riordinata: form in cima, risposte rapide sotto, GitHub in fondo. La voce «Aiuto e segnalazioni» del menu avatar e di «Altro» resta.
- Osservabilità: log `support.report.sent` con `reportSource` (pagina, pulsante, errore) e `reportArea`; Umami `support_sheet_opened` e `support_report_sent` con `source`/`area`. Metriche invariate.
- Rimandati: allegare uno screenshot alla segnalazione, risposte dentro l'app (oggi solo email), link anche sugli errori dei form di modifica.
