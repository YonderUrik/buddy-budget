import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { PENSION_MAX_FUNDS } from "@/lib/pension/limits";
import type { PensionOverviewData } from "@/lib/pension/types";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";
import { POST as postFund } from "./funds/route";
import { DELETE as deleteFund, PATCH as patchFund } from "./funds/[id]/route";
import { POST as postSnapshot } from "./funds/[id]/snapshots/route";
import { POST as importSnapshots } from "./funds/[id]/snapshots/import/route";
import { DELETE as deleteSnapshot } from "./funds/[id]/snapshots/[snapshotId]/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });
const snapshotParams = (id: string, snapshotId: string) => ({ params: Promise.resolve({ id, snapshotId }) });

describe("route previdenza", () => {
  const userIds: string[] = [];
  let userId: string;

  async function createUser() {
    const id = `test-pension-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(id);
    return id;
  }

  async function createFund(body: object = { name: "Piano pensione", adhesionDate: "2022-03-15" }) {
    const res = await postFund(request("/api/pension/funds", "POST", body));
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  }

  async function overview(): Promise<PensionOverviewData> {
    return (await GET(request("/api/pension", "GET"))).json();
  }

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
  });

  it("401 senza sessione su tutte le route", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const id = crypto.randomUUID();
    expect((await GET(request("/api/pension", "GET"))).status).toBe(401);
    expect((await postFund(request("/x", "POST", {}))).status).toBe(401);
    expect((await patchFund(request("/x", "PATCH", {}), idParams(id))).status).toBe(401);
    expect((await deleteFund(request("/x", "DELETE"), idParams(id))).status).toBe(401);
    expect((await postSnapshot(request("/x", "POST", {}), idParams(id))).status).toBe(401);
    expect((await deleteSnapshot(request("/x", "DELETE"), snapshotParams(id, id))).status).toBe(401);
    expect((await importSnapshots(request("/x", "POST", {}), idParams(id))).status).toBe(401);
  });

  it("crea un fondo e lo restituisce con le fotografie in ordine di data", async () => {
    const fundId = await createFund();
    for (const [date, net, value] of [["2026-06-30", 2000, 2100], ["2026-03-31", 1500, 1530]] as const) {
      const res = await postSnapshot(request("/x", "POST", { date, netContributions: net, value }), idParams(fundId));
      expect(res.status).toBe(201);
    }
    const data = await overview();
    expect(data.funds).toHaveLength(1);
    expect(data.funds[0]).toMatchObject({ name: "Piano pensione", adhesionDate: "2022-03-15" });
    expect(data.funds[0].snapshots.map((s) => [s.date, s.netContributions, s.value])).toEqual([
      ["2026-03-31", 1500, 1530],
      ["2026-06-30", 2000, 2100],
    ]);
  });

  it("sostituisce la fotografia dello stesso giorno invece di duplicarla", async () => {
    const fundId = await createFund();
    const body = { date: "2026-03-31", netContributions: 1500, value: 1530 };
    await postSnapshot(request("/x", "POST", body), idParams(fundId));
    await postSnapshot(request("/x", "POST", { ...body, value: 1600 }), idParams(fundId));
    const data = await overview();
    expect(data.funds[0].snapshots).toHaveLength(1);
    expect(data.funds[0].snapshots[0].value).toBe(1600);
  });

  it("rifiuta dati non validi", async () => {
    expect((await postFund(request("/x", "POST", { name: "", adhesionDate: "2022-03-15" }))).status).toBe(400);
    expect((await postFund(request("/x", "POST", { name: "A", adhesionDate: "2999-01-01" }))).status).toBe(400);
    expect((await postFund(request("/x", "POST", { name: "A", adhesionDate: "2022-02-31" }))).status).toBe(400);
    const fundId = await createFund();
    expect((await postSnapshot(request("/x", "POST", { date: "2026-03-31", netContributions: -1, value: 10 }), idParams(fundId))).status).toBe(400);
    expect((await postSnapshot(request("/x", "POST", { date: "2999-03-31", netContributions: 1, value: 10 }), idParams(fundId))).status).toBe(400);
    expect((await patchFund(request("/x", "PATCH", {}), idParams(fundId))).status).toBe(400);
  });

  it("limita il numero di fondi per utente", async () => {
    for (let i = 0; i < PENSION_MAX_FUNDS; i += 1) await createFund({ name: `Fondo ${i}`, adhesionDate: "2022-03-15" });
    expect((await postFund(request("/x", "POST", { name: "Uno di troppo", adhesionDate: "2022-03-15" }))).status).toBe(400);
  });

  it("aggiorna nome e data di adesione", async () => {
    const fundId = await createFund();
    expect((await patchFund(request("/x", "PATCH", { name: "Moneyfarm", adhesionDate: "2021-01-10" }), idParams(fundId))).status).toBe(204);
    expect((await overview()).funds[0]).toMatchObject({ name: "Moneyfarm", adhesionDate: "2021-01-10" });
  });

  it("non lascia vedere né toccare i fondi di un altro utente", async () => {
    const fundId = await createFund();
    const snapshot = await (await postSnapshot(request("/x", "POST", { date: "2026-03-31", netContributions: 1, value: 1 }), idParams(fundId))).json();
    const other = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
    expect((await overview()).funds).toEqual([]);
    expect((await patchFund(request("/x", "PATCH", { name: "X" }), idParams(fundId))).status).toBe(404);
    expect((await deleteFund(request("/x", "DELETE"), idParams(fundId))).status).toBe(404);
    expect((await postSnapshot(request("/x", "POST", { date: "2026-04-30", netContributions: 1, value: 1 }), idParams(fundId))).status).toBe(404);
    expect((await deleteSnapshot(request("/x", "DELETE"), snapshotParams(fundId, snapshot.id))).status).toBe(404);
  });

  it("elimina una fotografia e un fondo con tutte le sue fotografie", async () => {
    const fundId = await createFund();
    const snapshot = await (await postSnapshot(request("/x", "POST", { date: "2026-03-31", netContributions: 1, value: 1 }), idParams(fundId))).json();
    expect((await deleteSnapshot(request("/x", "DELETE"), snapshotParams(fundId, snapshot.id))).status).toBe(204);
    expect((await deleteSnapshot(request("/x", "DELETE"), snapshotParams(fundId, snapshot.id))).status).toBe(404);
    await postSnapshot(request("/x", "POST", { date: "2026-04-30", netContributions: 1, value: 1 }), idParams(fundId));
    expect((await deleteFund(request("/x", "DELETE"), idParams(fundId))).status).toBe(204);
    expect((await overview()).funds).toEqual([]);
  });

  describe("import di fotografie", () => {
    const row = (line: number, date: string, netContributions: number, value: number) => ({ line, date, netContributions, value });
    const run = (fundId: string, rows: object[]) => importSnapshots(request("/x", "POST", { format: "csv", rows }), idParams(fundId));

    it("aggiunge le nuove e aggiorna la stessa data; reimportare non cambia nulla", async () => {
      const fundId = await createFund();
      await postSnapshot(request("/x", "POST", { date: "2026-03-31", netContributions: 1000, value: 1100 }), idParams(fundId));
      const rows = [row(2, "2026-03-31", 1000, 1150), row(3, "2026-06-30", 1200, 1300), row(4, "2026-09-30", 1400, 1500)];
      const first = await run(fundId, rows);
      expect(first.status).toBe(201);
      expect(await first.json()).toEqual({ counts: { new: 2, update: 1, unchanged: 0, error: 0 } });
      const snapshots = (await overview()).funds[0].snapshots;
      expect(snapshots.map((s) => [s.date, s.value])).toEqual([["2026-03-31", 1150], ["2026-06-30", 1300], ["2026-09-30", 1500]]);
      const again = await run(fundId, rows);
      expect((await again.json()).counts).toEqual({ new: 0, update: 0, unchanged: 3, error: 0 });
      expect((await overview()).funds[0].snapshots).toHaveLength(3);
    });

    it("con una riga in errore non scrive niente e restituisce il piano", async () => {
      const fundId = await createFund();
      const res = await run(fundId, [row(2, "2026-03-31", 1, 1), row(3, "2026-03-31", 2, 2)]);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.rows[1]).toMatchObject({ line: 3, status: "error" });
      expect((await overview()).funds[0].snapshots).toEqual([]);
      expect((await run(fundId, [row(2, "2999-01-01", 1, 1)])).status).toBe(400);
    });

    it("rifiuta richieste malformate e vuote, e fondi di un altro utente", async () => {
      const fundId = await createFund();
      expect((await run(fundId, [])).status).toBe(400);
      expect((await run(fundId, [{ line: 2, date: "x", netContributions: 1, value: 1 }])).status).toBe(400);
      expect((await run(fundId, [row(2, "2026-03-31", -1, 1)])).status).toBe(400);
      const other = await createUser();
      mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
      expect((await run(fundId, [row(2, "2026-03-31", 1, 1)])).status).toBe(404);
    });
  });
});
