/**
 * Labels, captions and alt texts of the app screens in each language. The Italian ones live next to the screen in
 * `screens.ts` (the capture script reads that file); the English ones are here, one entry per screen id.
 */
import type { Locale } from "@/lib/i18n";
import { SCREENS, type AppScreen, type ScreenId } from "./screens";

export interface ScreenText {
  label: string;
  caption: string;
  alt: string;
}

export type ScreenArea = AppScreen["area"];

/** Order of the gallery groups, as in the app's sidebar. */
export const SCREEN_AREAS: readonly ScreenArea[] = ["Panoramica", "Liquidità", "Investimenti", "Pensione", "Debiti", "Analitiche"];

const AREA_NAMES_EN: Record<ScreenArea, string> = {
  Panoramica: "Overview",
  Liquidità: "Cash",
  Investimenti: "Investments",
  Pensione: "Pension",
  Debiti: "Debts",
  Analitiche: "Analytics",
};

export const SCREEN_TEXT_EN: Record<ScreenId, ScreenText> = {
  panoramica: { label: "Overview", caption: "How much you have in all and how it splits: accounts, investments, pension and debts.", alt: "Overview: net worth, chart over time and split by asset class" },
  conti: { label: "Accounts", caption: "The connected bank and the accounts added by hand, with their balances.", alt: "Accounts: a bank-connected account and manual accounts with balances" },
  movimenti: { label: "Transactions", caption: "Balance, trend and every transaction; change a category with one tap.", alt: "Transactions: list of transactions with categories and amounts" },
  analisi: { label: "Analysis", caption: "Money in, money out and what's left, month by month.", alt: "Analysis: income against spending by month and savings indicators" },
  abbonamenti: { label: "Subscriptions", caption: "The charges that come back every month, found on their own: what they cost and when the next one lands.", alt: "Subscriptions: monthly and yearly cost, subscriptions to confirm and next charge" },
  categorie: { label: "Categories", caption: "The four spending groups, income, and money moved between your own accounts.", alt: "Categories split into spending groups, income and transfers" },
  categorizza: { label: "Categorize", caption: "The app sets the category itself when it's sure; you only deal with the doubts.", alt: "Categorize: one card per merchant with the transaction dates and the suggested category with its origin" },
  investimenti: { label: "Portfolio", caption: "What the portfolio is worth, what you put in and what you've earned, holding by holding.", alt: "Investments: portfolio value, contributions against market value, and holdings" },
  performance: { label: "Performance", caption: "Your real return, compared with the market and with inflation.", alt: "Performance: portfolio return compared with an index" },
  diversificazione: { label: "Diversification", caption: "Where your money sits, by country and sector, looking inside the ETFs.", alt: "Diversification: portfolio split by region and sector" },
  titolo: { label: "Security page", caption: "One security: price, trend, risk, your position and the company's accounts.", alt: "Page of a stock: price and key figures, chart with your purchases, risk and position" },
  tasse: { label: "Taxes", caption: "Gains, losses to offset and the estimated tax if you sell (Italian rules).", alt: "Taxes: estimate of Italian taxation on the portfolio" },
  pensione: { label: "Pension", caption: "What you've paid into the fund, what it's worth and its real return.", alt: "Pension: fund value, contributions paid and real return" },
  "pensione-scenari": { label: "If you withdraw today", caption: "What you'd keep if you withdrew today, after tax, compared with leaving the TFR (Italian severance pay) with your employer.", alt: "Pension: net estimate of a withdrawal today and comparison with the TFR left with the employer" },
  debiti: { label: "Debts", caption: "The next payments, where you pay the most interest and how to finish sooner.", alt: "Debts: next payments, a year of interest per debt and the path to paying them off sooner" },
  simulatore: { label: "Simulation", caption: "A loan with “What if…” tries: pay more, pay off early, switch bank.", alt: "Detail of a loan with remaining balance, progress ring and simulation" },
  analitiche: { label: "What if…", caption: "The year you could stop working, which moves as you change savings, spending and return.", alt: "Analytics: the target year, four sliders to try assumptions and the chart of net worth towards the FIRE number" },
};

/** Name of a gallery group in the page language. */
export function screenAreaName(area: ScreenArea, locale: Locale): string {
  return locale === "en" ? AREA_NAMES_EN[area] : area;
}

/** Label, caption and alt text of a screen in the page language. */
export function screenText(id: ScreenId, locale: Locale): ScreenText {
  if (locale === "en") return SCREEN_TEXT_EN[id];
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Unknown screen: ${id}`);
  return { label: screen.label, caption: screen.caption, alt: screen.alt };
}
