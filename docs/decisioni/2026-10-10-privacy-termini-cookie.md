# 2026-10-10 — Final Privacy, Terms and Cookie pages

The three legal pages (`landing/content/legal.ts`) leave draft status: notice, `noindex`, placeholders and the `LEGAL_DRAFT` flag removed; they are now in the sitemap and in `llms.txt`. Controller: Daniele Roccaforte, via Lancia 62, 10141 Torino, `privacy@buddybudget.io` (no PEC, Italian certified email).

- **Added compared with the draft**: CSV import with AI (OpenRouter, ZDR, explicit consent art. 6.1.a, file encrypted and deleted at the end of processing, preview 7 days), messages to support (Resend, `supporto@` mailbox), acceptance record, truncated IP, rights (withdrawal of consent, art. 12), obligation to provide data, AGPL code, permitted use, jurisdiction (consumer: place of residence; otherwise Turin).
- **Cookies, no banner**: only technical cookies are needed (session, sign-in security), preferences in localStorage and self-hosted Umami without cookies, for aggregate statistics of a single site (Garante guidelines of 10/6/2021, par. 5 and 7.2). Fingerprinting (par. 3) is not used by us. If a non-technical tool is added (advertising, profiling, third-party analytics) the banner becomes mandatory.
- `LEGAL_VERSION` moves to `2026-10-10` (also in `lib/legal/version.ts`): every user accepts again at the next sign-in. To the clauses requiring specific approval is added «Legge applicabile, foro e contatti» ("Applicable law, jurisdiction and contacts": jurisdiction derogation, art. 1341 of the Italian Civil Code).
- **Log retention**: the texts state 30 days; Loki had no retention, the infra PR sets it (to be merged before this one).
- Left out: review by a professional, DPAs signed with the providers (not verifiable from the code), `privacy@`/`supporto@` mailboxes to create.
