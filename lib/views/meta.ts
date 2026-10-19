/**
 * App metadata for the native apps (gaps.md G13, G14): the constants the web keeps in its bundle — countries and their
 * languages, features and sections, currencies, home pages, notification defaults, limits, the feature catalog with its
 * availability per country, the onboarding category proposal, legal metadata and the server build — and the «Novità»
 * entries. Pure: everything comes from the same modules the web imports.
 */
import { countrySections } from "@/lib/account/bootstrap";
import { DEFAULT_HOME_PAGE, HOME_PAGE_OPTIONS } from "@/lib/account/home-pages";
import { APP_BUILD_INFO } from "@/lib/app-version";
import { FEATURE_AREA_LABELS_EN, FEATURES, featureText } from "@/lib/features/catalog";
import { DEBT_MAX_COSTS } from "@/lib/validation/debts";
import { MAX_ACTIVE_ALERTS_PER_INSTRUMENT, MAX_TARGETS } from "@/lib/validation/investments";
import { MAX_GOAL_SOURCES, MAX_GOALS } from "@/lib/goals/constants";
import { MAX_SYNCS_PER_DAY, MIN_SYNC_GAP_MS } from "@/lib/gocardless/sync-eligibility";
import { legalMeta } from "@/lib/legal/meta";
import { TRANSACTION_PAGE_DEFAULT, TRANSACTION_PAGE_MAX } from "@/lib/liquidity/transactions-list";
import { localizedCategoryProposal } from "@/lib/localization/categories";
import {
  COUNTRY_LANGUAGES,
  countryFeatures,
  isCountryPathAvailable,
  LANGUAGE_LOCALES,
  LANGUAGE_NAMES,
  LANGUAGES,
  PRODUCT_COUNTRIES,
  type Language,
  type LocaleProfile,
} from "@/lib/localization/config";
import { isPlanningAvailable } from "@/lib/localization/planning-availability";
import { translate } from "@/lib/localization/messages";
import {
  ALERT_MAX_PER_WEEK,
  BUDGET_ALERT_THRESHOLDS,
  DEADLINE_LEAD_DAYS,
  DIGEST_FREQUENCIES,
  NOTIFICATION_DEFAULTS,
  NOTIFICATION_KIND_INFO,
  NOTIFICATION_KINDS,
} from "@/lib/notifications/constants";
import { PENSION_MAX_FUNDS, PENSION_MAX_SNAPSHOTS_PER_FUND } from "@/lib/pension/limits";
import { MAX_BYTES as PERSONAL_IMPORT_MAX_BYTES } from "@/lib/personal-import/contract";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/validation/currency";
import { pickWhatsNew } from "@/lib/whats-new/pick";
import { WHATS_NEW_ENTRIES, WHATS_NEW_MAX_AGE_DAYS } from "@/lib/whats-new/entries";

const PLANNING_CAPABILITIES = ["tax", "income", "pension", "retirement", "simulations"] as const;

/** What a country has: languages, financial features, gated sections and planning switches. */
function countryCapabilities(country: (typeof PRODUCT_COUNTRIES)[number]) {
  return {
    id: country,
    languages: [...COUNTRY_LANGUAGES[country]],
    features: { ...countryFeatures(country) },
    sections: countrySections(country),
    planning: Object.fromEntries(PLANNING_CAPABILITIES.map((capability) => [capability, isPlanningAvailable(country, capability)])) as Record<(typeof PLANNING_CAPABILITIES)[number], boolean>,
  };
}

export interface AppMetaInputs {
  /** Language of the labels (the session's, `?language=` or `Accept-Language`). */
  language: Language;
  /** The signed-in user's profile, or the requested country/language before sign-in; null when unknown. */
  profile: LocaleProfile | null;
}

/** Builds `GET /api/meta`. */
export function buildAppMeta(input: AppMetaInputs) {
  const { language, profile } = input;
  const tr = (source: string) => translate(language, source);
  const catalogLanguage = language === "it" ? "it" : "en";
  return {
    language,
    server: APP_BUILD_INFO,
    legal: legalMeta(language),
    languages: LANGUAGES.map((id) => ({ id, name: LANGUAGE_NAMES[id], locale: LANGUAGE_LOCALES[id] })),
    countries: PRODUCT_COUNTRIES.map(countryCapabilities),
    currencies: SUPPORTED_CURRENCIES.map((currency) => ({ ...currency, label: tr(currency.label) })),
    defaultCurrency: DEFAULT_CURRENCY,
    homePages: HOME_PAGE_OPTIONS.map((option) => ({ path: option.path, label: tr(option.label) })),
    defaultHomePage: DEFAULT_HOME_PAGE,
    notifications: {
      defaults: NOTIFICATION_DEFAULTS,
      kinds: NOTIFICATION_KINDS.map((kind) => ({ id: kind, label: tr(NOTIFICATION_KIND_INFO[kind].label), hint: tr(NOTIFICATION_KIND_INFO[kind].hint) })),
      digestFrequencies: [...DIGEST_FREQUENCIES],
      budgetAlertThresholds: [...BUDGET_ALERT_THRESHOLDS],
      deadlineLeadDays: DEADLINE_LEAD_DAYS,
      alertsMaxPerWeek: ALERT_MAX_PER_WEEK,
    },
    limits: {
      transactionsPageDefault: TRANSACTION_PAGE_DEFAULT,
      transactionsPageMax: TRANSACTION_PAGE_MAX,
      goalsMax: MAX_GOALS,
      goalSourcesMax: MAX_GOAL_SOURCES,
      pensionFundsMax: PENSION_MAX_FUNDS,
      pensionSnapshotsPerFundMax: PENSION_MAX_SNAPSHOTS_PER_FUND,
      investmentTargetsMax: MAX_TARGETS,
      priceAlertsPerInstrumentMax: MAX_ACTIVE_ALERTS_PER_INSTRUMENT,
      debtCostsMax: DEBT_MAX_COSTS,
      bankSyncsPerDay: MAX_SYNCS_PER_DAY,
      bankSyncMinGapMinutes: MIN_SYNC_GAP_MS / 60_000,
      personalImportMaxBytes: PERSONAL_IMPORT_MAX_BYTES,
    },
    /** The landing's feature catalog, with whether its screen exists for the profile's country (null without a profile). */
    features: FEATURES.map((feature) => {
      const text = featureText(feature, catalogLanguage);
      return {
        id: feature.id,
        area: feature.area,
        areaLabel: catalogLanguage === "it" ? feature.area : FEATURE_AREA_LABELS_EN[feature.area],
        name: text.name,
        description: text.description,
        status: feature.status,
        appPath: feature.appPath ?? null,
        available: profile && feature.appPath ? isCountryPathAvailable(profile.productCountry, feature.appPath) : profile ? true : null,
      };
    }),
    /** Profile-specific: onboarding category proposal (names in the profile's language) and the country's capabilities. */
    profile: profile
      ? { ...profile, capabilities: countryCapabilities(profile.productCountry), categoryProposal: localizedCategoryProposal(profile) }
      : null,
  };
}

export type AppMeta = ReturnType<typeof buildAppMeta>;

export interface WhatsNewInputs {
  language: Language;
  productCountry: string;
  /** Entry ids the device has dismissed (kept on the device, as on the web). */
  dismissed: readonly string[];
  now: Date;
  /** The user's sign-up: entries released before it are skipped. */
  since?: Date;
}

/**
 * Builds `GET /api/whats-new`: the entries of the last `WHATS_NEW_MAX_AGE_DAYS` days whose screen exists in the
 * product country, localized, and `current` = the one the Overview card shows (`pickWhatsNew`).
 */
export function buildWhatsNew(input: WhatsNewInputs) {
  const tr = (source: string) => translate(input.language, source);
  const available = WHATS_NEW_ENTRIES.filter((entry) => isCountryPathAvailable(input.productCountry, entry.href.split("?")[0]));
  const localize = (entry: (typeof WHATS_NEW_ENTRIES)[number]) => ({ ...entry, title: tr(entry.title), summary: tr(entry.summary), ctaLabel: tr(entry.ctaLabel) });
  // Entries released before the user's sign-up are not news to them (web #444).
  const fresh = available.filter((entry) => pickWhatsNew([entry], [], input.now, input.since) !== null);
  const current = pickWhatsNew(available, input.dismissed, input.now, input.since);
  return { maxAgeDays: WHATS_NEW_MAX_AGE_DAYS, entries: fresh.map(localize), current: current ? localize(current) : null };
}

export type WhatsNew = ReturnType<typeof buildWhatsNew>;
