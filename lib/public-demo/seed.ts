/**
 * Sample account used by the landing screenshots and by the public demo: accounts, a year of transactions, budgets,
 * subscriptions, investments (`seed-investments.ts`), goals, debts and a pension fund, all invented and deterministic (fixed-seed generator).
 * Merchants and securities carry real brand names, so the screens show the logos people know; amounts stay invented.
 * User-facing texts come in the account's language (`texts.ts`); German also gets the German product rules.
 * Re-running it re-creates the account from scratch (the user row is deleted first and everything cascades).
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { accounts } from "@/lib/db/schema/accounts";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { budgets } from "@/lib/db/schema/budgets";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { subscriptionKey } from "@/lib/calc/subscriptions";
import { debtEvents, debts } from "@/lib/db/schema/debts";
import { goalSources, goals } from "@/lib/db/schema/goals";
import { pensionFunds, pensionSnapshots } from "@/lib/db/schema/pension";
import { instruments } from "@/lib/db/schema/investments";
import { transactions } from "@/lib/db/schema/transactions";
import { LEGAL_VERSION } from "@/lib/legal";
import { snapshotUser } from "@/lib/net-worth/scheduler";
import { profileForLanguage, type Language, type ProductCountry } from "@/lib/localization/config";
import { DEMO_ISINS, seedDemoInvestments } from "./seed-investments";
import { demoText } from "./texts";


const MONTHS_OF_HISTORY = 12;
const SEED = 20261001;

/** mulberry32 pseudo-random generator: the same numbers on every run. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Recurring {
  category: string;
  description: string;
  raw: string;
  min: number;
  max: number;
  day: number;
  perMonth?: number;
  /** Second shop used for every other transaction of the month (same category and amounts). */
  alternate?: { description: string; raw: string };
}

// Merchants: well-known brands where a real person would shop (the app shows their logos), local shops with no logo
// for the rest. Brands are names only: amounts and dates stay invented.
const EXPENSES: Recurring[] = [
  { category: "Affitto & Mutuo", description: "Rata mutuo", raw: "ADDEBITO SDD RATA MUTUO N. 4471", min: 742.18, max: 742.18, day: 5 },
  { category: "Bollette & Telefono", description: "Enel Energia", raw: "SDD ENEL ENERGIA FATT 2291", min: 68, max: 135, day: 12 },
  { category: "Bollette & Telefono", description: "TIM", raw: "ADDEBITO SDD TIM FIBRA E MOBILE", min: 34.9, max: 34.9, day: 9 },
  { category: "Spesa", description: "Esselunga", raw: "PAGAMENTO POS ESSELUNGA 0412", min: 18, max: 96, day: 3, perMonth: 7, alternate: { description: "Conad", raw: "PAGAMENTO POS CONAD 0187" } },
  { category: "Trasporti", description: "Eni", raw: "PAGAMENTO POS ENI STATION 1187", min: 35, max: 62, day: 8, perMonth: 2 },
  { category: "Ristoranti & Bar", description: "Trattoria da Mario", raw: "PAGAMENTO POS TRATTORIA DA MARIO", min: 22, max: 78, day: 15, perMonth: 4 },
  { category: "Abbonamenti", description: "Netflix", raw: "PAGAMENTO ONLINE NETFLIX.COM", min: 13.99, max: 13.99, day: 17 },
  { category: "Abbonamenti", description: "Spotify", raw: "PAGAMENTO ONLINE SPOTIFY P2B71C", min: 10.99, max: 10.99, day: 19 },
  { category: "Sport & Benessere", description: "Palestra Olimpia", raw: "ADDEBITO SDD PALESTRA OLIMPIA", min: 39, max: 39, day: 7 },
  { category: "Shopping", description: "Amazon", raw: "PAGAMENTO ONLINE AMAZON EU SARL", min: 24, max: 140, day: 21, perMonth: 1 },
  { category: "Shopping", description: "Zara", raw: "PAGAMENTO POS ZARA 0233", min: 30, max: 120, day: 23, perMonth: 1 },
  { category: "Salute", description: "Farmacia Comunale", raw: "PAGAMENTO POS FARMACIA COMUNALE", min: 9, max: 38, day: 11, perMonth: 1 },
  { category: "Viaggi", description: "Booking.com", raw: "PAGAMENTO ONLINE BOOKING.COM", min: 120, max: 420, day: 24, perMonth: 1 },
];


export interface SeedDemoAccountOptions {
  /** Id of the account to (re)create, e.g. `demo-user` for screenshots or `public-demo-en` for the public demo. */
  userId: string;
  /** Unique email of the account: never a real mailbox. */
  email: string;
  /** Interface language of the account and of its texts. */
  language: Language;
  /** Product country of the account (its tax and planning rules); by default the usual one of the language. */
  productCountry?: ProductCountry;
  /** Fixed session for the screenshot capture; the public demo opens its own sessions. */
  screenshotSession?: { id: string; token: string };
  /** Clock of the data ("today"), for tests. */
  now?: Date;
}

export interface SeedDemoAccountResult {
  transactions: number;
  operations: number;
  prices: number;
}

/** (Re)creates a complete sample account. Never call it with the id of a real user: it deletes that user first. */
export async function seedDemoAccount({ userId, email, language, productCountry, screenshotSession, now = new Date() }: SeedDemoAccountOptions): Promise<SeedDemoAccountResult> {
  const PROFILE = { ...profileForLanguage(language), ...(productCountry ? { productCountry } : {}) };
  const text = (source: string) => demoText(source, language);
  const rand = rng(SEED);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
  const monthStart = (back: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
  const dayOfMonth = (back: number, day: number) => {
    const m = monthStart(back);
    return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), Math.min(day, 28)));
  };

  // Order matters: transactions block deleting their instrument, and deleting the user clears the instruments' owner.
  // So the owned ids are read first, the user goes (cascading portfolios and transactions), then those instruments,
  // plus orphans of older seeds (owner already gone) recognised by the invented ISINs.
  const owned = await db.select({ id: instruments.id }).from(instruments).where(eq(instruments.createdByUserId, userId));
  await db.delete(authUser).where(eq(authUser.id, userId));
  if (owned.length > 0) await db.delete(instruments).where(inArray(instruments.id, owned.map((row) => row.id)));
  await db.delete(instruments).where(and(isNull(instruments.createdByUserId), inArray(instruments.isin, DEMO_ISINS)));
  // Re-seeding (e.g. in another language) creates new ids: the cached fingerprint of the old investment history must go.
  if (process.env.REDIS_URL) {
    const [{ redis }, { investmentHistoryFingerprintKey, cashHistoryFingerprintKey }, { analyticsDigestKey }] = await Promise.all([import("@/lib/redis/client"), import("@/lib/net-worth/redis-history-state"), import("@/lib/analitiche/digest")]);
    await redis.del(investmentHistoryFingerprintKey(userId), cashHistoryFingerprintKey(userId), analyticsDigestKey(userId));
  }

  await db.insert(authUser).values({
    id: userId,
    name: text("Giulia Demo"),
    email,
    emailVerified: true,
    currency: "EUR",
    productCountry: PROFILE.productCountry,
    language: PROFILE.language,
    onboardingCompleted: true,
    // Terms already accepted, in the version in force when seeding: the gate in proxy.ts does not send to /accetta-termini.
    legalAcceptedAt: new Date(),
    legalAcceptedVersion: LEGAL_VERSION,
    // Categorizza: assistant on, safe categories applied on their own and recent «Messe dall'app» to review.
    aiCategorizationConsentAt: new Date(),
    categorizationAutoApply: true,
    autoCategorizedSeenAt: new Date(Date.now() - 14 * 86400000),
  });
  // Analitiche walkthrough already seen: the screen opens without the welcome dialog.
  await db.insert(analyticsAssumptions).values({ userId: userId, walkthroughSeenAt: new Date() });
  if (screenshotSession) {
    await db.insert(authSession).values({ id: screenshotSession.id, userId, token: screenshotSession.token, expiresAt: new Date(Date.now() + 7 * 86400000) });
  }

  const cats = await db.insert(categories).values(defaultCategoryRows(userId)).returning();
  const cat = (name: string) => {
    const found = cats.find((c) => c.name === name);
    if (!found) throw new Error(`Categoria demo mancante: ${name}`);
    return found.id;
  };

  const [checking, savings] = await db
    .insert(accounts)
    .values([
      { userId: userId, name: text("Conto corrente"), type: "Conto corrente", balance: "0", color: "blue", icon: "landmark", source: "auto" },
      { userId: userId, name: text("Conto deposito"), type: "Conto deposito", balance: "17400.00", color: "emerald", icon: "piggy-bank" },
      { userId: userId, name: text("Contanti"), type: "Contanti", balance: "145.00", color: "amber", icon: "wallet" },
    ])
    .returning();

  // Transactions: salary and recurring expenses of the last months, with varying but deterministic dates and amounts.
  const rows: (typeof transactions.$inferInsert)[] = [];
  let net = 0;
  for (let back = MONTHS_OF_HISTORY; back >= 0; back--) {
    const push = (date: Date, categoryName: string, description: string, raw: string | null, amount: number, accountId = checking.id) => {
      if (date.getTime() > today.getTime()) return;
      net += amount;
      rows.push({
        userId: userId,
        accountId,
        categoryId: cat(categoryName),
        description: text(description),
        rawDescription: raw === null ? null : text(raw),
        amount: amount.toFixed(2),
        date: iso(date),
        source: "auto",
        externalId: `demo-${rows.length}`,
      });
    };
    push(dayOfMonth(back, 27), "Stipendio", "Stipendio", "BONIFICO A VOSTRO FAVORE ACME SRL STIPENDIO", 2480);
    if (back % 4 === 1) push(dayOfMonth(back, 14), "Altre entrate", "Consulenza", "BONIFICO FATT 12/26", round2(between(380, 720)));
    // For «Abbonamenti»: a price increase, a service that stopped 5 months ago and a yearly insurance.
    push(dayOfMonth(back, 6), "Abbonamenti", "iCloud+", "PAGAMENTO ONLINE APPLE.COM/BILL", -2.99);
    if (back >= 5) push(dayOfMonth(back, 12), "Abbonamenti", "Giornale online", "PAGAMENTO ONLINE IL QUOTIDIANO DIGITALE", -7.99);
    if (back === 12 || back === 0) push(dayOfMonth(back, 2), "Assicurazioni", "UnipolSai", "ADDEBITO SDD UNIPOLSAI RCA", back === 12 ? -412 : -428);
    for (const e of EXPENSES) {
      const times = e.perMonth ?? 1;
      for (let i = 0; i < times; i++) {
        const day = Math.min(28, e.day + i * 4 + Math.floor(between(0, 3)));
        // Spotify cost €9.99 until 4 months ago: the increase shows in «Abbonamenti».
        const amount = e.description === "Spotify" && back >= 4 ? 9.99 : round2(between(e.min, e.max));
        const shop = e.alternate && i % 2 === 1 ? e.alternate : e;
        push(dayOfMonth(back, day), e.category, shop.description, shop.raw, -amount);
      }
    }
    if (back % 3 === 0) push(dayOfMonth(back, 20), "Investimenti", "Versamento PAC", "BONIFICO PAC ETF AZIONARIO", -300);
  }
  // Categorizza: this month's instalment set by a rule, some transactions categorised on their own («Messe dall'app»)
  // and some uncertain or without a suggestion («Da decidere»).
  const recentCutoff = iso(daysAgo(14));
  rows.forEach((row, index) => {
    if (row.description === text("Rata mutuo") && row.date >= recentCutoff) {
      Object.assign(row, { categorySource: "regola", categorizedAt: new Date(Date.now() - (index % 5) * 3600000) });
    }
  });
  // Two coffees at Bar Centrale already categorised: the third arrives with an uncertain «like your 2 similar transactions».
  for (const back of [2, 1]) {
    net -= 3.8;
    rows.push({
      userId: userId,
      accountId: checking.id,
      categoryId: cat("Ristoranti & Bar"),
      description: text("Bar Centrale"),
      rawDescription: text("PAGAMENTO POS BAR CENTRALE"),
      amount: "-3.80",
      date: iso(dayOfMonth(back, 10)),
      source: "auto",
      externalId: `demo-${rows.length}`,
    });
  }
  const fallback = cats.find((c) => c.isFallback);
  if (fallback) {
    // Messe dall'app: same as already categorised transactions (your choices, 100%) and a confident AI suggestion.
    const applied = [
      ["Esselunga", "PAGAMENTO POS ESSELUNGA 0412", -23.4, "Spesa", "storico", 1],
      ["Esselunga", "PAGAMENTO POS ESSELUNGA 0412", -41.7, "Spesa", "storico", 1],
      ["Trattoria da Mario", "PAGAMENTO POS TRATTORIA DA MARIO", -34, "Ristoranti & Bar", "storico", 1],
      ["Eni", "PAGAMENTO POS ENI STATION 1187", -48.2, "Trasporti", "storico", 1],
      ["Libreria del Corso", "PAGAMENTO POS LIBRERIA DEL CORSO", -18.9, "Svago", "assistente", 0.94],
    ] as const;
    applied.forEach(([description, raw, amount, categoryName, origin, confidence], i) => {
      net += amount;
      rows.push({
        userId: userId,
        accountId: checking.id,
        categoryId: cat(categoryName),
        description: text(description),
        rawDescription: text(raw),
        amount: amount.toFixed(2),
        date: iso(daysAgo(i + 1)),
        source: "auto",
        externalId: `demo-applied-${i}`,
        categorySource: origin,
        categoryConfidence: confidence.toFixed(4),
        categorizedAt: new Date(Date.now() - (i + 1) * 3600000),
      });
    });
    // Da decidere: an uncertain suggestion from your choices, two AI ones under 90% and a transfer without one.
    const pending = [
      ["Bar Centrale", "PAGAMENTO POS BAR CENTRALE", -4.6],
      ["Ferramenta Rossi", "PAGAMENTO POS FERRAMENTA ROSSI", -27.5],
      ["Ferramenta Rossi", "PAGAMENTO POS FERRAMENTA ROSSI", -12.9],
      ["Ottica Vista", "PAGAMENTO POS OTTICA VISTA", -89],
      ["Bonifico a favore di Luca", "BONIFICO A FAVORE DI LUCA R", -50],
    ] as const;
    pending.forEach(([description, raw, amount], i) => {
      net += amount;
      rows.push({
        userId: userId,
        accountId: checking.id,
        categoryId: fallback.id,
        description: text(description),
        rawDescription: text(raw),
        amount: amount.toFixed(2),
        date: iso(daysAgo(i + 2)),
        source: "auto",
        externalId: `demo-pending-${i}`,
      });
    });
    await db.insert(categorizationSuggestions).values([
      { userId: userId, merchantKey: merchantKey(text("Ferramenta Rossi")), direction: "uscita", categoryId: cat("Casa & Arredamento"), confidence: "0.7800", model: "demo", promptVersion: 1 },
      { userId: userId, merchantKey: merchantKey(text("Ottica Vista")), direction: "uscita", categoryId: cat("Salute"), confidence: "0.7100", model: "demo", promptVersion: 1 },
    ]);
    await db.insert(categorizationRules).values({ userId: userId, matchType: "merchant", pattern: merchantKey(text("Rata mutuo")), categoryId: cat("Affitto & Mutuo"), source: "appresa" });
  }
  for (const [accountId, amount] of [[checking.id, -250], [savings.id, 250]] as const) {
    rows.push({ userId: userId, accountId, categoryId: cat("Trasferimenti tra i miei conti"),
      description: text("Giroconto al conto deposito"), amount: amount.toFixed(2), excludedAmount: amount.toFixed(2),
      date: iso(today), source: "auto", externalId: `demo-transfer-${accountId}` });
  }
  for (let i = 0; i < rows.length; i += 200) await db.insert(transactions).values(rows.slice(i, i + 200));
  await db
    .update(accounts)
    .set({ balance: round2(2100 + net).toFixed(2) })
    .where(eq(accounts.id, checking.id));

  await db.insert(budgets).values([
    { userId: userId, categoryId: cat("Ristoranti & Bar"), monthlyAmount: "180.00" },
    { userId: userId, categoryId: cat("Spesa"), monthlyAmount: "420.00" },
    { userId: userId, categoryId: cat("Shopping"), monthlyAmount: "150.00" },
    { userId: userId, categoryId: cat("Abbonamenti"), monthlyAmount: "30.00" },
  ]);

  // Abbonamenti: Giulia confirmed hers and discarded the mortgage; the insurance and the (stopped) newspaper are left to decide.
  await db.insert(subscriptions).values([
    { userId: userId, key: subscriptionKey(text("Netflix")), status: "confermato", origin: "rilevato", name: text("Netflix"), amount: "13.99", cadence: "mensile", categoryId: cat("Abbonamenti") },
    { userId: userId, key: subscriptionKey(text("Spotify")), status: "confermato", origin: "rilevato", name: text("Spotify"), amount: "10.99", cadence: "mensile", categoryId: cat("Abbonamenti") },
    { userId: userId, key: subscriptionKey(text("iCloud+")), status: "confermato", origin: "rilevato", name: text("iCloud+"), amount: "2.99", cadence: "mensile", categoryId: cat("Abbonamenti") },
    { userId: userId, key: subscriptionKey(text("Palestra Olimpia")), status: "confermato", origin: "rilevato", name: text("Palestra Olimpia"), amount: "39.00", cadence: "mensile", categoryId: cat("Sport & Benessere") },
    { userId: userId, key: subscriptionKey(text("TIM")), status: "confermato", origin: "rilevato", name: text("TIM"), amount: "34.90", cadence: "mensile", categoryId: cat("Bollette & Telefono") },
    { userId: userId, key: subscriptionKey(text("Rata mutuo")), status: "escluso", origin: "rilevato", name: text("Rata mutuo"), amount: "742.18", cadence: "mensile", categoryId: cat("Affitto & Mutuo") },
  ]);

  // Investments: a varied portfolio across two brokers, with prices, watchlist, alerts and targets (`seed-investments.ts`).
  const investments = await seedDemoInvestments({ userId, productCountry: PROFILE.productCountry, text, rand, today });

  // Savings goals (Analitiche → Obiettivi): emergency fund from the savings account, a trip with a date and a home partly
  // funded by the ETF, so the view shows priorities, a date and the shift of the target.
  const goalMonth = (monthsAhead: number) => iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthsAhead, 1)));
  const [emergency, trip, home] = await db
    .insert(goals)
    .values([
      { userId: userId, name: text("Fondo di emergenza"), kind: "emergenza", targetAmount: "9000.00", monthlyAmount: "150.00", priority: 0 },
      { userId: userId, name: text("Viaggio in Giappone"), kind: "viaggio", targetAmount: "4500.00", targetDate: goalMonth(10), monthlyAmount: "200.00", priority: 1 },
      { userId: userId, name: text("Anticipo casa"), kind: "casa", targetAmount: "40000.00", targetDate: goalMonth(60), monthlyAmount: "250.00", priority: 2 },
    ])
    .returning();
  await db.insert(goalSources).values([
    { userId: userId, goalId: emergency.id, accountId: savings.id, amount: "7500.00" },
    { userId: userId, goalId: trip.id, accountId: savings.id, amount: "1800.00" },
    { userId: userId, goalId: home.id, instrumentId: investments.globalEtfId, amount: "12000.00" },
  ]);

  // Debts: a fixed-rate mortgage (invented values).
  const mortgageStart = new Date(Date.UTC(today.getUTCFullYear() - 3, today.getUTCMonth(), 5));
  const [mortgage] = await db
    .insert(debts)
    .values({
      userId: userId,
      kind: "loan",
      name: text("Mutuo casa"),
      startMode: "origine",
      principal: "38000.00",
      annualRate: "2.9000",
      installments: 120,
      firstInstallmentDate: iso(mortgageStart),
    })
    .returning();
  const paid = 36;
  await db.insert(debtEvents).values(
    Array.from({ length: paid }, (_, i) => {
      const d = new Date(Date.UTC(mortgageStart.getUTCFullYear(), mortgageStart.getUTCMonth() + i, 5));
      return { debtId: mortgage.id, userId: userId, type: "payment" as const, date: iso(d), installmentNumber: i + 1 };
    })
  );
  // Two smaller, more expensive loans, so the overview compares debts (instalments paid up to last month).
  const smallLoans = [
    { name: text("Prestito auto"), principal: "14000.00", annualRate: "6.9000", installments: 60, paid: 14, day: 12 },
    { name: text("Cucina e lavatrice"), principal: "2400.00", annualRate: "11.9000", installments: 24, paid: 9, day: 20 },
  ];
  for (const loan of smallLoans) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - loan.paid, loan.day));
    const [row] = await db
      .insert(debts)
      .values({ userId: userId, kind: "loan", name: loan.name, startMode: "origine", principal: loan.principal, annualRate: loan.annualRate, installments: loan.installments, firstInstallmentDate: iso(start) })
      .returning();
    await db.insert(debtEvents).values(
      Array.from({ length: loan.paid }, (_, i) => ({
        debtId: row.id,
        userId: userId,
        type: "payment" as const,
        date: iso(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, loan.day))),
        installmentNumber: i + 1,
      }))
    );
  }

  // Pension: a fund opened 4 years ago, with only TFR (Italian severance pay) paid in every quarter (invented values).
  const [pensionFund] = await db
    .insert(pensionFunds)
    .values({ userId: userId, name: text("Piano pensione"), adhesionDate: iso(new Date(Date.UTC(today.getUTCFullYear() - 4, today.getUTCMonth(), 15))) })
    .returning();
  const pensionQuarters = 16;
  const quarterlyTfr = 620;
  let pensionValue = 0;
  await db.insert(pensionSnapshots).values(
    Array.from({ length: pensionQuarters }, (_, i) => {
      pensionValue = (pensionValue + quarterlyTfr) * (1 + between(-0.012, 0.028));
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3 * (pensionQuarters - 1 - i), 1));
      return { fundId: pensionFund.id, userId: userId, date: iso(date), netContributions: ((i + 1) * quarterlyTfr).toFixed(2), value: pensionValue.toFixed(2) };
    })
  );

  // The net worth history is rebuilt by the app's real code (the same as the daily cron).
  await snapshotUser(userId);

  return { transactions: rows.length, operations: investments.operations, prices: investments.prices };
}
