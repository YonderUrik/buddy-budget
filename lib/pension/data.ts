import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pensionFunds, pensionSnapshots, type PensionFund } from "@/lib/db/schema/pension";
import type { PensionFundData, PensionOverviewData } from "./types";

/** Fondi e fotografie dell'utente, con gli importi già come numeri, fondi dal più vecchio e fotografie in ordine di data. */
export async function loadUserPension(userId: string): Promise<PensionOverviewData> {
  const [funds, snapshots] = await Promise.all([
    db.select().from(pensionFunds).where(eq(pensionFunds.userId, userId)).orderBy(asc(pensionFunds.createdAt)),
    db.select().from(pensionSnapshots).where(eq(pensionSnapshots.userId, userId)).orderBy(asc(pensionSnapshots.date)),
  ]);
  const result: PensionFundData[] = funds.map((fund) => ({
    id: fund.id,
    name: fund.name,
    adhesionDate: fund.adhesionDate,
    snapshots: snapshots
      .filter((s) => s.fundId === fund.id)
      .map((s) => ({ id: s.id, date: s.date, netContributions: Number(s.netContributions), value: Number(s.value) })),
  }));
  return { funds: result };
}

/** Un fondo dell'utente, o null se non esiste o è di un altro (mai distinguere i due casi verso il client). */
export async function findOwnPensionFund(userId: string, fundId: string): Promise<PensionFund | null> {
  const [row] = await db.select().from(pensionFunds).where(eq(pensionFunds.id, fundId));
  return row && row.userId === userId ? row : null;
}
