# App metadata and what's new

Feature area(s): app bootstrap before and after sign-in, onboarding (currencies, country/language pairs, category
proposal, notification defaults), Settings (home pages), feature gating, About (server build), Overview «Novità» card
Source: `app/api/meta/route.ts`, `app/api/whats-new/route.ts`, `lib/views/meta.ts` (`buildAppMeta`, `buildWhatsNew`,
pure), `appMetaSchema` / `whatsNewSchema` in `lib/views/schemas.ts`
Status: implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (gaps.md **G13**, **G14**). Not merged yet.

Every value comes from the module the web imports (`lib/localization/config.ts`, `planning-availability.ts`,
`lib/validation/currency.ts`, `lib/account/home-pages.ts`, `lib/notifications/constants.ts`, the limits' own modules,
`lib/features/catalog.ts`, `lib/localization/categories.ts`, `lib/legal/meta.ts`, `lib/app-version`,
`lib/whats-new/*`). Ship nothing of this as app constants.

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/meta` | Constants, country capabilities, catalog, legal, server build | **public**; session-aware | signed out: `Cache-Control: public, max-age=3600`, `Vary: Accept-Language`; with a session: `private, no-cache` |
| GET | `/api/whats-new` | «Novità» entries for the user's country and language | session | dismissals stay on the device |

---

## GET /api/meta

Route name: `meta.get`. Public (proxy `PUBLIC_PATH_PREFIXES`), works before sign-in and through every gate.

**Query params**

| Name | Type | Notes |
|---|---|---|
| language | `it` \| `en` \| `de` | labels' language when signed out (else `Accept-Language`); ignored with a session (the user's language wins) |
| country | `IT` \| `DE` | signed out only: with `language` (default `Accept-Language`) asks for `profile` (onboarding). The pair must be valid (`IT`: it/en, `DE`: en/de) |

Errors: 400 `{ code: "validation_failed", field: "language" | "country" }`.

Fixtures: [meta-public-en.json](../fixtures/meta-public-en.json) (signed out, `language=en`),
[meta-onboarding-de.json](../fixtures/meta-onboarding-de.json) (signed out, `country=DE&language=de`),
[meta.json](../fixtures/meta.json) (Italian user's session).

```ts
interface AppMeta {
  language: "it" | "en" | "de";
  server: { version: string; commit: string; builtAt: string };          // same as /api/health
  legal: LegalMeta;                                                     // same as GET /api/legal
  languages: { id; name /* native name */; locale /* it-IT, en-GB, de-DE: format with this */ }[];
  countries: CountryCapabilities[];                                     // IT and DE
  currencies: { value: "EUR" | "USD" | "GBP" | "CHF"; label; symbol }[]; defaultCurrency: "EUR";
  homePages: { path: "/panoramica" | "/liquidita" | "/liquidita/conti" | "/liquidita/analisi" | "/investimenti"; label }[];
  defaultHomePage: "/panoramica";
  notifications: {
    defaults: { digestEnabled: false; digestFrequency: "mensile"; budgetAlertsEnabled: false; deadlineAlertsEnabled: false; goalAlertsEnabled: false };
    kinds: { id: "digest" | "budget" | "deadlines" | "goals"; label; hint }[];
    digestFrequencies: ["settimanale", "mensile"]; budgetAlertThresholds: [80, 100]; deadlineLeadDays: 3; alertsMaxPerWeek: 3;
  };
  limits: {
    transactionsPageDefault: 50; transactionsPageMax: 200; goalsMax: 20; goalSourcesMax: 12;
    pensionFundsMax: 10; pensionSnapshotsPerFundMax: 5000; investmentTargetsMax: 30; priceAlertsPerInstrumentMax: 10;
    debtCostsMax: 10; bankSyncsPerDay: 4; bankSyncMinGapMinutes: 240; personalImportMaxBytes: 26214400;
  };
  features: {                                       // the landing's catalog (lib/features/catalog.ts)
    id; area; areaLabel; name; description;         // it, or en for en/de (the catalog has no German text)
    status: "live" | "new" | "soon"; appPath: string | null;
    available: boolean | null;                      // its screen exists in the profile's country; null without a profile
  }[];
  profile: {                                        // session user, or the requested country+language; null otherwise
    productCountry; language;
    capabilities: CountryCapabilities;
    categoryProposal: { key: string | null; name; description; group; color; icon; … }[];  // onboarding «Categorie» step, localized
  } | null;
}
interface CountryCapabilities {
  id: "IT" | "DE"; languages: Language[];
  features: { taxes; pension; retirement; incomeForecasts; inflation: boolean };       // countryFeatures
  sections: { pension; analytics; goals; investmentTaxes; investmentIncome; fire; financialPlanning: boolean };  // same as bootstrap
  planning: { tax; income; pension; retirement; simulations: boolean };                 // German plan rollout switches
}
```

`capabilities.sections` is the same map as `GET /api/me/bootstrap` (`countrySections`); `financialPlanning` is false for
Italy (no planning model). Not served yet: a minimum client version (no source in the web; add when the apps ship).

## GET /api/whats-new

Route name: `whats_new.get`. Fixture: [whats-new.json](../fixtures/whats-new.json).

Query: `dismissed=id1,id2` (≤ 100 ids; the device keeps them, as the web's `bb:whats-new-dismissed`).

```ts
interface WhatsNew {
  maxAgeDays: 45;
  entries: { id; date; title; summary; href; ctaLabel }[];   // fresh (≤ 45 days), screen available in the country, newest first, localized
  current: WhatsNewEntry | null;                              // what the Overview card shows: newest fresh entry not dismissed
}
```

Entries released before the user's sign-up (`createdAt`) are left out of `entries` and `current` (web #444; backend
branch commit `87111ff9`).

`href` is a web path (e.g. `/analitiche/obiettivi?nuovo=1&da=novita`): map it to a native route; unknown paths open the
section's root.
