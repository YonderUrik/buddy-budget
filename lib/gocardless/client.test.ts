import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client as dbClient, db } from "@/lib/db/client";
import { gocardlessToken } from "@/lib/db/schema/bank-connections";
import { getAccessToken, getAccountBalances, listInstitutions } from "./client";

describe("gocardless client", () => {
  beforeEach(async () => {
    await db.delete(gocardlessToken);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
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
});
