import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  instrumentPrices,
  instruments,
  investmentPortfolios,
  investmentTransactions,
  userInstrumentPrices,
} from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { createMemoryHistoryStateStore, type InvestmentHistoryStateStore } from "./history-state";
import { refreshDerivedInvestmentHistory, writeInvestmentSnapshot } from "./investments";
import { findUsersWithAccounts } from "./scheduler";
import { hasAnySnapshot } from "./snapshots";

const TODAY = new Date(2026, 8, 20);

describe("patrimonio netto: investimenti", () => {
  let userId: string;
  let instrumentId: string;
  let portfolioId: string;
  let state: InvestmentHistoryStateStore;

  async function buy(date: string, quantity: string, price: string) {
    const [row] = await db
      .insert(investmentTransactions)
      .values({ userId, portfolioId, instrumentId, type: "acquisto", date, quantity, price })
      .returning();
    return row.id;
  }

  const refresh = () => refreshDerivedInvestmentHistory(userId, TODAY, state);

  async function rows() {
    return db
      .select({ date: netWorthSnapshots.date, amount: netWorthSnapshots.amount, source: netWorthSnapshots.source })
      .from(netWorthSnapshots)
      .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "investimenti")))
      .orderBy(netWorthSnapshots.date);
  }

  beforeEach(async () => {
    state = createMemoryHistoryStateStore();
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-nw-investments-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-nw-investments-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
      })
      .returning();
    userId = user.id;
    const [instrument] = await db
      .insert(instruments)
      .values({ name: "ETF test", type: "etf", currency: "EUR", createdByUserId: userId })
      .returning();
    instrumentId = instrument.id;
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    portfolioId = portfolio.id;
    await db.insert(instrumentPrices).values([
      { instrumentId, date: "2026-09-16", close: "110", source: "yahoo" },
      { instrumentId, date: "2026-09-18", close: "120", source: "yahoo" },
    ]);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(instruments).where(eq(instruments.id, instrumentId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("ricostruisce lo storico dalla prima operazione a ieri e scrive lo snapshot di oggi", async () => {
    await buy("2026-09-15", "10", "100");
    expect(await refresh()).toBe(5);
    await writeInvestmentSnapshot(userId, TODAY);
    expect(await rows()).toEqual([
      { date: "2026-09-15", amount: "1000.00", source: "derivato" },
      { date: "2026-09-16", amount: "1100.00", source: "derivato" },
      { date: "2026-09-17", amount: "1100.00", source: "derivato" },
      { date: "2026-09-18", amount: "1200.00", source: "derivato" },
      { date: "2026-09-19", amount: "1200.00", source: "derivato" },
      { date: "2026-09-20", amount: "1200.00", source: "snapshot" },
    ]);
    // Seconda chiamata: niente da rifare.
    expect(await refresh()).toBe(0);
  });

  it("un'operazione più vecchia aggiorna tutti i giorni successivi, righe reali comprese, ma non la riga di oggi", async () => {
    await buy("2026-09-17", "10", "100");
    await refresh();
    // Come se il 18 lo avesse scritto il cron della sera.
    await db
      .update(netWorthSnapshots)
      .set({ source: "snapshot" })
      .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.date, "2026-09-18")));
    await writeInvestmentSnapshot(userId, TODAY);
    await buy("2026-09-14", "5", "100");
    expect(await refresh()).toBe(6);
    expect(await rows()).toEqual([
      { date: "2026-09-14", amount: "500.00", source: "derivato" },
      { date: "2026-09-15", amount: "500.00", source: "derivato" },
      { date: "2026-09-16", amount: "550.00", source: "derivato" },
      { date: "2026-09-17", amount: "1500.00", source: "derivato" },
      // La riga reale tiene la sua origine ma prende il valore ricalcolato.
      { date: "2026-09-18", amount: "1800.00", source: "snapshot" },
      { date: "2026-09-19", amount: "1800.00", source: "derivato" },
      // Oggi la riscrive il cron della sera (e la Panoramica mostra oggi il valore live).
      { date: "2026-09-20", amount: "1200.00", source: "snapshot" },
    ]);
  });

  it("un'operazione di anni fa (oltre i 24 mesi della liquidità) entra nello storico", async () => {
    await buy("2026-09-15", "10", "100");
    await refresh();
    await buy("2022-03-10", "1", "80");
    await refresh();
    const all = await rows();
    expect(all[0]).toEqual({ date: "2022-03-10", amount: "80.00", source: "derivato" });
    expect(all.find((r) => r.date === "2024-01-01")).toEqual({ date: "2024-01-01", amount: "80.00", source: "derivato" });
    expect(all.find((r) => r.date === "2026-09-19")).toEqual({ date: "2026-09-19", amount: "1320.00", source: "derivato" });
  });

  it("un'operazione in mezzo allo storico o modificata aggiorna i giorni da quella data in poi", async () => {
    await buy("2026-09-15", "10", "100");
    await refresh();
    const id = await buy("2026-09-18", "1", "120");
    expect(await refresh()).toBe(2);
    expect((await rows()).at(-1)).toEqual({ date: "2026-09-19", amount: "1320.00", source: "derivato" });

    await db.update(investmentTransactions).set({ quantity: "2", updatedAt: new Date() }).where(eq(investmentTransactions.id, id));
    expect(await refresh()).toBe(2);
    expect((await rows()).at(-1)).toEqual({ date: "2026-09-19", amount: "1440.00", source: "derivato" });
  });

  it("eliminare la prima operazione toglie i giorni prima della nuova prima operazione", async () => {
    const first = await buy("2026-09-14", "5", "100");
    await buy("2026-09-17", "10", "100");
    await refresh();
    await db.delete(investmentTransactions).where(eq(investmentTransactions.id, first));
    await refresh();
    const all = await rows();
    expect(all[0]).toEqual({ date: "2026-09-17", amount: "1000.00", source: "derivato" });
    expect(all).toHaveLength(3);
  });

  it("eliminate tutte le operazioni, i giorni passati spariscono", async () => {
    const id = await buy("2026-09-15", "10", "100");
    await refresh();
    await db.delete(investmentTransactions).where(eq(investmentTransactions.id, id));
    await refresh();
    expect(await rows()).toEqual([]);
  });

  it("si ricalcola quando arrivano prezzi storici o un prezzo manuale", async () => {
    await buy("2026-09-15", "10", "100");
    await refresh();
    await db.insert(instrumentPrices).values({ instrumentId, date: "2026-09-17", close: "115", source: "yahoo" });
    expect(await refresh()).toBe(1);
    expect((await rows()).find((r) => r.date === "2026-09-17")?.amount).toBe("1150.00");

    await db.insert(userInstrumentPrices).values({ userId, instrumentId, date: "2026-09-19", close: "130" });
    expect(await refresh()).toBe(1);
    expect((await rows()).at(-1)).toEqual({ date: "2026-09-19", amount: "1300.00", source: "derivato" });
  });

  it("se i dati non cambiano non ricalcola, anche se qualcuno ha toccato le righe", async () => {
    await buy("2026-09-15", "10", "100");
    await refresh();
    await db.delete(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId));
    expect(await refresh()).toBe(0);
    expect(await rows()).toEqual([]);
    // Impronta persa (es. Redis svuotato): un ricalcolo in più, niente di sbagliato.
    expect(await refreshDerivedInvestmentHistory(userId, TODAY, createMemoryHistoryStateStore())).toBe(5);
  });

  it("se lo store dell'impronta non risponde ricalcola comunque", async () => {
    await buy("2026-09-15", "10", "100");
    const broken: InvestmentHistoryStateStore = {
      get: () => Promise.reject(new Error("redis giù")),
      set: () => Promise.reject(new Error("redis giù")),
    };
    expect(await refreshDerivedInvestmentHistory(userId, TODAY, broken)).toBe(5);
  });

  it("le righe investimenti non bloccano la ricostruzione della liquidità e l'utente entra nel cron", async () => {
    await buy("2026-09-15", "1", "100");
    await writeInvestmentSnapshot(userId, TODAY);
    expect(await hasAnySnapshot(userId)).toBe(false);
    expect(await findUsersWithAccounts()).toContain(userId);
  });

  it("senza operazioni non scrive nulla", async () => {
    await writeInvestmentSnapshot(userId, TODAY);
    expect(await refresh()).toBe(0);
    expect(await rows()).toEqual([]);
  });
});
