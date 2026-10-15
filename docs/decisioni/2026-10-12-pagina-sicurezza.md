# «Sicurezza e privacy» ("Security and privacy") page and AI consent off by default (2026-10-12)

- **Why**: people who tried the app do not trust linking their bank and ask for privacy guarantees.
- **Decision**: new public page `/sicurezza` on the landing (data path with an interactive diagram, what is saved and what is not, controls, limits stated openly, official sources: PSD2, RTS SCA, GoCardless SAS/ACPR no. 17118, GDPR, Cloudflare R2). Copy in `landing/content/security.ts`, verified in the code and in the infra repo on 2026-10-12. The diagram and the sourced facts are also in the Security section of the home (whoever does not open the page still sees them). Linked from menu, footer, home, login note and the «Collega banca» ("Connect bank") flow.
- **Rule**: no promises that cannot be demonstrated (end-to-end or disk encryption, audits, certifications, rate limits on Redis). The point about open source appears only with `NEXT_PUBLIC_SOURCE_URL`.
- **AI consent in onboarding**: now off by default (previously on), because consent cannot be pre-selected (art. 7 GDPR) and the notice already says «spento finché non lo scegli» ("off until you choose it").
- **Umami event**: `security_node_selected` (landing), `cta_click` with `location: "sicurezza"`.
- **Postponed**: SSH key-only, development DB role with access to production data, `security.txt`, inactivity deletion in `execute`.

Same-day addition: two sections in `/sicurezza`, «Cosa tiene GoCardless» ("What GoCardless keeps": what it retains, what it uses it for, who it shares it with, timings, where, what happens if you unlink), summarized from the EU terms (art. 4) and GoCardless's privacy notice, and «Statistiche d'uso» ("Usage statistics": what Umami counts and what it never receives). GoCardless does not publish a number of years of retention: the page says so instead of inventing it.

Simplification (same day, testers' feedback: «troppe informazioni», "too much information"): on the home only the diagram, three sourced facts and the link remain; in `/sicurezza` diagram and table stay in view, the rest (GoCardless, statistics, deletion, limits) is in four collapsible questions. Open source is no longer presented as a security argument.
Open source: removed from the home the «Codice aperto» ("Open source") block and the fact in the header (to non-technical people «il codice è pubblico», "the code is public", sounds like an open door); the link at the bottom of the closing remains. The repository stays public: secrets and keys are not in the code and bank access is read-only.
