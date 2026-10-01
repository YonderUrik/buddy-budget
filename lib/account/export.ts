import "server-only";
import { asc, eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { debtEvents, debts } from "@/lib/db/schema/debts";
import {
  instruments,
  investmentPlans,
  investmentPortfolios,
  investmentTargets,
  investmentTaxCarryforwards,
  investmentTransactions,
  userDismissedDividends,
  userInstrumentBreakdowns,
  userInstrumentPrices,
  userInstrumentSettings,
  userPriceAlerts,
  userWatchlistItems,
} from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { decimal, toCsv } from "./csv";

/** Versione del formato JSON dell'export: da incrementare se cambia la struttura. */
export const EXPORT_FORMAT_VERSION = 1;

/** Nome del file ZIP scaricato, con la data dell'export. */
export function exportFileName(now: Date): string {
  return `buddybudget-export-${now.toISOString().slice(0, 10)}.zip`;
}

const README = `Esportazione dei tuoi dati da BuddyBudget.

- dati-completi.json: tutti i dati in un unico file, con gli id che collegano le righe tra loro.
  Adatto a programmi e a un'eventuale importazione futura.
- *.csv: le stesse informazioni in tabelle da aprire con Excel, Numbers o LibreOffice
  (separatore punto e virgola, decimali con la virgola, date AAAA-MM-GG).
  Gli importi sono nella valuta scelta nelle impostazioni, tranne i prezzi degli investimenti,
  che sono nella valuta dello strumento.

Non sono inclusi: sessioni di accesso, token e identificativi tecnici dei collegamenti bancari.
`;

/** Legge tutti i dati dell'utente (solo i suoi) e li raccoglie per l'export. */
async function loadUserData(userId: string) {
  const [user] = await db
    .select({
      name: authUser.name,
      email: authUser.email,
      currency: authUser.currency,
      homePage: authUser.homePage,
      createdAt: authUser.createdAt,
    })
    .from(authUser)
    .where(eq(authUser.id, userId));
  if (!user) throw new Error("Utente non trovato");

  const [
    accountRows,
    connectionRows,
    categoryRows,
    budgetRows,
    ruleRows,
    transactionRows,
    portfolioRows,
    operationRows,
    planRows,
    manualPriceRows,
    targetRows,
    breakdownRows,
    snapshotRows,
    instrumentSettingRows,
    carryforwardRows,
    dismissedDividendRows,
    watchlistRows,
    priceAlertRows,
    debtRows,
    debtEventRows,
  ] = await Promise.all([
    db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        balance: accounts.balance,
        source: accounts.source,
        color: accounts.color,
        icon: accounts.icon,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.createdAt)),
    db
      .select({
        id: bankConnections.id,
        institutionName: bankConnections.institutionName,
        status: bankConnections.status,
        consentExpiresAt: bankConnections.consentExpiresAt,
        createdAt: bankConnections.createdAt,
        accountId: bankAccountLinks.accountId,
        lastSyncedAt: bankAccountLinks.lastSyncedAt,
      })
      .from(bankConnections)
      .leftJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
      .where(eq(bankConnections.userId, userId)),
    db
      .select({
        id: categories.id,
        name: categories.name,
        type: categories.type,
        color: categories.color,
        icon: categories.icon,
        isFallback: categories.isFallback,
      })
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.name)),
    db
      .select({ categoryId: budgets.categoryId, monthlyAmount: budgets.monthlyAmount, updatedAt: budgets.updatedAt })
      .from(budgets)
      .where(eq(budgets.userId, userId)),
    db
      .select({
        id: categorizationRules.id,
        matchType: categorizationRules.matchType,
        pattern: categorizationRules.pattern,
        categoryId: categorizationRules.categoryId,
        splitPercentage: categorizationRules.splitPercentage,
        source: categorizationRules.source,
        hitCount: categorizationRules.hitCount,
        lastAppliedAt: categorizationRules.lastAppliedAt,
        createdAt: categorizationRules.createdAt,
      })
      .from(categorizationRules)
      .where(eq(categorizationRules.userId, userId)),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        rawDescription: transactions.rawDescription,
        note: transactions.note,
        amount: transactions.amount,
        excludedAmount: transactions.excludedAmount,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        source: transactions.source,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(asc(transactions.date), asc(transactions.createdAt)),
    db
      .select({ id: investmentPortfolios.id, name: investmentPortfolios.name, broker: investmentPortfolios.broker, taxRegime: investmentPortfolios.taxRegime })
      .from(investmentPortfolios)
      .where(eq(investmentPortfolios.userId, userId)),
    db
      .select({
        id: investmentTransactions.id,
        portfolioId: investmentTransactions.portfolioId,
        date: investmentTransactions.date,
        type: investmentTransactions.type,
        instrumentId: investmentTransactions.instrumentId,
        instrumentName: instruments.name,
        isin: instruments.isin,
        instrumentType: instruments.type,
        instrumentCurrency: instruments.currency,
        quantity: investmentTransactions.quantity,
        price: investmentTransactions.price,
        fxRate: investmentTransactions.fxRate,
        fees: investmentTransactions.fees,
        taxes: investmentTransactions.taxes,
        grossAmount: investmentTransactions.grossAmount,
        note: investmentTransactions.note,
      })
      .from(investmentTransactions)
      .innerJoin(instruments, eq(instruments.id, investmentTransactions.instrumentId))
      .where(eq(investmentTransactions.userId, userId))
      .orderBy(asc(investmentTransactions.date)),
    db
      .select({
        id: investmentPlans.id,
        portfolioId: investmentPlans.portfolioId,
        instrumentId: investmentPlans.instrumentId,
        instrumentName: instruments.name,
        isin: instruments.isin,
        amount: investmentPlans.amount,
        frequency: investmentPlans.frequency,
        dayOfMonth: investmentPlans.dayOfMonth,
        active: investmentPlans.active,
      })
      .from(investmentPlans)
      .innerJoin(instruments, eq(instruments.id, investmentPlans.instrumentId))
      .where(eq(investmentPlans.userId, userId)),
    db
      .select({
        instrumentId: userInstrumentPrices.instrumentId,
        instrumentName: instruments.name,
        date: userInstrumentPrices.date,
        close: userInstrumentPrices.close,
      })
      .from(userInstrumentPrices)
      .innerJoin(instruments, eq(instruments.id, userInstrumentPrices.instrumentId))
      .where(eq(userInstrumentPrices.userId, userId)),
    db
      .select({
        portfolioId: investmentTargets.portfolioId,
        instrumentId: investmentTargets.instrumentId,
        instrumentName: instruments.name,
        weight: investmentTargets.weight,
      })
      .from(investmentTargets)
      .innerJoin(investmentPortfolios, eq(investmentPortfolios.id, investmentTargets.portfolioId))
      .innerJoin(instruments, eq(instruments.id, investmentTargets.instrumentId))
      .where(eq(investmentPortfolios.userId, userId)),
    db
      .select({
        instrumentId: userInstrumentBreakdowns.instrumentId,
        instrumentName: instruments.name,
        sectors: userInstrumentBreakdowns.sectors,
        areas: userInstrumentBreakdowns.areas,
      })
      .from(userInstrumentBreakdowns)
      .innerJoin(instruments, eq(instruments.id, userInstrumentBreakdowns.instrumentId))
      .where(eq(userInstrumentBreakdowns.userId, userId)),
    db
      .select({
        date: netWorthSnapshots.date,
        assetClass: netWorthSnapshots.assetClass,
        amount: netWorthSnapshots.amount,
        source: netWorthSnapshots.source,
      })
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.userId, userId))
      .orderBy(asc(netWorthSnapshots.date), asc(netWorthSnapshots.assetClass)),
    db
      .select({
        instrumentId: userInstrumentSettings.instrumentId,
        instrumentName: instruments.name,
        taxRate: userInstrumentSettings.taxRate,
        taxHarmonized: userInstrumentSettings.taxHarmonized,
        couponRate: userInstrumentSettings.couponRate,
        couponFrequency: userInstrumentSettings.couponFrequency,
        maturityDate: userInstrumentSettings.maturityDate,
      })
      .from(userInstrumentSettings)
      .innerJoin(instruments, eq(instruments.id, userInstrumentSettings.instrumentId))
      .where(eq(userInstrumentSettings.userId, userId)),
    db
      .select({
        portfolioId: investmentTaxCarryforwards.portfolioId,
        year: investmentTaxCarryforwards.year,
        amount: investmentTaxCarryforwards.amount,
        note: investmentTaxCarryforwards.note,
      })
      .from(investmentTaxCarryforwards)
      .where(eq(investmentTaxCarryforwards.userId, userId)),
    db
      .select({ instrumentId: userDismissedDividends.instrumentId, instrumentName: instruments.name, date: userDismissedDividends.date })
      .from(userDismissedDividends)
      .innerJoin(instruments, eq(instruments.id, userDismissedDividends.instrumentId))
      .where(eq(userDismissedDividends.userId, userId)),
    db
      .select({ instrumentId: userWatchlistItems.instrumentId, instrumentName: instruments.name, isin: instruments.isin, createdAt: userWatchlistItems.createdAt })
      .from(userWatchlistItems)
      .innerJoin(instruments, eq(instruments.id, userWatchlistItems.instrumentId))
      .where(eq(userWatchlistItems.userId, userId)),
    db
      .select({
        instrumentId: userPriceAlerts.instrumentId,
        instrumentName: instruments.name,
        isin: instruments.isin,
        currency: instruments.currency,
        direction: userPriceAlerts.direction,
        targetPrice: userPriceAlerts.targetPrice,
        status: userPriceAlerts.status,
        triggeredAt: userPriceAlerts.triggeredAt,
        triggeredPrice: userPriceAlerts.triggeredPrice,
        createdAt: userPriceAlerts.createdAt,
      })
      .from(userPriceAlerts)
      .innerJoin(instruments, eq(instruments.id, userPriceAlerts.instrumentId))
      .where(eq(userPriceAlerts.userId, userId)),
    db
      .select({
        id: debts.id,
        kind: debts.kind,
        name: debts.name,
        startMode: debts.startMode,
        principal: debts.principal,
        annualRate: debts.annualRate,
        installments: debts.installments,
        firstInstallmentDate: debts.firstInstallmentDate,
        installment: debts.installment,
        anchorDate: debts.anchorDate,
        costs: debts.costs,
        createdAt: debts.createdAt,
      })
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(asc(debts.createdAt)),
    db
      .select({
        id: debtEvents.id,
        debtId: debtEvents.debtId,
        type: debtEvents.type,
        date: debtEvents.date,
        amount: debtEvents.amount,
        installmentNumber: debtEvents.installmentNumber,
        rate: debtEvents.rate,
        penalty: debtEvents.penalty,
        effect: debtEvents.effect,
        transactionId: debtEvents.transactionId,
        note: debtEvents.note,
        createdAt: debtEvents.createdAt,
      })
      .from(debtEvents)
      .where(eq(debtEvents.userId, userId))
      .orderBy(asc(debtEvents.date)),
  ]);

  return {
    user,
    accounts: accountRows,
    bankConnections: connectionRows,
    categories: categoryRows,
    budgets: budgetRows,
    rules: ruleRows,
    transactions: transactionRows,
    investmentPortfolios: portfolioRows,
    investmentOperations: operationRows,
    investmentPlans: planRows,
    manualPrices: manualPriceRows,
    investmentTargets: targetRows,
    instrumentBreakdowns: breakdownRows,
    netWorth: snapshotRows,
    instrumentSettings: instrumentSettingRows,
    taxCarryforwards: carryforwardRows,
    dismissedDividends: dismissedDividendRows,
    watchlist: watchlistRows,
    priceAlerts: priceAlertRows,
    debts: debtRows,
    debtEvents: debtEventRows,
  };
}

export type UserExportData = Awaited<ReturnType<typeof loadUserData>>;

/** File dell'archivio (percorso → contenuto testuale) a partire dai dati letti. Pura: testabile senza DB. */
export function buildExportFiles(data: UserExportData, now: Date): Record<string, string> {
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]));
  const portfolioName = new Map(data.investmentPortfolios.map((p) => [p.id, p.name]));
  const debtName = new Map(data.debts.map((d) => [d.id, d.name]));

  const json = JSON.stringify({ format: "buddybudget-export", version: EXPORT_FORMAT_VERSION, exportedAt: now.toISOString(), ...data }, null, 2);

  return {
    "LEGGIMI.txt": README,
    "dati-completi.json": json,
    "transazioni.csv": toCsv(data.transactions, [
      { header: "Data", value: (t) => t.date },
      { header: "Descrizione", value: (t) => t.description },
      { header: "Descrizione originale", value: (t) => t.rawDescription },
      { header: "Nota", value: (t) => t.note },
      { header: "Importo", value: (t) => decimal(t.amount) },
      { header: "Quota esclusa (Dividi)", value: (t) => decimal(t.excludedAmount) },
      { header: "Categoria", value: (t) => categoryName.get(t.categoryId) },
      { header: "Conto", value: (t) => accountName.get(t.accountId) },
      { header: "Origine", value: (t) => t.source },
    ]),
    "conti.csv": toCsv(data.accounts, [
      { header: "Nome", value: (a) => a.name },
      { header: "Tipo", value: (a) => a.type },
      { header: "Saldo", value: (a) => decimal(a.balance) },
      { header: "Origine", value: (a) => a.source },
      { header: "Creato il", value: (a) => a.createdAt },
    ]),
    "categorie.csv": toCsv(data.categories, [
      { header: "Nome", value: (c) => c.name },
      { header: "Gruppo", value: (c) => c.type },
      { header: "Colore", value: (c) => c.color },
      { header: "Icona", value: (c) => c.icon },
    ]),
    "budget.csv": toCsv(data.budgets, [
      { header: "Categoria", value: (b) => categoryName.get(b.categoryId) },
      { header: "Budget mensile", value: (b) => decimal(b.monthlyAmount) },
    ]),
    "regole-categorizzazione.csv": toCsv(data.rules, [
      { header: "Tipo", value: (r) => r.matchType },
      { header: "Testo", value: (r) => r.pattern },
      { header: "Categoria", value: (r) => categoryName.get(r.categoryId) },
      { header: "Quota divisa", value: (r) => decimal(r.splitPercentage) },
      { header: "Origine", value: (r) => r.source },
      { header: "Utilizzi", value: (r) => r.hitCount },
    ]),
    "investimenti-operazioni.csv": toCsv(data.investmentOperations, [
      { header: "Data", value: (o) => o.date },
      { header: "Tipo", value: (o) => o.type },
      { header: "Strumento", value: (o) => o.instrumentName },
      { header: "ISIN", value: (o) => o.isin },
      { header: "Quantità", value: (o) => decimal(o.quantity) },
      { header: "Prezzo", value: (o) => decimal(o.price) },
      { header: "Valuta strumento", value: (o) => o.instrumentCurrency },
      { header: "Cambio", value: (o) => decimal(o.fxRate) },
      { header: "Commissioni", value: (o) => decimal(o.fees) },
      { header: "Imposte", value: (o) => decimal(o.taxes) },
      { header: "Importo lordo (proventi)", value: (o) => decimal(o.grossAmount) },
      { header: "Portafoglio", value: (o) => portfolioName.get(o.portfolioId) },
      { header: "Nota", value: (o) => o.note },
    ]),
    "investimenti-pac.csv": toCsv(data.investmentPlans, [
      { header: "Strumento", value: (p) => p.instrumentName },
      { header: "ISIN", value: (p) => p.isin },
      { header: "Importo", value: (p) => decimal(p.amount) },
      { header: "Frequenza", value: (p) => p.frequency },
      { header: "Giorno del mese", value: (p) => p.dayOfMonth },
      { header: "Attivo", value: (p) => p.active },
    ]),
    "investimenti-titoli-seguiti.csv": toCsv(data.watchlist, [
      { header: "Strumento", value: (w) => w.instrumentName },
      { header: "ISIN", value: (w) => w.isin },
      { header: "Seguito dal", value: (w) => w.createdAt },
    ]),
    "investimenti-avvisi-prezzo.csv": toCsv(data.priceAlerts, [
      { header: "Strumento", value: (a) => a.instrumentName },
      { header: "ISIN", value: (a) => a.isin },
      { header: "Direzione", value: (a) => a.direction },
      { header: "Livello", value: (a) => decimal(a.targetPrice) },
      { header: "Valuta", value: (a) => a.currency },
      { header: "Stato", value: (a) => a.status },
      { header: "Scattato il", value: (a) => a.triggeredAt },
      { header: "Chiusura allo scatto", value: (a) => decimal(a.triggeredPrice) },
    ]),
    "debiti.csv": toCsv(data.debts, [
      { header: "Nome", value: (d) => d.name },
      { header: "Tipo", value: (d) => d.kind },
      { header: "Avvio", value: (d) => d.startMode },
      { header: "Capitale", value: (d) => decimal(d.principal) },
      { header: "Tasso annuo (%)", value: (d) => decimal(d.annualRate) },
      { header: "Rate", value: (d) => d.installments },
      { header: "Prima scadenza", value: (d) => d.firstInstallmentDate },
      { header: "Rata dichiarata", value: (d) => decimal(d.installment) },
    ]),
    "debiti-eventi.csv": toCsv(data.debtEvents, [
      { header: "Debito", value: (e) => debtName.get(e.debtId) },
      { header: "Data", value: (e) => e.date },
      { header: "Tipo", value: (e) => e.type },
      { header: "Rata n.", value: (e) => e.installmentNumber },
      { header: "Importo", value: (e) => decimal(e.amount) },
      { header: "Nuovo tasso (%)", value: (e) => decimal(e.rate) },
      { header: "Penale", value: (e) => decimal(e.penalty) },
      { header: "Effetto estinzione", value: (e) => e.effect },
      { header: "Nota", value: (e) => e.note },
    ]),
    "patrimonio-netto.csv": toCsv(data.netWorth, [
      { header: "Data", value: (s) => s.date },
      { header: "Classe", value: (s) => s.assetClass },
      { header: "Valore", value: (s) => decimal(s.amount) },
      { header: "Origine", value: (s) => s.source },
    ]),
  };
}

/** Archivio ZIP con tutti i dati dell'utente (JSON completo + CSV). */
export async function buildUserExportZip(userId: string, now: Date = new Date()): Promise<Uint8Array> {
  const files = buildExportFiles(await loadUserData(userId), now);
  const entries = Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)]));
  return zipSync(entries, { level: 6, mtime: now });
}
