import type { Locale } from "@/lib/i18n";
import type { RuleNeed } from "@/lib/visitor-country";

/**
 * Prices of Pro, in euro cents. The same as `PRO_PRICE_CENTS` and `PRO_TRIAL_DAYS` in the app (`lib/billing/plans.ts`);
 * `lib/billing/landing-prices.test.ts` in the app fails if the two drift apart.
 */
export const PRO_PRICES = { monthCents: 199, yearCents: 2000, trialDays: 14 } as const;

/** One line of a plan, hidden where the visitor's country lacks the rules it is built on (`data-needs`). */
export interface PricingLine {
  text: string;
  needs?: RuleNeed;
}

export interface PricingText {
  /** Anchor of the section (`/#prezzi`, `/en#pricing`), also the menu entry. */
  id: string;
  title: string;
  free: { name: string; price: string; per: string; lines: readonly PricingLine[] };
  pro: { name: string; price: string; per: string; alt: string; lines: readonly PricingLine[] };
  cta: string;
  /** Short facts under the plans: what holds today, at launch and when self-hosting. */
  notes: readonly string[];
  /** Shown only when the repository is public (self-hosting is free). */
  selfHost: string;
}

/** Price in euro for the page's language: «1,99 €» in Italian, «€1.99» in English, whole euros without decimals. */
export function euro(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

const PRICING_IT: PricingText = {
  id: "prezzi",
  title: `Liquidità è gratis. Il resto, ${euro(PRO_PRICES.monthCents, "it")} al mese.`,
  free: {
    name: "Gratis",
    price: euro(0, "it"),
    per: "per sempre",
    lines: [
      { text: "Conti e movimenti, a mano o importati da file" },
      { text: "Spese, budget e categorie che si mettono da sole" },
      { text: "Abbonamenti ricorrenti trovati nei movimenti" },
      { text: "Tutti i tuoi dati in un file ZIP, quando vuoi" },
    ],
  },
  pro: {
    name: "Pro",
    price: euro(PRO_PRICES.yearCents, "it"),
    per: "all'anno",
    alt: `oppure ${euro(PRO_PRICES.monthCents, "it")} al mese · ${PRO_PRICES.trialDays} giorni di prova gratis`,
    lines: [
      { text: "Tutto quello che c'è in Gratis" },
      { text: "Il patrimonio netto in un numero solo" },
      { text: "Investimenti, rendimenti e dividendi" },
      { text: "Le tasse sugli investimenti già stimate", needs: "taxes" },
      { text: "Fondo pensione e TFR", needs: "pension" },
      { text: "Debiti, mutui e finanziamenti" },
      { text: "Analitiche, simulazioni e obiettivi" },
    ],
  },
  cta: "Inizia gratis",
  notes: ["Finché Pro non parte, è tutto sbloccato per tutti.", "Chi c'è già quando parte ha tre mesi di Pro in regalo.", "Si annulla quando vuoi, dall'app."],
  selfHost: "Sui tuoi server è tutto gratis, per sempre.",
};

const PRICING_EN: PricingText = {
  id: "pricing",
  title: `Cash is free. The rest, ${euro(PRO_PRICES.monthCents, "en")} a month.`,
  free: {
    name: "Free",
    price: euro(0, "en"),
    per: "forever",
    lines: [
      { text: "Accounts and transactions, by hand or imported from files" },
      { text: "Spending, budgets and categories that sort themselves" },
      { text: "Recurring subscriptions found in your transactions" },
      { text: "All your data in a ZIP file, whenever you want" },
    ],
  },
  pro: {
    name: "Pro",
    price: euro(PRO_PRICES.yearCents, "en"),
    per: "a year",
    alt: `or ${euro(PRO_PRICES.monthCents, "en")} a month · ${PRO_PRICES.trialDays}-day free trial`,
    lines: [
      { text: "Everything in Free" },
      { text: "Your net worth in one number" },
      { text: "Investments, returns and dividends" },
      { text: "Taxes on investments already estimated", needs: "taxes" },
      { text: "Pension fund and TFR (Italian severance pay)", needs: "pension" },
      { text: "Debts, mortgages and loans" },
      { text: "Analytics, simulations and goals" },
    ],
  },
  cta: "Start for free",
  notes: ["Until Pro starts, everything is unlocked for everyone.", "Whoever is already here when it starts gets three months of Pro as a gift.", "Cancel whenever you like, from the app."],
  selfHost: "On your own servers everything is free, forever.",
};

/** The prices section of each home. */
export const PRICING: Record<Locale, PricingText> = { it: PRICING_IT, en: PRICING_EN };
