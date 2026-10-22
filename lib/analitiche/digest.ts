import "server-only";
import { eq, sql, type AnyColumn } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { db } from "@/lib/db/client";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { authUser } from "@/lib/db/schema/auth";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { categories } from "@/lib/db/schema/categories";
import { debtEvents, debts } from "@/lib/db/schema/debts";
import { investmentPortfolios, investmentTaxCarryforwards, userDismissedDividends, userInstrumentSettings } from "@/lib/db/schema/investments";
import { pensionFunds, pensionSnapshots } from "@/lib/db/schema/pension";
import type { EssentialSpending } from "@/lib/goals/essential";
import type { FireInput } from "@/lib/goals/plan";
import type { SourceAccount, SourcePosition } from "@/lib/goals/view";
import { investmentInputsFingerprint } from "@/lib/net-worth/investments";
import { cashInputsFingerprint } from "@/lib/net-worth/snapshots";
import { logger, recordAnalyticsDigest, requestLogger } from "@/lib/observability";
import { redis } from "@/lib/redis/client";
import { toSidebarFire } from "@/lib/sidebar/fire-summary";
import type { SidebarFire } from "@/lib/sidebar/types";
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from "./snapshot";

/**
 * What the sidebar FIRE goal and the Goals view need from the Analytics plan, in a JSON-safe shape that can be cached.
 * Computing it reads every account, transaction, investment and price of the user (the heaviest read behind
 * Panoramica), so it is kept on Redis until the data it comes from changes.
 */
export interface AnalyticsDigest {
  currency: string;
  todayKey: string;
  accounts: SourceAccount[];
  positions: SourcePosition[];
  /** Monthly savings the goals can count on, null when the savings are unknown. */
  capacity: number | null;
  fire: FireInput | null;
  essential: EssentialSpending | null;
  debtsTotal: number;
  sidebarFire: SidebarFire;
}

/** Bump when the shape of `AnalyticsDigest` or the way it is computed changes: older cached entries are ignored. */
const DIGEST_VERSION = 1;
/**
 * Backstop on top of the fingerprint: a few inputs (inflation, dividends, instrument metadata) are not in it, so an
 * entry is recomputed at least this often even when nothing the fingerprint sees has changed.
 */
const DIGEST_TTL_SECONDS = 30 * 60;

/** Redis key of a user's cached digest. */
export const analyticsDigestKey = (userId: string) => `analytics:digest:${userId}`;

/** Where the digest is cached (Redis in the app, in memory in the tests). */
export interface AnalyticsDigestStore {
  get(userId: string): Promise<string | null>;
  set(userId: string, value: string): Promise<void>;
}

export const redisAnalyticsDigestStore: AnalyticsDigestStore = {
  get: (userId) => redis.get(analyticsDigestKey(userId)),
  async set(userId, value) {
    await redis.set(analyticsDigestKey(userId), value, "EX", DIGEST_TTL_SECONDS);
  },
};

/** The digest from a full Analytics snapshot. Pure. */
export function digestFromSnapshot(snapshot: AnalyticsSnapshot): AnalyticsDigest {
  const { base, plan, assumptions } = snapshot;
  const fire: FireInput | null =
    plan.target === null || plan.savings === null
      ? null
      : { wealth: plan.wealth, annualSavings: plan.savings, realReturn: assumptions.expectedReturn, target: plan.target };
  return {
    currency: snapshot.currency,
    todayKey: snapshot.todayKey,
    accounts: snapshot.accounts,
    positions: base.positions.map((p) => ({ id: p.id, name: p.name, value: p.value, unrealizedGain: p.unrealizedGain, taxRate: p.taxRate, type: base.instrumentTypes[p.id] })),
    capacity: plan.savings === null ? null : plan.savings / 12,
    fire,
    essential: snapshot.essential,
    debtsTotal: base.wealth.debts,
    sidebarFire: toSidebarFire(plan, snapshot.currency),
  };
}

/** Small per-user tables the plan depends on: assumptions, categories and their groups, debts, pension, tax settings, brokers. */
const SMALL_TABLES: [PgTable, AnyColumn][] = [
  [analyticsAssumptions, analyticsAssumptions.userId],
  [categories, categories.userId],
  [debts, debts.userId],
  [debtEvents, debtEvents.userId],
  [pensionFunds, pensionFunds.userId],
  [pensionSnapshots, pensionSnapshots.userId],
  [userInstrumentSettings, userInstrumentSettings.userId],
  [investmentTaxCarryforwards, investmentTaxCarryforwards.userId],
  [investmentPortfolios, investmentPortfolios.userId],
  [userDismissedDividends, userDismissedDividends.userId],
  [brokerImportAccounts, brokerImportAccounts.userId],
  [brokerStatements, brokerStatements.userId],
];

/** Hash of every row of one small table for the user: changes on any insert, update or delete. */
function rowsHash(table: PgTable, userColumn: AnyColumn, userId: string) {
  return sql`(select md5(coalesce(string_agg(r::text, ',' order by r::text), '')) from ${table} r where r.${sql.identifier(userColumn.name)} = ${userId})`;
}

/**
 * Fingerprint of everything the digest depends on: the markers the cash and investment histories already use
 * (accounts, transactions, operations, prices, exchange rates), a hash of the small tables, the user's currency and
 * country, and today's date. A handful of aggregate queries instead of the full read.
 */
export async function analyticsInputsFingerprint(userId: string, now: Date): Promise<string> {
  const today = startOfDay(now);
  const todayKey = toDateKey(today);
  const hashes = SMALL_TABLES.map(([table, column]) => rowsHash(table, column, userId));
  const [cash, investments, [row]] = await Promise.all([
    cashInputsFingerprint(userId, todayKey, toDateKey(addDays(today, -1))),
    investmentInputsFingerprint(userId),
    db
      .select({ currency: authUser.currency, productCountry: authUser.productCountry, hashes: sql<string>`concat_ws('|', ${sql.join(hashes, sql`, `)})` })
      .from(authUser)
      .where(eq(authUser.id, userId)),
  ]);
  return [DIGEST_VERSION, todayKey, row?.currency, row?.productCountry, cash, investments, row?.hashes].join("#");
}

interface CachedDigest {
  fingerprint: string;
  digest: AnalyticsDigest;
}

async function readCached(store: AnalyticsDigestStore, userId: string): Promise<CachedDigest | null> {
  try {
    const raw = await store.get(userId);
    return raw ? (JSON.parse(raw) as CachedDigest) : null;
  } catch (error) {
    logger.warn("analytics.digest.read_failed", { error });
    return null;
  }
}

async function writeCached(store: AnalyticsDigestStore, userId: string, value: CachedDigest): Promise<void> {
  try {
    await store.set(userId, JSON.stringify(value));
  } catch (error) {
    logger.warn("analytics.digest.write_failed", { error });
  }
}

/** Computations running in this pod, so the parallel requests of one page (sidebar, Goals) share one read. */
const inFlight = new Map<string, Promise<AnalyticsDigest>>();

async function computeDigest(userId: string, now: Date, store: AnalyticsDigestStore): Promise<AnalyticsDigest> {
  // Taken before the read: if the data changes meanwhile, the next request sees another fingerprint and recomputes.
  const [fingerprint, cached] = await Promise.all([analyticsInputsFingerprint(userId, now), readCached(store, userId)]);
  if (cached?.fingerprint === fingerprint) {
    recordAnalyticsDigest("hit");
    return cached.digest;
  }
  const started = Date.now();
  const digest = digestFromSnapshot(await loadAnalyticsSnapshot(userId, now));
  const durationMs = Date.now() - started;
  recordAnalyticsDigest("miss", durationMs);
  requestLogger().info("analytics.digest.computed", { durationMs });
  await writeCached(store, userId, { fingerprint, digest });
  return digest;
}

/**
 * Analytics digest of the user: from Redis when the data behind it has not changed, otherwise computed from the full
 * snapshot and cached. Parallel calls for the same user in this pod share one computation.
 */
export function loadAnalyticsDigest(userId: string, now = new Date(), store: AnalyticsDigestStore = redisAnalyticsDigestStore): Promise<AnalyticsDigest> {
  const key = `${userId}:${toDateKey(startOfDay(now))}`;
  const running = inFlight.get(key);
  if (running) {
    recordAnalyticsDigest("shared");
    return running;
  }
  const promise = computeDigest(userId, now, store).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
