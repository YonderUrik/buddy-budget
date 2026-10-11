# 2026-10-11 — Email di supporto: support@buddybudget.io

- L'indirizzo di supporto passa da `supporto@buddybudget.io` a `support@buddybudget.io` (richiesta di Daniele): costante `SUPPORT_EMAIL` in `lib/support/constants.ts` (destinatario delle segnalazioni e testo dell'errore del form), messaggio d'errore di `/api/support`, `ACCESSIBILITY.md`.
- `SUPPORT_EMAIL_TO` resta l'override lato server; oggi non è impostata nel repo infra, quindi vale il default.
- Le voci precedenti del log (`2026-10-10-aiuto-e-segnalazioni.md`, `2026-10-10-privacy-termini-cookie.md`) restano com'erano: descrivono la decisione di allora.
- Fuori dal codice: creare la casella o l'alias `support@` dal provider email; decidere se tenere `supporto@` come inoltro per un periodo. `privacy@` invariato.
