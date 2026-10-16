# Single template for emails (2026-10-10)

Decision: all transactional emails (sign-in link, account deactivated/deleted, bank connection expiring/expired, price alert, CSV import outcome) use `lib/email/renderEmail`, which produces table-based HTML with inline CSS plus the text version.
Style: proposal C chosen by Daniele, the narrative sentence of the Panoramica (Space Grotesk, figures in bold), outlined button, dark theme via `prefers-color-scheme`.
Logo and fonts are public files in `public/brand/email/` served by the app (the logo is a PNG because SVGs are not supported by Gmail); clients that ignore web fonts use Arial/Helvetica.
Why `EMAIL_COLORS` contains hex values: CSS variables do not exist in email clients, the values mirror the tokens of `app/globals.css`.
Postponed: email preview in Impostazioni or in a development page, test on real clients (Gmail, Outlook, Apple Mail).
