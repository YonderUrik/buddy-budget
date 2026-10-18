/**
 * English texts of the free calculators and of the zainetto fiscale guide (`/en/calculators/*`, `/en/guides/*`): the
 * same facts as the Italian pages and `content/tools.ts`. When a rule or a sentence changes there, it changes here too.
 * The rules are Italian tax law, so the pages say so and keep the Italian terms with a short English gloss.
 */
import { EN_PATHS } from "../locales";
import { SOURCES, type Source } from "../seo-pages";
import type { Tool } from "../tools";

/** The legal sources of `SOURCES`, with English labels and the same links (the documents themselves are in Italian). */
export const SOURCES_EN = {
  tuir68: { label: "Article 68 of the TUIR (Presidential Decree 917/1986), capital gains and losses: offsetting, and carrying losses forward \"no later than the fourth\" year", href: SOURCES.tuir68.href },
  circolare19e: { label: "Agenzia delle Entrate (the Italian Revenue Agency), Circular 19/E of 27 June 2014: taxation of financial income (26% rate, government bonds at 12.5%)", href: SOURCES.circolare19e.href },
  quadroRt: { label: "Agenzia delle Entrate, Quadro RT: capital gains and losses in the Italian tax return", href: SOURCES.quadroRt.href },
  guidaMutuo: { label: "Banca d'Italia (the Bank of Italy), «Il mutuo ipotecario in parole semplici», its plain-words guide to mortgages: a home mortgage can be paid off early with no fees or penalties", href: SOURCES.guidaMutuo.href },
  prestitoPersonale: { label: "Banca d'Italia, «Economia per tutti»: personal loans and early repayment", href: SOURCES.prestitoPersonale.href },
} as const satisfies Record<keyof typeof SOURCES, Source>;

/** Date of the last check of `SOURCES`, in English. */
export const SOURCES_CHECKED_EN = "2 October 2026";

/** Heading of the sources box on these pages: every document linked is in Italian. */
export const SOURCES_SUMMARY_EN = "Sources and legal references, in Italian";

export const TOOLS_EN: readonly Tool[] = [
  { id: "zainetto", name: "Zainetto fiscale", text: "Italian tax-loss carryforward: how much of your past losses you can still use, and the tax you pay on a gain.", href: EN_PATHS.zainetto },
  { id: "ammortamento", name: "Loan amortization", text: "Monthly payment, total interest and how much you save by paying part of the loan off early.", href: EN_PATHS.loanAmortization },
  { id: "obiettivo", name: "Savings goal", text: "How long it takes to reach an amount with what you put aside each month.", href: EN_PATHS.savingsGoal },
];

/** Texts of the list of calculators (`/en/calculators`). */
export const TOOLS_PAGE_EN = {
  title: "Free calculators: zainetto fiscale, loan amortization, savings goal",
  description: "Three free calculators, no account needed: the Italian tax on a capital gain after past losses (zainetto fiscale), the payment and interest of a loan, and how long it takes to reach a savings goal.",
  h1: "Calculators",
  lead: "The same engines as the app, open to everyone and with no account. They are estimates for information only, and the tax figures follow Italian tax law. The official sources are at the bottom of each page.",
} as const;

/** Texts of the zainetto fiscale calculator (`/en/calculators/zainetto-fiscale`). */
export const ZAINETTO_PAGE_EN = {
  title: "Zainetto fiscale calculator: Italian tax on a capital gain after past losses",
  description: "Work out how much of your capital losses from the last 4 years you can offset, and how much Italian tax you pay on a gain from stocks, ETFs or government bonds. Free, no sign-up.",
  h1: "Zainetto fiscale calculator",
  lead: "Enter this year's capital gain and the losses you carry from earlier years. See which ones you can still use, how much they offset and how much tax you pay. The zainetto fiscale is Italy's tax-loss carryforward, and the calculator applies Italian tax law.",
} as const;

/** Texts of the loan amortization calculator (`/en/calculators/loan-amortization`). */
export const AMMORTAMENTO_PAGE_EN = {
  title: "Loan amortization calculator with early repayment",
  description: "Work out the monthly payment, the total interest and the full fixed-payment schedule of a mortgage or a loan, and see how much you save by paying part of it off early. Free.",
  h1: "Loan amortization calculator",
  lead: "Amount, rate and term: get the monthly payment, how much interest you pay and the full schedule, month by month. Then try paying off part of the principal early.",
} as const;

/** Texts of the savings goal calculator (`/en/calculators/savings-goal`). */
export const OBIETTIVO_PAGE_EN = {
  title: "Savings goal calculator: how long it takes to reach an amount",
  description: "Work out how many months it takes to reach an amount with what you already have and what you put aside each month, with or without a return, and how much you would need each month to get there by a date. Free, no sign-up.",
  h1: "Savings goal calculator",
  lead: "An amount to reach, what you already have and how much you put aside each month: see how long it takes, and how much you would need each month to get there by a date.",
} as const;

/** Texts of the zainetto fiscale guide (`/en/guides/zainetto-fiscale`). */
export const GUIDE_ZAINETTO_EN = {
  h1: "Zainetto fiscale: what it is and how to use your capital losses",
  /** Different from the h1 on purpose, as on the Italian page. */
  title: "Zainetto fiscale: a guide to Italian tax-loss carryforward, with examples",
  description: "What the zainetto fiscale is and how the 4 years to offset losses on stocks and ETFs work under Italian tax law, with worked examples and a free calculator.",
} as const;
