import { and, eq, gte, isNotNull, lte, notLike } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions, type NewTransaction } from "@/lib/db/schema/transactions";
import { BankProviderError, externalIdPrefix, type BankProviderId, type BankTransactionRecord } from "./provider";
import { getBankProvider } from "./providers";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import { buildRuleResolver, flushRuleHits } from "@/lib/categorization/resolve";
import { categorizeNewMovementsSafely, countStillUncategorized } from "@/lib/categorization/auto-apply";
import { MIN_SYNC_GAP_MS } from "./sync-eligibility";
import { extractMerchantName, FALLBACK_TRANSACTION_NAME, type MerchantNameSource } from "@/lib/categorization/merchant-name";
import { logger, recordMerchantNames } from "@/lib/observability";

const MAX_STORED_SYNC_TIMESTAMPS = 4;
/** Pausa dopo che la banca ha risposto «troppe richieste» senza dire per quanto (Enable Banking non lo comunica). */
export const RATE_LIMIT_PAUSE_SECONDS = 6 * 60 * 60;

/** Righe per singolo INSERT: abbastanza grande da evitare una query per movimento, abbastanza piccolo da dare un avanzamento granulare. */
export const SYNC_INSERT_CHUNK_SIZE = 50;

/** Avanzamento di un sync, notificato a ogni fase e dopo ogni blocco salvato. */
export interface SyncProgress {
  phase: "balance" | "fetching" | "saving";
  total?: number;
  processed?: number;
  inserted?: number;
  categorized?: number;
  uncategorized?: number;
}

export type SyncProgressCallback = (progress: SyncProgress) => Promise<void> | void;

/** L'avanzamento è informativo: un suo errore (es. Redis giù) non deve mai interrompere il sync. */
async function reportProgress(onProgress: SyncProgressCallback | undefined, progress: SyncProgress): Promise<void> {
  if (!onProgress) return;
  try {
    await onProgress(progress);
  } catch (error) {
    logger.warn("bank.sync.progress_failed", { error });
  }
}

export interface SyncableLink {
  linkId: string;
  connectionId: string;
  /** Fornitore della connessione: saldo e movimenti si chiedono a lui. */
  provider: BankProviderId;
  accountId: string;
  externalAccountId: string;
  userId: string;
  /** Import subito dopo il consenso: si chiede tutto lo storico disponibile, non solo i giorni dall'ultimo sync. */
  fullHistory?: boolean;
}

export type SyncResult =
  | {
      status: "synced";
      newTransactionsCount: number;
      categorizedCount: number;
      uncategorizedCount: number;
      balanceUpdated: true;
    }
  | { status: "bank-limited" }
  | { status: "expired" };

/**
 * Sincronizza saldo e transazioni di un conto collegato; aggiorna i timestamp o marca la connessione scaduta.
 * `onProgress` (opzionale) riceve le fasi e, durante il salvataggio, i contatori dopo ogni blocco.
 */
export async function syncAccountLink(
  link: SyncableLink,
  rateLimitStore: RateLimitStore,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "balances")) {
    return { status: "bank-limited" };
  }
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "transactions")) {
    return { status: "bank-limited" };
  }

  const provider = getBankProvider(link.provider);
  try {
    await reportProgress(onProgress, { phase: "balance" });
    const { amount: balanceAmount, rateLimit: balanceRateLimit } = await provider.getBalance(link.externalAccountId);
    if (balanceRateLimit) {
      await recordRateLimit(
        rateLimitStore,
        link.externalAccountId,
        "balances",
        balanceRateLimit.remaining,
        balanceRateLimit.resetSeconds
      );
    }
    await db
      .update(accounts)
      .set({ balance: balanceAmount, updatedAt: new Date() })
      .where(eq(accounts.id, link.accountId));

    await reportProgress(onProgress, { phase: "fetching" });
    const [currentState] = await db
      .select({ lastSyncedAt: bankAccountLinks.lastSyncedAt })
      .from(bankAccountLinks)
      .where(eq(bankAccountLinks.id, link.linkId));
    const { transactions: fetched, rateLimit: txRateLimit } = await provider.getTransactions(link.externalAccountId, {
      since: link.fullHistory ? null : currentState?.lastSyncedAt ?? null,
    });
    if (txRateLimit) {
      await recordRateLimit(
        rateLimitStore,
        link.externalAccountId,
        "transactions",
        txRateLimit.remaining,
        txRateLimit.resetSeconds
      );
    }
    const bankTransactions = await dropMovementsFromPreviousProvider(link, fetched);

    const fallbackCategoryId = await getFallbackCategoryId(link.userId);
    const ruleResolver = await buildRuleResolver(link.userId);

    const rows: NewTransaction[] = [];
    const categorizedAt = new Date();
    const nameSourceCounts = new Map<MerchantNameSource, number>();
    const ruleIdByExternalId = new Map<string, string>();
    for (const bankTransaction of bankTransactions) {
      const { externalId, rawDescription, counterpartyName, amount: amountText } = bankTransaction;
      // Nome che la sync usava prima dell'estrazione: le regole imparate finora sono scritte su di esso,
      // quindi si prova per primo per non far smettere di funzionare quelle già esistenti.
      const legacyDescription = counterpartyName || rawDescription || FALLBACK_TRANSACTION_NAME;
      const extracted = extractMerchantName({ rawText: rawDescription, counterpartyName });
      nameSourceCounts.set(extracted.source, (nameSourceCounts.get(extracted.source) ?? 0) + 1);
      const description = extracted.name;
      const amount = Number(amountText);
      const resolved =
        ruleResolver.resolve({ description: legacyDescription, amount }) ??
        (description === legacyDescription ? null : ruleResolver.resolve({ description, amount }));
      if (resolved) ruleIdByExternalId.set(externalId, resolved.ruleId);

      rows.push({
        userId: link.userId,
        accountId: link.accountId,
        categoryId: resolved?.categoryId ?? fallbackCategoryId,
        description,
        rawDescription,
        merchantCategoryCode: bankTransaction.merchantCategoryCode ?? null,
        amount: amountText,
        excludedAmount: (resolved?.excludedAmount ?? 0).toFixed(2),
        ...(resolved ? { categorySource: "regola" as const, categorizedAt } : {}),
        date: bankTransaction.bookingDate,
        source: "auto",
        externalId,
      });
    }

    let newTransactionsCount = 0;
    let categorizedCount = 0;
    let uncategorizedCount = 0;
    // Movimenti nuovi rimasti senza categoria dopo le regole: si ricontano dopo il giro automatico.
    const pendingIds: string[] = [];
    for (const [source, count] of nameSourceCounts) {
      recordMerchantNames(source, count);
      logger.info("bank.sync.names_resolved", { nameSource: source, count });
    }

    await reportProgress(onProgress, {
      phase: "saving",
      total: rows.length,
      processed: 0,
      inserted: 0,
      categorized: 0,
      uncategorized: 0,
    });

    for (let start = 0; start < rows.length; start += SYNC_INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(start, start + SYNC_INSERT_CHUNK_SIZE);
      const insertedRows = await db
        .insert(transactions)
        .values(chunk)
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
        .returning({ id: transactions.id, externalId: transactions.externalId, categoryId: transactions.categoryId });

      for (const inserted of insertedRows) {
        newTransactionsCount += 1;
        // hitCount va incrementato solo per righe davvero scritte: la banca restituisce una finestra
        // rolling di storico, quindi la stessa transazione (scartata qui da onConflictDoNothing nei sync
        // successivi) non deve gonfiare artificialmente l'utilizzo della regola che l'ha categorizzata.
        const ruleId = inserted.externalId ? ruleIdByExternalId.get(inserted.externalId) : undefined;
        if (ruleId) ruleResolver.recordHit(ruleId);
        if (inserted.categoryId === fallbackCategoryId) {
          uncategorizedCount += 1;
          pendingIds.push(inserted.id);
        } else {
          categorizedCount += 1;
        }
      }

      await reportProgress(onProgress, {
        phase: "saving",
        total: rows.length,
        processed: start + chunk.length,
        inserted: newTransactionsCount,
        categorized: categorizedCount,
        uncategorized: uncategorizedCount,
      });
    }

    await flushRuleHits(ruleResolver.appliedRuleIds());
    // Proposte dell'assistente per gli esercenti rimasti senza categoria, poi le sicure (dal 90%) si applicano da sole
    // se l'utente lo ha scelto; le altre restano da confermare in Categorizza.
    // I conteggi del risultato sono quelli dopo il giro: «categorizzati» comprende quelli messi da soli adesso.
    if (uncategorizedCount > 0) {
      await categorizeNewMovementsSafely(link.userId);
      const still = await countStillUncategorized(link.userId, pendingIds);
      categorizedCount += uncategorizedCount - still;
      uncategorizedCount = still;
    }

    const [currentLink] = await db
      .select({ syncTimestamps: bankAccountLinks.syncTimestamps })
      .from(bankAccountLinks)
      .where(eq(bankAccountLinks.id, link.linkId));
    const now = new Date();
    const updatedTimestamps = [now.toISOString(), ...(currentLink?.syncTimestamps ?? [])].slice(
      0,
      MAX_STORED_SYNC_TIMESTAMPS
    );

    await db
      .update(bankAccountLinks)
      .set({
        lastSyncedAt: now,
        syncTimestamps: updatedTimestamps,
        nextSyncEligibleAt: new Date(now.getTime() + MIN_SYNC_GAP_MS),
      })
      .where(eq(bankAccountLinks.id, link.linkId));

    return { status: "synced", newTransactionsCount, categorizedCount, uncategorizedCount, balanceUpdated: true };
  } catch (error) {
    if (error instanceof BankProviderError && error.reason === "expired") {
      await db
        .update(bankConnections)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(bankConnections.id, link.connectionId));
      return { status: "expired" };
    }
    // Troppe richieste e nessun header che dica per quanto: si lascia stare il conto per qualche ora.
    if (error instanceof BankProviderError && error.reason === "rate_limited") {
      for (const endpoint of ["balances", "transactions"]) {
        await recordRateLimit(rateLimitStore, link.externalAccountId, endpoint, 0, RATE_LIMIT_PAUSE_SECONDS);
      }
      return { status: "bank-limited" };
    }
    throw error;
  }
}

function duplicateKey(date: string, amount: string | number): string {
  return `${date}|${Number(amount).toFixed(2)}`;
}

/**
 * Al passaggio da GoCardless a Enable Banking lo stesso movimento arriva con un id diverso. Per un conto che ha già
 * movimenti di un altro fornitore si scartano i nuovi che coincidono per data e importo con uno di quelli, contando i
 * doppi: se GoCardless ha due caffè da 1,20 € e Enable Banking ne porta tre nello stesso giorno, se ne aggiunge uno.
 * Il confronto vale solo contro i movimenti dell'altro fornitore, quindi due movimenti uguali dallo stesso non si toccano.
 */
export async function dropMovementsFromPreviousProvider(
  link: Pick<SyncableLink, "accountId" | "provider">,
  fetched: BankTransactionRecord[]
): Promise<BankTransactionRecord[]> {
  const prefix = externalIdPrefix(link.provider);
  if (!prefix || fetched.length === 0) return fetched;
  const dates = fetched.map((transaction) => transaction.bookingDate).sort();
  const [alreadyOurs, previous] = await Promise.all([
    db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.accountId, link.accountId), gte(transactions.date, dates[0]), lte(transactions.date, dates[dates.length - 1]))),
    db
      .select({ date: transactions.date, amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, link.accountId),
          eq(transactions.source, "auto"),
          isNotNull(transactions.externalId),
          notLike(transactions.externalId, `${prefix}%`),
          gte(transactions.date, dates[0]),
          lte(transactions.date, dates[dates.length - 1])
        )
      ),
  ]);
  if (previous.length === 0) return fetched;
  const known = new Set(alreadyOurs.map((row) => row.externalId));
  const remaining = new Map<string, number>();
  for (const row of previous) {
    const key = duplicateKey(row.date, row.amount);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  // Un movimento già salvato con l'id del fornitore nuovo era in più rispetto a quelli vecchi (altrimenti sarebbe
  // stato scartato): non consuma un doppione, e l'insert lo ignora comunque.
  const kept: BankTransactionRecord[] = [];
  for (const transaction of fetched) {
    const key = duplicateKey(transaction.bookingDate, transaction.amount);
    const left = remaining.get(key) ?? 0;
    if (!known.has(transaction.externalId) && left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    kept.push(transaction);
  }
  if (kept.length < fetched.length) {
    logger.info("bank.sync.duplicates_skipped", { provider: link.provider, accountId: link.accountId, skipped: fetched.length - kept.length });
  }
  return kept;
}
