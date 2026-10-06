/**
 * Dati demo per le schermate della landing: crea l'utente "Giulia Demo" con conti, movimenti, budget,
 * investimenti e debiti plausibili, tutti finti e deterministici (generatore con seme fisso).
 *
 * Gira su un database VUOTO e migrato (mai su quello di produzione né di sviluppo con dati veri): rifiuta di
 * partire se l'utente demo non esiste e il database contiene già altri utenti.
 * Uso: `pnpm demo:seed` con `DATABASE_URL` che punta al database demo. Vedi `docs/landing-screens.md`.
 */
import { eq, like } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { accounts } from "@/lib/db/schema/accounts";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { debtEvents, debts } from "@/lib/db/schema/debts";
import { pensionFunds, pensionSnapshots } from "@/lib/db/schema/pension";
import {
  instrumentPrices,
  instruments,
  investmentPortfolios,
  investmentTransactions,
} from "@/lib/db/schema/investments";
import { transactions } from "@/lib/db/schema/transactions";
import { LEGAL_VERSION } from "@/lib/legal";
import { snapshotUser } from "@/lib/net-worth/scheduler";

export const DEMO_USER_ID = "demo-user";
export const DEMO_SESSION_TOKEN = "demo-session-token-0000000000000000";

const MONTHS_OF_HISTORY = 12;
const SEED = 20261001;

/** Generatore pseudo-casuale mulberry32: stessi numeri a ogni esecuzione. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const between = (min: number, max: number) => min + rand() * (max - min);
const round2 = (n: number) => Math.round(n * 100) / 100;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
const monthStart = (back: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
const dayOfMonth = (back: number, day: number) => {
  const m = monthStart(back);
  return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), Math.min(day, 28)));
};

interface Recurring {
  category: string;
  description: string;
  raw: string;
  min: number;
  max: number;
  day: number;
  perMonth?: number;
}

const EXPENSES: Recurring[] = [
  { category: "Affitto & Mutuo", description: "Rata mutuo", raw: "ADDEBITO SDD RATA MUTUO N. 4471", min: 742.18, max: 742.18, day: 5 },
  { category: "Bollette & Utenze", description: "Luce e gas", raw: "SDD ENERGIA PIU SPA FATT 2291", min: 68, max: 135, day: 12 },
  { category: "Internet & Telefono", description: "Fibra e mobile", raw: "ADDEBITO TELCO SRL CANONE", min: 34.9, max: 34.9, day: 9 },
  { category: "Spesa alimentare", description: "Supermercato", raw: "PAGAMENTO POS SUPERMERCATO CENTRO 0412", min: 18, max: 96, day: 3, perMonth: 7 },
  { category: "Trasporti & Carburante", description: "Carburante", raw: "PAGAMENTO POS STAZIONE DI SERVIZIO", min: 35, max: 62, day: 8, perMonth: 2 },
  { category: "Ristoranti & Bar", description: "Ristorante", raw: "PAGAMENTO POS TRATTORIA DA MARIO", min: 22, max: 78, day: 15, perMonth: 4 },
  { category: "Abbonamenti & Streaming", description: "Streaming video", raw: "PAGAMENTO ONLINE STREAMINGCO", min: 13.99, max: 13.99, day: 17 },
  { category: "Abbonamenti & Streaming", description: "Musica", raw: "PAGAMENTO ONLINE MUSICAPP", min: 10.99, max: 10.99, day: 19 },
  { category: "Sport & Benessere", description: "Palestra", raw: "ADDEBITO SDD FITNESS CLUB", min: 39, max: 39, day: 7 },
  { category: "Shopping & Tecnologia", description: "Acquisto online", raw: "PAGAMENTO ONLINE MARKETPLACE", min: 24, max: 140, day: 21, perMonth: 1 },
  { category: "Abbigliamento", description: "Negozio abbigliamento", raw: "PAGAMENTO POS MODA STORE", min: 30, max: 120, day: 23, perMonth: 1 },
  { category: "Salute & Farmaci", description: "Farmacia", raw: "PAGAMENTO POS FARMACIA COMUNALE", min: 9, max: 38, day: 11, perMonth: 1 },
  { category: "Viaggi & Vacanze", description: "Viaggio", raw: "PAGAMENTO ONLINE AGENZIA VIAGGI", min: 120, max: 420, day: 24, perMonth: 1 },
];

async function main() {
  const others = await db.select({ id: authUser.id }).from(authUser);
  if (others.some((user) => user.id !== DEMO_USER_ID)) {
    throw new Error("Il database contiene già altri utenti: il seed demo gira solo su un database vuoto.");
  }
  await db.delete(authUser).where(eq(authUser.id, DEMO_USER_ID));
  // Gli strumenti demo sopravvivono all'utente (created_by si azzera): si rimuovono per ISIN fittizio prima di ricrearli.
  await db.delete(instruments).where(like(instruments.isin, "__00DEMO%"));

  await db.insert(authUser).values({
    id: DEMO_USER_ID,
    name: "Giulia Demo",
    email: "giulia.demo@example.com",
    emailVerified: true,
    currency: "EUR",
    onboardingCompleted: true,
    // Termini già accettati, sempre nella versione in vigore al momento del seed: così il gate di proxy.ts non rimanda a /accetta-termini.
    legalAcceptedAt: new Date(),
    legalAcceptedVersion: LEGAL_VERSION,
  });
  // Guida di Analitiche già vista: la schermata si cattura senza il dialogo di benvenuto.
  await db.insert(analyticsAssumptions).values({ userId: DEMO_USER_ID, walkthroughSeenAt: new Date() });
  await db.insert(authSession).values({
    id: "demo-session",
    userId: DEMO_USER_ID,
    token: DEMO_SESSION_TOKEN,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });

  const cats = await db.insert(categories).values(defaultCategoryRows(DEMO_USER_ID)).returning();
  const cat = (name: string) => {
    const found = cats.find((c) => c.name === name);
    if (!found) throw new Error(`Categoria demo mancante: ${name}`);
    return found.id;
  };

  const [checking, savings, cash] = await db
    .insert(accounts)
    .values([
      { userId: DEMO_USER_ID, name: "Conto corrente", type: "Conto corrente", balance: "0", color: "blue", icon: "landmark", source: "auto" },
      { userId: DEMO_USER_ID, name: "Conto deposito", type: "Conto deposito", balance: "17400.00", color: "emerald", icon: "piggy-bank" },
      { userId: DEMO_USER_ID, name: "Contanti", type: "Contanti", balance: "145.00", color: "amber", icon: "wallet" },
    ])
    .returning();

  // Movimenti: stipendio e spese ricorrenti degli ultimi mesi, con date e importi variabili ma deterministici.
  const rows: (typeof transactions.$inferInsert)[] = [];
  let net = 0;
  for (let back = MONTHS_OF_HISTORY; back >= 0; back--) {
    const push = (date: Date, categoryName: string, description: string, raw: string | null, amount: number, accountId = checking.id) => {
      if (date.getTime() > today.getTime()) return;
      net += amount;
      rows.push({
        userId: DEMO_USER_ID,
        accountId,
        categoryId: cat(categoryName),
        description,
        rawDescription: raw,
        amount: amount.toFixed(2),
        date: iso(date),
        source: "auto",
        externalId: `demo-${rows.length}`,
      });
    };
    push(dayOfMonth(back, 27), "Stipendio", "Stipendio", "BONIFICO A VOSTRO FAVORE ACME SRL STIPENDIO", 2480);
    if (back % 4 === 1) push(dayOfMonth(back, 14), "Freelance", "Consulenza", "BONIFICO FATT 12/26", round2(between(380, 720)));
    for (const e of EXPENSES) {
      const times = e.perMonth ?? 1;
      for (let i = 0; i < times; i++) {
        const day = Math.min(28, e.day + i * 4 + Math.floor(between(0, 3)));
        push(dayOfMonth(back, day), e.category, e.description, e.raw, -round2(between(e.min, e.max)));
      }
    }
    if (back % 3 === 0) push(dayOfMonth(back, 20), "Investimenti", "Versamento PAC", "BONIFICO PAC ETF AZIONARIO", -300);
  }
  // Movimenti ancora da categorizzare, per la schermata "Categorizza".
  const fallback = cats.find((c) => c.isFallback);
  if (fallback) {
    // Descrizioni uguali a quelle già categorizzate: la pagina le propone dallo storico.
    const pending = [
      ["Supermercato", "PAGAMENTO POS SUPERMERCATO CENTRO 0412", -23.4],
      ["Supermercato", "PAGAMENTO POS SUPERMERCATO CENTRO 0412", -41.7],
      ["Ristorante", "PAGAMENTO POS TRATTORIA DA MARIO", -34],
      ["Carburante", "PAGAMENTO POS STAZIONE DI SERVIZIO", -48.2],
      ["Farmacia", "PAGAMENTO POS FARMACIA COMUNALE", -12.5],
      ["Bonifico a favore di Luca", "BONIFICO A FAVORE DI LUCA R", -50],
    ] as const;
    pending.forEach(([description, raw, amount], i) => {
      net += amount;
      rows.push({
        userId: DEMO_USER_ID,
        accountId: checking.id,
        categoryId: fallback.id,
        description,
        rawDescription: raw,
        amount: amount.toFixed(2),
        date: iso(daysAgo(i + 1)),
        source: "auto",
        externalId: `demo-pending-${i}`,
      });
    });
  }
  for (let i = 0; i < rows.length; i += 200) await db.insert(transactions).values(rows.slice(i, i + 200));
  await db
    .update(accounts)
    .set({ balance: round2(2100 + net).toFixed(2) })
    .where(eq(accounts.id, checking.id));

  await db.insert(budgets).values([
    { userId: DEMO_USER_ID, categoryId: cat("Ristoranti & Bar"), monthlyAmount: "180.00" },
    { userId: DEMO_USER_ID, categoryId: cat("Spesa alimentare"), monthlyAmount: "420.00" },
    { userId: DEMO_USER_ID, categoryId: cat("Shopping & Tecnologia"), monthlyAmount: "150.00" },
    { userId: DEMO_USER_ID, categoryId: cat("Abbonamenti & Streaming"), monthlyAmount: "30.00" },
  ]);

  // Investimenti: un ETF globale, un'azione e un BTP, con prezzi giornalieri finti (passeggiata aleatoria).
  const [portfolio] = await db
    .insert(investmentPortfolios)
    .values({ userId: DEMO_USER_ID, name: "Portafoglio principale", broker: "Broker Demo", taxRegime: "amministrato" })
    .returning();
  const [etf, stock, bond, tech] = await db
    .insert(instruments)
    .values([
      { isin: "IE00DEMO0001", name: "ETF Azionario Globale Demo", type: "etf", currency: "EUR", exchange: "XETRA", taxHarmonized: true, createdByUserId: DEMO_USER_ID },
      { isin: "IT00DEMO0002", name: "Energia Italia S.p.A.", type: "azione", currency: "EUR", exchange: "MIL", createdByUserId: DEMO_USER_ID },
      { isin: "IT00DEMO0003", name: "BTP Valore 2030", type: "obbligazione", currency: "EUR", priceUnit: "percentuale_nominale", taxRate: "0.1250", createdByUserId: DEMO_USER_ID },
      { isin: "IT00DEMO0004", name: "Tecnologia Futura S.p.A.", type: "azione", currency: "EUR", exchange: "MIL", createdByUserId: DEMO_USER_ID },
    ])
    .returning();
  const priceDays = 430;
  const series = (start: number, drift: number, vol: number) => {
    const out: number[] = [];
    let p = start;
    for (let i = 0; i < priceDays; i++) {
      p *= 1 + drift + (rand() - 0.5) * vol;
      out.push(p);
    }
    return out;
  };
  // Titolo che scende nei primi 50 giorni (da qui la minusvalenza venduta l'anno scorso) e poi recupera piano.
  const techSeries = series(30, 0.0006, 0.016).map((p, i) => (i < 50 ? 30 * (1 - 0.14 * (i / 50)) : p * 0.86));
  const prices = [
    { id: etf.id, s: series(88, 0.0004, 0.012), scale: 1 },
    { id: stock.id, s: series(21, 0.0007, 0.014), scale: 1 },
    { id: bond.id, s: series(99.6, 0.00004, 0.0012), scale: 1 },
    { id: tech.id, s: techSeries, scale: 1 },
  ];
  const priceRows: (typeof instrumentPrices.$inferInsert)[] = [];
  for (const p of prices) {
    p.s.forEach((close, i) => {
      const date = daysAgo(priceDays - 1 - i);
      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) return;
      priceRows.push({ instrumentId: p.id, date: iso(date), close: (close * p.scale).toFixed(4), source: "yahoo" });
    });
  }
  for (let i = 0; i < priceRows.length; i += 500) await db.insert(instrumentPrices).values(priceRows.slice(i, i + 500));
  const priceOn = (id: string, back: number) => {
    const p = prices.find((x) => x.id === id)!;
    return p.s[priceDays - 1 - back];
  };
  const ops: (typeof investmentTransactions.$inferInsert)[] = [];
  for (const back of [330, 270, 210, 150, 90, 30]) {
    const price = priceOn(etf.id, back);
    ops.push({
      userId: DEMO_USER_ID,
      portfolioId: portfolio.id,
      instrumentId: etf.id,
      type: "acquisto",
      date: iso(daysAgo(back)),
      quantity: (Math.floor(3200 / price * 100) / 100).toFixed(2),
      price: price.toFixed(4),
      fees: "1.50",
    });
  }
  ops.push({ userId: DEMO_USER_ID, portfolioId: portfolio.id, instrumentId: stock.id, type: "acquisto", date: iso(daysAgo(300)), quantity: "380", price: priceOn(stock.id, 300).toFixed(4), fees: "4.95" });
  ops.push({ userId: DEMO_USER_ID, portfolioId: portfolio.id, instrumentId: stock.id, type: "dividendo", date: iso(daysAgo(120)), quantity: "0", price: "0", grossAmount: "152.00", taxes: "39.52" });
  ops.push({ userId: DEMO_USER_ID, portfolioId: portfolio.id, instrumentId: bond.id, type: "acquisto", date: iso(daysAgo(200)), quantity: "10000", price: "99.8000", fees: "0" });
  // Vendite: una minusvalenza l'anno scorso (finisce nello zaino fiscale) e una plusvalenza quest'anno che la compensa.
  ops.push({ userId: DEMO_USER_ID, portfolioId: portfolio.id, instrumentId: tech.id, type: "acquisto", date: iso(daysAgo(425)), quantity: "300", price: priceOn(tech.id, 425).toFixed(4), fees: "4.95" });
  ops.push({ userId: DEMO_USER_ID, portfolioId: portfolio.id, instrumentId: tech.id, type: "vendita", date: iso(daysAgo(375)), quantity: "300", price: priceOn(tech.id, 375).toFixed(4), fees: "4.95" });
  ops.push({ userId: DEMO_USER_ID, portfolioId: portfolio.id, instrumentId: stock.id, type: "vendita", date: iso(daysAgo(45)), quantity: "190", price: priceOn(stock.id, 45).toFixed(4), fees: "4.95" });
  await db.insert(investmentTransactions).values(ops);

  // Debiti: mutuo a tasso fisso e una linea di credito Lombard (valori inventati).
  const mortgageStart = new Date(Date.UTC(today.getUTCFullYear() - 3, today.getUTCMonth(), 5));
  const [mortgage] = await db
    .insert(debts)
    .values({
      userId: DEMO_USER_ID,
      kind: "loan",
      name: "Mutuo casa",
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
      return { debtId: mortgage.id, userId: DEMO_USER_ID, type: "payment" as const, date: iso(d), installmentNumber: i + 1 };
    })
  );
  // Altri due finanziamenti più piccoli e più cari, perché la panoramica confronti i debiti (rate già pagate fino al mese scorso).
  const smallLoans = [
    { name: "Prestito auto", principal: "14000.00", annualRate: "6.9000", installments: 60, paid: 14, day: 12 },
    { name: "Cucina e lavatrice", principal: "2400.00", annualRate: "11.9000", installments: 24, paid: 9, day: 20 },
  ];
  for (const loan of smallLoans) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - loan.paid, loan.day));
    const [row] = await db
      .insert(debts)
      .values({ userId: DEMO_USER_ID, kind: "loan", name: loan.name, startMode: "origine", principal: loan.principal, annualRate: loan.annualRate, installments: loan.installments, firstInstallmentDate: iso(start) })
      .returning();
    await db.insert(debtEvents).values(
      Array.from({ length: loan.paid }, (_, i) => ({
        debtId: row.id,
        userId: DEMO_USER_ID,
        type: "payment" as const,
        date: iso(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, loan.day))),
        installmentNumber: i + 1,
      }))
    );
  }

  // Previdenza: un fondo aperto da 4 anni, con solo TFR versato ogni trimestre (valori inventati).
  const [pensionFund] = await db
    .insert(pensionFunds)
    .values({ userId: DEMO_USER_ID, name: "Piano pensione", adhesionDate: iso(new Date(Date.UTC(today.getUTCFullYear() - 4, today.getUTCMonth(), 15))) })
    .returning();
  const pensionQuarters = 16;
  const quarterlyTfr = 620;
  let pensionValue = 0;
  await db.insert(pensionSnapshots).values(
    Array.from({ length: pensionQuarters }, (_, i) => {
      pensionValue = (pensionValue + quarterlyTfr) * (1 + between(-0.012, 0.028));
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3 * (pensionQuarters - 1 - i), 1));
      return { fundId: pensionFund.id, userId: DEMO_USER_ID, date: iso(date), netContributions: ((i + 1) * quarterlyTfr).toFixed(2), value: pensionValue.toFixed(2) };
    })
  );

  // Lo storico del patrimonio netto lo ricostruisce il codice vero dell'app (lo stesso del cron giornaliero).
  await snapshotUser(DEMO_USER_ID);

  console.log(`Demo pronta: ${rows.length} movimenti, ${ops.length} operazioni, ${priceRows.length} prezzi.`);
  void savings;
  void cash;
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
