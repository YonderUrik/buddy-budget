import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  instrumentDividends,
  instruments,
  investmentPortfolios,
  investmentTaxCarryforwards,
  userDismissedDividends,
  userInstrumentSettings,
} from "@/lib/db/schema/investments";
import { refreshInstrumentDividends } from "@/lib/market-data/dividends";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { PUT as putSettings } from "@/app/api/instruments/[id]/settings/route";
import { POST as postCarryforward } from "./tax-carryforwards/route";
import { DELETE as deleteCarryforward } from "./tax-carryforwards/[id]/route";
import { DELETE as restoreDividend, POST as dismissDividend } from "./dividends/dismissed/route";
import { PATCH as patchPortfolio } from "./portfolio/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("route Fase 4 (fiscalità e proventi)", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;

  async function createUser() {
    const id = `test-fase4-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(id);
    return id;
  }

  async function createInstrument(ownerId: string, type: "obbligazione" | "etf" = "obbligazione") {
    const [row] = await db
      .insert(instruments)
      .values({ name: "BTP prova", type, currency: "EUR", priceMode: "manuale", priceUnit: "percentuale_nominale", createdByUserId: ownerId })
      .returning();
    instrumentIds.push(row.id);
    return row.id;
  }

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(investmentPortfolios).where(inArray(investmentPortfolios.userId, userIds));
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  it("401 senza sessione su tutte le route", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const params = { params: Promise.resolve({ id: crypto.randomUUID() }) };
    expect((await putSettings(request("/x", "PUT", {}), params)).status).toBe(401);
    expect((await postCarryforward(request("/x", "POST", {}))).status).toBe(401);
    expect((await deleteCarryforward(request("/x", "DELETE"), params)).status).toBe(401);
    expect((await dismissDividend(request("/x", "POST", {}))).status).toBe(401);
    expect((await patchPortfolio(request("/x", "PATCH", { taxRegime: "dichiarativo" }))).status).toBe(401);
  });

  it("imposta il regime fiscale senza toccare il benchmark", async () => {
    const response = await patchPortfolio(request("/api/investments/portfolio", "PATCH", { taxRegime: "dichiarativo" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ taxRegime: "dichiarativo", benchmarkInstrumentId: null });
    expect((await patchPortfolio(request("/api/investments/portfolio", "PATCH", {}))).status).toBe(400);
  });

  it("salva, aggiorna e cancella le impostazioni di uno strumento; cedole solo complete e solo per obbligazioni", async () => {
    const id = await createInstrument(userId);
    const params = { params: Promise.resolve({ id }) };
    const body = { taxRate: "0.125", taxHarmonized: null, couponRate: 0.04, couponFrequency: 2, maturityDate: "2030-03-01" };
    const saved = await putSettings(request(`/api/instruments/${id}/settings`, "PUT", body), params);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ taxRate: "0.1250", couponRate: "0.040000", couponFrequency: 2, maturityDate: "2030-03-01" });

    const partial = { ...body, maturityDate: null };
    expect((await putSettings(request("/x", "PUT", partial), { params: Promise.resolve({ id }) })).status).toBe(400);

    const cleared = { taxRate: null, taxHarmonized: null, couponRate: null, couponFrequency: null, maturityDate: null };
    expect((await putSettings(request("/x", "PUT", cleared), { params: Promise.resolve({ id }) })).status).toBe(200);
    expect(await db.select().from(userInstrumentSettings).where(eq(userInstrumentSettings.userId, userId))).toHaveLength(0);

    const etf = await createInstrument(userId, "etf");
    expect((await putSettings(request("/x", "PUT", body), { params: Promise.resolve({ id: etf }) })).status).toBe(400);
  });

  it("404 sulle impostazioni di uno strumento manuale di un altro utente", async () => {
    const other = await createUser();
    const id = await createInstrument(other);
    const body = { taxRate: "0.26", taxHarmonized: null, couponRate: null, couponFrequency: null, maturityDate: null };
    expect((await putSettings(request("/x", "PUT", body), { params: Promise.resolve({ id }) })).status).toBe(404);
  });

  it("aggiunge ed elimina una minusvalenza pregressa; niente anni futuri; non si cancella quella di un altro", async () => {
    const created = await postCarryforward(request("/api/investments/tax-carryforwards", "POST", { year: 2023, amount: 1234.5, note: "Fineco" }));
    expect(created.status).toBe(201);
    const row = await created.json();
    expect(row).toMatchObject({ year: 2023, amount: "1234.50", note: "Fineco" });
    expect((await postCarryforward(request("/x", "POST", { year: 2999, amount: 10 }))).status).toBe(400);

    const other = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
    expect((await deleteCarryforward(request("/x", "DELETE"), { params: Promise.resolve({ id: row.id }) })).status).toBe(404);
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    expect((await deleteCarryforward(request("/x", "DELETE"), { params: Promise.resolve({ id: row.id }) })).status).toBe(204);
    expect(await db.select().from(investmentTaxCarryforwards).where(eq(investmentTaxCarryforwards.userId, userId))).toHaveLength(0);
  });

  it("ignora (idempotente, anche in blocco) e ripristina le proposte di dividendo; 404 su uno strumento altrui", async () => {
    const id = await createInstrument(userId, "etf");
    const body = { items: [{ instrumentId: id, date: "2026-03-18" }, { instrumentId: id, date: "2026-06-18" }] };
    expect((await dismissDividend(request("/x", "POST", body))).status).toBe(201);
    expect((await dismissDividend(request("/x", "POST", body))).status).toBe(201);
    expect(await db.select().from(userDismissedDividends).where(eq(userDismissedDividends.userId, userId))).toHaveLength(2);
    const other = await createInstrument(await createUser(), "etf");
    expect((await dismissDividend(request("/x", "POST", { items: [{ instrumentId: other, date: "2026-03-18" }] }))).status).toBe(404);
    expect((await restoreDividend(request("/x", "DELETE", body))).status).toBe(204);
    expect(await db.select().from(userDismissedDividends).where(eq(userDismissedDividends.userId, userId))).toHaveLength(0);
  });

  it("scarica e salva lo storico dividendi, scarta la valuta sbagliata e segna lo scaricamento", async () => {
    const id = await createInstrument(userId, "etf");
    const provider = {
      fetchDividends: async () => [
        { exDate: "2026-03-18", amount: 0.45, currency: "EUR" },
        { exDate: "2026-06-18", amount: 0.5, currency: null },
        { exDate: "2026-09-18", amount: 9, currency: "USD" },
      ],
    };
    const ctx = { fetch, env: {} };
    expect(await refreshInstrumentDividends({ id, currency: "EUR" }, "VHYL.MI", ctx, { provider })).toBe("saved");
    // Un secondo giro aggiorna gli importi senza duplicare.
    provider.fetchDividends = async () => [{ exDate: "2026-03-18", amount: 0.46, currency: "EUR" }];
    await refreshInstrumentDividends({ id, currency: "EUR" }, "VHYL.MI", ctx, { provider });
    const rows = await db.select().from(instrumentDividends).where(eq(instrumentDividends.instrumentId, id));
    expect(rows.map((r) => [r.exDate, r.amount]).sort()).toEqual([
      ["2026-03-18", "0.46000000"],
      ["2026-06-18", "0.50000000"],
    ]);
    const [instrument] = await db.select().from(instruments).where(eq(instruments.id, id));
    expect(instrument.dividendsFetchedAt).not.toBeNull();
    expect(await refreshInstrumentDividends({ id, currency: "EUR" }, null, ctx, { provider })).toBe("no_symbol");
    const failing = { fetchDividends: async () => Promise.reject(new Error("429")) };
    expect(await refreshInstrumentDividends({ id, currency: "EUR" }, "VHYL.MI", ctx, { provider: failing, log: { warn: () => undefined } as never })).toBe("failed");
  });
});
