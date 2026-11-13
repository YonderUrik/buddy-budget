/**
 * Read-only impact report of the cash history planner: for every user with stored cash rows, what the next rebuild
 * would write, compared with what is stored. Runs inside a READ ONLY transaction that is rolled back; prints counts
 * and size ranges only (no user ids, names or amounts). Safe on production.
 *
 *   LEGACY_ROWS=1 pnpm tsx scripts/cash-history-impact.ts
 *
 * LEGACY_ROWS=1 reads the stored rows without `statement_amount`, as on a database that has not run migration 0057:
 * the report is then what the first rebuild after deploying it would do.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import type { StoredCashRow } from "@/lib/calc/cash-history";
import { planDerivedCashHistory } from "@/lib/net-worth/snapshots";

const ROLLBACK = new Error("read-only report: rolled back");
const legacy = process.env.LEGACY_ROWS === "1";

function bucket(euros: number): string {
  const v = Math.abs(euros);
  if (v < 0.005) return "0";
  if (v < 10) return "<10";
  if (v < 100) return "10–100";
  if (v < 1_000) return "100–1k";
  if (v < 10_000) return "1k–10k";
  return "≥10k";
}

async function main() {
  const today = startOfDay(new Date());
  const todayKey = toDateKey(today);
  const lines: string[] = [];
  let checked = 0, unchanged = 0;
  await db.transaction(async (tx) => {
    const users = await tx.selectDistinct({ userId: netWorthSnapshots.userId }).from(netWorthSnapshots).where(eq(netWorthSnapshots.assetClass, "liquidita"));
    for (const { userId } of users) {
      checked += 1;
      const stored = await tx
        .select({
          date: netWorthSnapshots.date, amount: netWorthSnapshots.amount, ledgerAmount: netWorthSnapshots.ledgerAmount,
          statementAmount: legacy ? sql<string | null>`null` : netWorthSnapshots.statementAmount,
          updatedAt: netWorthSnapshots.updatedAt, createdAt: netWorthSnapshots.createdAt,
        })
        .from(netWorthSnapshots)
        .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita"), lt(netWorthSnapshots.date, todayKey)));
      const rows: StoredCashRow[] = stored.map((r) => ({
        date: r.date, amount: Number(r.amount), ledgerAmount: r.ledgerAmount === null ? null : Number(r.ledgerAmount),
        statementAmount: r.statementAmount === null ? null : Number(r.statementAmount), updatedAt: r.updatedAt, createdAt: r.createdAt,
      }));
      const byDate = new Map(rows.map((r) => [r.date, r]));
      const writes = await planDerivedCashHistory(userId, today, tx, rows);
      let changed = 0, inserted = 0, manualChanged = 0, statementDays = 0, maxChange = 0, maxManualChange = 0;
      for (const w of writes) {
        if (w.statementAmount !== 0) statementDays += 1;
        const old = byDate.get(w.date);
        if (!old || w.insert) { inserted += 1; continue; }
        const change = w.amount - old.amount;
        if (Math.abs(change) >= 0.005) { changed += 1; maxChange = Math.max(maxChange, Math.abs(change)); }
        const oldManual = old.amount - (old.ledgerAmount ?? 0) - (old.statementAmount ?? 0);
        const newManual = w.amount - w.ledgerAmount - w.statementAmount;
        if (Math.abs(newManual - oldManual) >= 0.005) { manualChanged += 1; maxManualChange = Math.max(maxManualChange, Math.abs(newManual - oldManual)); }
      }
      if (changed === 0 && inserted === 0) { unchanged += 1; continue; }
      lines.push(`#${lines.length + 1}: stored days ${rows.length} · total changes on ${changed} (largest ${bucket(maxChange)}) · new days ${inserted} · days with broker cash ${statementDays} · manual part reassigned on ${manualChanged} (largest ${bucket(maxManualChange)})`);
    }
    throw ROLLBACK;
  }, { accessMode: "read only" }).catch((error) => { if (error !== ROLLBACK) throw error; });
  console.log(`cash history impact (${legacy ? "rows read as before migration 0057" : "rows as stored"}), ${todayKey}`);
  console.log(`users with cash history: ${checked} · unchanged: ${unchanged} · changed: ${lines.length}`);
  for (const line of lines) console.log(line);
  process.exit(0);
}

main().catch((error) => { console.error("FAILED", error instanceof Error ? `${error.name}: ${error.message}` : error); process.exit(1); });
