# 2026-10-10 — Aiuto e segnalazioni

Pagina `/aiuto` raggiungibile dal menu dell'avatar (non dalla sidebar, per non occupare navigazione con una funzione usata di rado): risposte rapide, form «Scrivici» (problema / domanda / idea) e collegamenti a GitHub (issue precompilata, segnalazioni aperte, release, policy di sicurezza).

- Il form invia un'email a `supporto@buddybudget.io` (`SUPPORT_EMAIL_TO` per cambiarla) con reply-to sull'utente, via Resend; limite di 5 segnalazioni l'ora per utente su Redis; codice di riferimento `SUP-XXXXXX`.
- Contesto allegato (si può togliere ed è mostrato prima dell'invio): pagina senza query, versione app, schermo, tema, user agent. Nessun dato finanziario; testo ed email non finiscono nei log.
- Scartato: chatbot con AI (costi, rischio di risposte sbagliate su temi fiscali, testo inviato a un fornitore esterno). Da rivalutare con segnalazioni reali. Scartata anche la creazione automatica di issue dal form: le segnalazioni private diventerebbero pubbliche.
- Rimandato: pannello Grafana e alert sull'invio fallito (la metrica `buddybudget_support_reports_total` c'è, l'utente vede l'errore); FAQ lette da un'unica fonte con la landing.
