# 2026-10-10 — Audit SEO: correzioni tecniche della landing

Dall'audit di buddybudget.io del 10 ottobre (solo le voci con controlli falliti):
- **4xx (1) e link interni rotti (2)**: l'indirizzo `privacy@buddybudget.io` nel testo di Privacy e Termini veniva sostituito da Cloudflare con `/cdn-cgi/l/email-protection`, che per un crawler senza JavaScript è un 404. Ora è un link `mailto:` racchiuso in `<!--email_off-->` (`components/legal-page.tsx`).
- **Dati strutturati (13)**: `SoftwareApplication` (layout, su ogni pagina) e `WebApplication` (due calcolatori) richiedono `aggregateRating` o `review`, che non abbiamo e non inventiamo: tolti. Restano `Organization` e `WebSite` ovunque, `FAQPage` solo nella home (dove le domande sono visibili), `WebPage` sui calcolatori.
- **h1 uguale al title (1)**: la guida sullo zainetto ha un title proprio.
- **HSTS (2)**: header in `landing/nginx.conf` e `_headers` (apice); middleware Traefik `hsts` nel repo infra per il redirect di `www`.
- **Rimandati / non risolvibili qui**: robots.txt «formato non valido» (la riga `Content-Signal` è nella specifica contentsignals.org e ignorata dai parser conformi a RFC 9309: si tiene), «poco testo rispetto all'HTML» (il payload RSC di Next pesa ~22 KB per pagina) e «poche parole» (`/schermate`, `/funzioni/investimenti`): servono testi, in capo al lavoro sul copy della landing.
