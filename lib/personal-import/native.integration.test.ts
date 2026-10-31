import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { instruments, investmentTransactions } from "@/lib/db/schema/investments";
import { createOrReuseInstrument } from "@/lib/investments/instruments";
import { brokerSeries } from "@/lib/investments/import/__fixtures__/broker-series";
import type { ImportDeps } from "@/lib/investments/import/execute";
import { entryFor, importNatively } from "./native";

const users: string[] = [];
let userId: string;
const importDeps = (): ImportDeps => ({ userCurrency: "EUR", todayKey: "2026-10-04", createInstrument: input => createOrReuseInstrument(userId, input, { quoteMeta: vi.fn() }), fetchFx: vi.fn(async () => {}), ensureHistory: vi.fn(async () => {}) });
// No market search in tests: every security becomes a manual instrument with the file's own name and ISIN.
const resolve = vi.fn(async () => ({ kind: "none" as const, reason: "not_found" as const }));
beforeEach(async () => {
  userId = randomUUID(); users.push(userId);
  await db.insert(authUser).values({ id: userId, name: "Synthetic native import", email: `${userId}@example.test` });
});
afterAll(async () => {
  await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, users));
  await db.delete(instruments).where(inArray(instruments.createdByUserId, users));
  await db.delete(authUser).where(inArray(authUser.id, users));
});

describe("built-in readers in the one import", () => {
  it("imports an Interactive Brokers statement without AI, reconciled, and says nothing new the second time", async () => {
    const csv = brokerSeries(2023);
    const first = await importNatively(userId, csv, { importDeps: importDeps(), resolve });
    expect(first).toMatchObject({ kind: "imported", provider: "interactive-brokers", result: { inserted: expect.any(Number) } });
    expect(first.kind === "imported" && first.result.inserted).toBeGreaterThan(0);
    expect(await db.select().from(brokerStatements).where(eq(brokerStatements.userId, userId))).toHaveLength(1);
    const again = await importNatively(userId, csv, { importDeps: importDeps(), resolve });
    expect(again).toMatchObject({ kind: "imported", result: { inserted: 0, counts: { new: 0 } } });
  });

  it("refuses a statement that does not reconcile instead of handing it to the AI", async () => {
    await importNatively(userId, brokerSeries(2023), { importDeps: importDeps(), resolve });
    const broken = brokerSeries(2024).replace("Ending Cash,EUR,1108", "Ending Cash,EUR,1109");
    expect(await importNatively(userId, broken, { importDeps: importDeps(), resolve })).toMatchObject({ kind: "failed", provider: "interactive-brokers", message: expect.stringContaining("Cassa") });
  });

  it("leaves files of no known broker to the AI", async () => {
    expect(await importNatively(userId, "Data;Descrizione;Importo\n2026-10-02;Bar;-1,50", { importDeps: importDeps(), resolve })).toEqual({ kind: "none" });
  });

  it("takes the instrument the wizard would have proposed", () => {
    const identity = { key: "k", symbol: "VWCE", isin: "IE00BK5BQT80", name: "Vanguard FTSE All-World", currency: "EUR", symbolIsYahoo: false };
    expect(entryFor(identity, { kind: "none", reason: "not_found" })).toEqual({ key: "k", create: { source: "manuale", name: "Vanguard FTSE All-World", type: "azione", currency: "EUR", isin: "IE00BK5BQT80" } });
    expect(entryFor({ ...identity, currency: null }, { kind: "none", reason: "not_found" })).toBeNull();
  });
});
