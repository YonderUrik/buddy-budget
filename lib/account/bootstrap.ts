import { z } from "zod";
import { LEGAL_VERSION, needsLegalAcceptance } from "@/lib/legal/version";
import { planningModel } from "@/lib/financial-planning/registry";
import { COUNTRY_LANGUAGES, LANGUAGES, PRODUCT_COUNTRIES, countryFeatures, isCountryPathAvailable, resolveProfile, type ProductCountry } from "@/lib/localization/config";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { resolveHomePage } from "./home-pages";
import { ACCOUNT_DEACTIVATED_CODE, LEGAL_ACCEPTANCE_REQUIRED_CODE, ONBOARDING_REQUIRED_CODE, accountGate } from "./gates";
import { recentLoginExpiresAt } from "./recent-login";

/**
 * Country-gated sections and the path that decides each one in `isCountryPathAvailable` (the same policy the proxy,
 * the sidebar and the API guards use), so the apps never keep their own copy of the country matrix.
 */
export const COUNTRY_SECTION_PATHS = {
  pension: "/pensione",
  analytics: "/analitiche",
  goals: "/analitiche/obiettivi",
  investmentTaxes: "/investimenti/tasse",
  investmentIncome: "/investimenti/proventi",
  fire: "/api/sidebar/fire",
  financialPlanning: "/api/financial-planning",
} as const;

export type CountrySection = keyof typeof COUNTRY_SECTION_PATHS;

/**
 * Which country-gated sections a product country has: the proxy's path policy, and for the financial plan also a
 * planning model (Italy passes the path policy but `/api/financial-planning` has no Italian model and answers 403).
 */
export function countrySections(country: ProductCountry): Record<CountrySection, boolean> {
  return Object.fromEntries(
    Object.entries(COUNTRY_SECTION_PATHS).map(([section, path]) => [
      section,
      isCountryPathAvailable(country, path) && (section !== "financialPlanning" || planningModel(country) !== null),
    ]),
  ) as Record<CountrySection, boolean>;
}

const isoDate = z.iso.datetime();
const booleanMap = <K extends string>(keys: readonly K[]) => z.object(Object.fromEntries(keys.map((key) => [key, z.boolean()])) as Record<K, z.ZodBoolean>);

/** Response of `GET /api/me/bootstrap`: everything a native app needs at launch to route the signed-in user. */
export const meBootstrapSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string(), emailVerified: z.boolean(), image: z.string().nullable() }),
  profile: z.object({
    productCountry: z.enum(PRODUCT_COUNTRIES),
    language: z.enum(LANGUAGES),
    availableLanguages: z.array(z.enum(LANGUAGES)),
    currency: z.string(),
    homePage: z.string(),
    hideAmounts: z.boolean(),
  }),
  onboarding: z.object({ completed: z.boolean() }),
  legal: z.object({
    currentVersion: z.string(),
    acceptedVersion: z.string().nullable(),
    acceptedAt: isoDate.nullable(),
    needsAcceptance: z.boolean(),
  }),
  account: z.object({ deactivated: z.boolean(), deletionScheduledAt: isoDate.nullable(), readOnlyDemo: z.boolean() }),
  gate: z.enum([ACCOUNT_DEACTIVATED_CODE, LEGAL_ACCEPTANCE_REQUIRED_CODE, ONBOARDING_REQUIRED_CODE]).nullable(),
  capabilities: z.object({
    features: booleanMap(["taxes", "pension", "retirement", "incomeForecasts", "inflation"] as const),
    sections: booleanMap(Object.keys(COUNTRY_SECTION_PATHS) as CountrySection[]),
  }),
  session: z.object({ createdAt: isoDate, expiresAt: isoDate, recentLoginUntil: isoDate }),
});

export type MeBootstrap = z.infer<typeof meBootstrapSchema>;

/** The session fields the bootstrap reads (a better-auth session with the app's additional user fields). */
export interface BootstrapSession {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    productCountry?: string | null;
    language?: string | null;
    currency?: string | null;
    homePage?: string | null;
    hideAmounts?: boolean | null;
    onboardingCompleted?: boolean | null;
    deletionScheduledAt?: Date | string | null;
    legalAcceptedAt?: Date | string | null;
    legalAcceptedVersion?: string | null;
  };
  session: { createdAt: Date | string; expiresAt: Date | string };
}

const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null);

/**
 * Launch state of the signed-in user: profile, the account gate the proxy would apply (`gate`, null when the app is
 * usable) and the country capability map. `legal.needsAcceptance` compares versions only; during onboarding the
 * acceptance happens in onboarding itself, so `gate` is the field that says which screen to show.
 */
export function buildMeBootstrap({ user, session }: BootstrapSession): MeBootstrap {
  const profile = resolveProfile(user);
  const createdAt = new Date(session.createdAt);
  return {
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, image: user.image ?? null },
    profile: {
      ...profile,
      availableLanguages: [...COUNTRY_LANGUAGES[profile.productCountry]],
      currency: user.currency ?? "EUR",
      homePage: resolveHomePage(user.homePage),
      hideAmounts: user.hideAmounts === true,
    },
    onboarding: { completed: user.onboardingCompleted === true },
    legal: {
      currentVersion: LEGAL_VERSION,
      acceptedVersion: user.legalAcceptedVersion ?? null,
      acceptedAt: iso(user.legalAcceptedAt),
      needsAcceptance: needsLegalAcceptance(user.legalAcceptedVersion),
    },
    account: { deactivated: Boolean(user.deletionScheduledAt), deletionScheduledAt: iso(user.deletionScheduledAt), readOnlyDemo: isPublicDemoUserId(user.id) },
    gate: accountGate(user),
    capabilities: {
      features: { ...countryFeatures(profile.productCountry) },
      sections: countrySections(profile.productCountry),
    },
    session: {
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      recentLoginUntil: recentLoginExpiresAt(createdAt).toISOString(),
    },
  };
}
