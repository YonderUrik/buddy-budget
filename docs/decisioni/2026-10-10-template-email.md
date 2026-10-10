# Template unico per le email (2026-10-10)

Decisione: tutte le email transazionali (link di accesso, account disattivato/eliminato, collegamento bancario in scadenza/scaduto, avviso di prezzo, esito import CSV) usano `lib/email/renderEmail`, che produce HTML a tabelle con CSS inline più la versione testo.
Stile: proposta C scelta da Daniele, la frase narrativa della Panoramica (Space Grotesk, cifre in grassetto), bottone con bordo, tema scuro via `prefers-color-scheme`.
Logo e font sono file pubblici in `public/brand/email/` serviti dall'app (il logo è un PNG perché gli SVG non sono supportati da Gmail); i client che ignorano i font web usano Arial/Helvetica.
Perché `EMAIL_COLORS` contiene esadecimali: le CSS variables non esistono nei client email, i valori ricalcolano i token di `app/globals.css`.
Rimandato: anteprima delle email in Impostazioni o in una pagina di sviluppo, prova su client reali (Gmail, Outlook, Apple Mail).
