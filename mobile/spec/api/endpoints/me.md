# Me (launch state for native clients)

Feature area(s): app launch / foreground routing (login → deactivated → accept terms → onboarding → home), country-gated tabs
Source: `app/api/me/bootstrap/route.ts`, `lib/account/bootstrap.ts` (`buildMeBootstrap`, `meBootstrapSchema`, `COUNTRY_SECTION_PATHS`), `lib/account/gates.ts` (`accountGate`, shared with `proxy.ts`)
Status: implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (gaps.md G1/G13 subset). Not merged yet.

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/me/bootstrap` | Everything the app needs at launch to route the signed-in user | session (Bearer or cookie) | **passes every account gate** (deactivated, legal, onboarding); not country-gated |

---

## GET /api/me/bootstrap

Route name: `me.bootstrap` · Auth: session required · Guards: none (the proxy lets it through the deactivated and
legal gates, like `/api/user/reactivate` and `/api/user/legal-acceptance`)

**Request**: no body, no query. `Authorization: Bearer <token>`.

**Response** `200`, `Cache-Control: no-store`. Validated on the server with `meBootstrapSchema` (zod).

```ts
interface MeBootstrap {
  user: { id: string; name: string; email: string; emailVerified: boolean; image: string | null };
  profile: {
    productCountry: "IT" | "DE";             // invalid stored values fall back to "IT"
    language: "it" | "en" | "de";            // falls back to the country's default when the pair is unsupported
    availableLanguages: ("it" | "en" | "de")[]; // COUNTRY_LANGUAGES[productCountry]: IT → ["it","en"], DE → ["en","de"]
    currency: string;                         // "EUR" | "USD" | "GBP" | "CHF"; "EUR" when unset
    homePage: string;                         // resolveHomePage: one of HOME_PAGE_OPTIONS (legacy values mapped), default "/panoramica"
    hideAmounts: boolean;
  };
  onboarding: { completed: boolean };
  legal: {
    currentVersion: string;                   // LEGAL_VERSION, currently "2026-10-12"
    acceptedVersion: string | null;
    acceptedAt: string | null;                // ISO 8601
    needsAcceptance: boolean;                 // acceptedVersion !== currentVersion (also true during onboarding)
  };
  account: {
    deactivated: boolean;
    deletionScheduledAt: string | null;       // ISO 8601: the date the account will be deleted
    readOnlyDemo: boolean;                    // public demo account: every write returns 403 { code: "demo_read_only" }
  };
  gate: "account_deactivated" | "legal_acceptance_required" | "onboarding_required" | null; // screen to show; null = app usable
  capabilities: {
    features: { taxes: boolean; pension: boolean; retirement: boolean; incomeForecasts: boolean; inflation: boolean }; // countryFeatures(country): engine capabilities
    sections: {                               // isCountryPathAvailable(country, path): what to show / call
      pension: boolean;            // "/pensione" (+ /api/pension)
      analytics: boolean;          // "/analitiche" (+ /api/analytics)
      goals: boolean;              // "/analitiche/obiettivi" (+ /api/goals)
      investmentTaxes: boolean;    // "/investimenti/tasse"
      investmentIncome: boolean;   // "/investimenti/proventi"
      fire: boolean;               // "/api/sidebar/fire"
      financialPlanning: boolean;  // "/api/financial-planning" and a planning model (false for IT since branch feat/mobile-api-foundations)
    };
  };
  session: { createdAt: string; expiresAt: string; recentLoginUntil: string }; // ISO; recentLoginUntil = createdAt + 10 min (export/reset/deactivate/delete)
}
```

`gate` follows the proxy's order exactly: `account_deactivated` (if `deletionScheduledAt` is set) →
`legal_acceptance_required` (only if onboarding is completed and the version differs) → `onboarding_required` (if
onboarding is not completed; new users accept the legal documents inside onboarding) → `null`.

**Example** (Italian user, everything accepted):

```json
{
  "user": { "id": "Xk2l9ZqP", "name": "Mario Rossi", "email": "mario@example.com", "emailVerified": true, "image": null },
  "profile": {
    "productCountry": "IT",
    "language": "it",
    "availableLanguages": ["it", "en"],
    "currency": "EUR",
    "homePage": "/panoramica",
    "hideAmounts": false
  },
  "onboarding": { "completed": true },
  "legal": {
    "currentVersion": "2026-10-12",
    "acceptedVersion": "2026-10-12",
    "acceptedAt": "2026-10-12T09:30:00.000Z",
    "needsAcceptance": false
  },
  "account": { "deactivated": false, "deletionScheduledAt": null, "readOnlyDemo": false },
  "gate": null,
  "capabilities": {
    "features": { "taxes": true, "pension": true, "retirement": true, "incomeForecasts": true, "inflation": true },
    "sections": {
      "pension": true,
      "analytics": true,
      "goals": true,
      "investmentTaxes": true,
      "investmentIncome": true,
      "fire": true,
      "financialPlanning": false
    }
  },
  "session": {
    "createdAt": "2026-10-18T08:00:00.000Z",
    "expiresAt": "2026-10-25T08:00:00.000Z",
    "recentLoginUntil": "2026-10-18T08:10:00.000Z"
  }
}
```

German user (`productCountry: "DE"`), same shape; only these parts differ:

```json
{
  "profile": { "productCountry": "DE", "language": "de", "availableLanguages": ["en", "de"] },
  "capabilities": {
    "features": { "taxes": false, "pension": false, "retirement": false, "incomeForecasts": false, "inflation": true },
    "sections": {
      "pension": false,
      "analytics": false,
      "goals": false,
      "investmentTaxes": true,
      "investmentIncome": true,
      "fire": false,
      "financialPlanning": true
    }
  }
}
```

Note: in DE `features.taxes` is `false` (the Italian tax engine is off) while `sections.investmentTaxes` is `true` (the
dedicated German tax screen, through `/api/financial-planning`). Use `sections` to decide what to show.

Legal-gated user (onboarded, accepted an older version): `"gate": "legal_acceptance_required"`,
`"legal": { "currentVersion": "2026-10-12", "acceptedVersion": "2026-07-01", "acceptedAt": "…", "needsAcceptance": true }`.

Deactivated user: `"gate": "account_deactivated"`,
`"account": { "deactivated": true, "deletionScheduledAt": "2026-11-17T00:00:00.000Z", "readOnlyDemo": false }`.

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | empty | no session, invalid or expired token |

**Mobile notes**

- Call it on launch and on foreground (after `GET /api/auth/get-session` if you also need the raw session, or instead
  of it). Route on `gate`; when `null`, open `profile.homePage` mapped to a native tab, and hide tabs whose
  `capabilities.sections.*` is `false`.
- Any proxy 403 with `code: "account_deactivated"` or `"legal_acceptance_required"` mid-session → refetch this endpoint
  and re-route.
