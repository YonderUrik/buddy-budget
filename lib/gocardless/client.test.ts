import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client as dbClient, db } from "@/lib/db/client";
import { gocardlessToken } from "@/lib/db/schema/bank-connections";
import { getMetricsRegistry, resetMetricsForTests } from "@/lib/observability";
import {
  GoCardlessError,
  getAccessToken,
  deleteAgreement,
  getAccountBalances,
  listInstitutions,
  listRequisitions,
  resetAccessTokenCacheForTests,
} from "./client";

describe("gocardless client", () => {
  beforeEach(async () => {
    resetAccessTokenCacheForTests();
    await db.delete(gocardlessToken);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    // Senza questo, l'ultimo test lascia un token finto in cache nel DB reale condiviso
    // (stesso DATABASE_URL usato da `pnpm dev`): l'app dev userebbe quel token verso
    // GoCardless fino alla sua scadenza, fallendo con 401/502 sulle chiamate reali.
    await db.delete(gocardlessToken);
    await dbClient.end();
  });

  it("richiede un nuovo token quando non c'è cache, e lo salva", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ access: "token-1", access_expires: 3600 }), { status: 200 })
    );

    const token = await getAccessToken();
    expect(token).toBe("token-1");
    expect(fetch).toHaveBeenCalledTimes(1);

    const [cached] = await db.select().from(gocardlessToken);
    expect(cached.accessToken).toBe("token-1");
  });

  it("riusa il token in cache se non è scaduto, senza richiamare fetch", async () => {
    await db.insert(gocardlessToken).values({
      id: "singleton",
      accessToken: "cached-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const token = await getAccessToken();
    expect(token).toBe("cached-token");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("dopo il primo recupero riusa il token dalla memoria, senza rileggere il DB", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ access: "token-mem", access_expires: 3600 }), { status: 200 })
    );
    expect(await getAccessToken()).toBe("token-mem");

    // Se il secondo recupero leggesse il DB, troverebbe la cache svuotata e chiamerebbe di nuovo fetch.
    await db.delete(gocardlessToken);
    expect(await getAccessToken()).toBe("token-mem");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("listInstitutions chiama l'endpoint corretto e restituisce l'array", async () => {
    await db.insert(gocardlessToken).values({
      id: "singleton",
      accessToken: "cached-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ id: "INST_1", name: "Banca Test", transaction_total_days: "90" }]),
        { status: 200 }
      )
    );

    const institutions = await listInstitutions("IT");
    expect(institutions).toEqual([{ id: "INST_1", name: "Banca Test", transaction_total_days: "90" }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/institutions/?country=IT");
  });

  it("getAccountBalances lancia un errore chiaro se l'array balances è vuoto", async () => {
    await db.insert(gocardlessToken).values({
      id: "singleton",
      accessToken: "cached-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ balances: [] }), { status: 200 }));

    await expect(getAccountBalances("ext-1")).rejects.toThrow("Nessun saldo disponibile");
  });

  it("un errore HTTP non riporta nel messaggio il path con gli id né il body, e conta la chiamata", async () => {
    resetMetricsForTests();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: "token-1", access_expires: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "IBAN IT60X0542811101000000123456" }), { status: 500 }));
    const error = await getAccountBalances("ext-segreto-123").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoCardlessError);
    expect((error as Error).message).toBe("GoCardless accounts.balances ha risposto 500");
    const text = await getMetricsRegistry().metrics();
    expect(text).toContain('buddybudget_gocardless_api_requests_total{endpoint="accounts.balances",status_class="5xx"} 1');
    expect(text).toContain('buddybudget_gocardless_api_requests_total{endpoint="token.new",status_class="2xx"} 1');
  });

  describe("elenchi e agreement", () => {
    beforeEach(async () => {
      await db.insert(gocardlessToken).values({
        id: "singleton",
        accessToken: "cached-token",
        expiresAt: new Date(Date.now() + 3600_000),
      });
    });

    it("listRequisitions segue la paginazione finché esiste una pagina successiva", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify({ next: "https://x/next", results: [{ id: "r1" }] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ next: null, results: [{ id: "r2" }] }), { status: 200 }));

      const all = await listRequisitions();
      expect(all.map((r) => r.id)).toEqual(["r1", "r2"]);
      expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/requisitions/?limit=100&offset=0");
      expect(vi.mocked(fetch).mock.calls[1][0]).toContain("offset=100");
    });

    it("deleteAgreement tratta un 404 come già eliminato e rilancia gli altri errori", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 404 }));
      await expect(deleteAgreement("ag-1")).resolves.toBeUndefined();
      expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("DELETE");

      vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 500 }));
      await expect(deleteAgreement("ag-1")).rejects.toBeInstanceOf(GoCardlessError);
    });
  });
});
