# 2026-10-10 — Privacy, Termini e Cookie definitivi

Le tre pagine legali (`landing/content/legal.ts`) escono dallo stato di bozza: tolti avviso, `noindex`, segnaposto e il flag `LEGAL_DRAFT`; ora sono nella sitemap e in `llms.txt`. Titolare: Daniele Roccaforte, via Lancia 62, 10141 Torino, `privacy@buddybudget.io` (nessuna PEC).

- **Aggiunto rispetto alla bozza**: import CSV con AI (OpenRouter, ZDR, consenso esplicito art. 6.1.a, file cifrato e cancellato a fine elaborazione, anteprima 7 giorni), messaggi al supporto (Resend, casella `supporto@`), registro di accettazione, IP troncato, diritti (revoca del consenso, art. 12), obbligo di fornire i dati, codice AGPL, uso consentito, foro (consumatore: luogo di residenza; altrimenti Torino).
- **Cookie, nessun banner**: servono solo cookie tecnici (sessione, sicurezza di accesso), preferenze in localStorage e Umami self-hosted senza cookie, per statistiche aggregate di un solo sito (Linee guida Garante 10/6/2021, par. 5 e 7.2). Il fingerprinting (par. 3) non è usato da noi. Se si aggiunge uno strumento non tecnico (pubblicità, profilazione, analytics di terzi) il banner diventa obbligatorio.
- `LEGAL_VERSION` passa a `2026-10-10` (anche in `lib/legal/version.ts`): ogni utente accetta di nuovo al prossimo accesso. Alle clausole da approvare in modo specifico si aggiunge «Legge applicabile, foro e contatti» (deroga di foro, art. 1341 c.c.).
- **Retention dei log**: i testi dichiarano 30 giorni; Loki non aveva retention, la imposta la PR dell'infra (da unire prima di questa).
- Resta fuori: revisione di un professionista, DPA firmati con i fornitori (non verificabili dal codice), casella `privacy@`/`supporto@` da creare.
