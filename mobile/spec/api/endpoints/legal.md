# Legal metadata

Feature area(s): Onboarding (legal step); "Accept updated Terms" gate screen; Settings → Data & privacy (document links)
Source: `app/api/legal/route.ts`, `lib/legal/meta.ts` (`legalMeta`, `legalMetaSchema`), `lib/legal/version.ts`, `lib/legal/links.ts`
Status: implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (auth.md R7a, gaps.md G1). Not merged yet.

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/legal` | Current legal version, clauses to approve specifically, document links | **public** (no session) | in `PUBLIC_PATH_PREFIXES`: works before sign-in and while legal-gated |

---

## GET /api/legal

Route name: `legal.get` · Auth: none · Guards: none

**Query**

| Param | Type | Notes |
|---|---|---|
| `language` | `"it" \| "en" \| "de"` (optional) | Language of `label` and `specificClauseSections`. Invalid or missing → derived from `Accept-Language` (most preferred supported language; unsupported only → `en`; no header → `it`). |

**Response** `200`

Headers: `Cache-Control: public, max-age=3600`, `Vary: Accept-Language`.

```ts
interface LegalMeta {
  version: string;                 // LEGAL_VERSION, currently "2026-10-12"
  language: "it" | "en" | "de";    // language the labels are in
  specificClauseSections: string[]; // sections of the Terms approved specifically (art. 1341 c.c.), localized
  documents: { id: "privacy" | "termini" | "cookie"; label: string; url: string }[]; // url = absolute https on the landing
  privacyEmail: string;            // "privacy@buddybudget.io"
}
```

Example: `GET /api/legal?language=en`

```json
{
  "version": "2026-10-12",
  "language": "en",
  "specificClauseSections": [
    "Liability",
    "Suspension and termination",
    "Changes to the terms",
    "Governing law, jurisdiction and contacts"
  ],
  "documents": [
    { "id": "privacy", "label": "Privacy", "url": "https://buddybudget.io/privacy" },
    { "id": "termini", "label": "Terms", "url": "https://buddybudget.io/termini" },
    { "id": "cookie", "label": "Cookies", "url": "https://buddybudget.io/cookie" }
  ],
  "privacyEmail": "privacy@buddybudget.io"
}
```

With `?language=it` the labels are `"Privacy"`, `"Termini"`, `"Cookie"` and the sections are the Italian source strings
(`"Responsabilità"`, `"Sospensione e chiusura"`, `"Modifiche ai termini"`, `"Legge applicabile, foro e contatti"`).
German: `"Datenschutz"`, `"Nutzungsbedingungen"`, `"Cookies"`.

The document base URL is the server's `NEXT_PUBLIC_LANDING_URL` (default `https://buddybudget.io`); self-hosted servers
may return another host. The document text is not served by the API: open `url` in a browser / in-app web view.

**Errors**: none expected (no input validation can fail). `500 { "error": "Errore interno" }` only on a server bug.

**Mobile notes**

- Send `version` exactly as received in `POST /api/user/onboarding` (`legal.version`) and
  `POST /api/user/legal-acceptance` (`version`); the server rejects any other value with 400.
- The legal-gate 403 also carries the version (`{ "code": "legal_acceptance_required", "version": "2026-10-12" }`), and
  `GET /api/me/bootstrap` returns `legal.currentVersion`; this endpoint is still the source for labels, clause names
  and URLs.
