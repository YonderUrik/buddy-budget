import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnectionAttempts, bankConnections } from "@/lib/db/schema/bank-connections";
import { getCapacityStatus, loadCapacityUsage, readCapacitySnapshot, reserveConnectionSlot } from "./capacity-store";
import { usedSlots } from "./capacity";
import { registerBankInterest, withdrawBankInterest } from "./interest";

const ENV_KEYS = ["GOCARDLESS_MAX_CONNECTIONS", "GOCARDLESS_MAX_CONNECTIONS_PER_USER", "GOCARDLESS_MAX_ATTEMPTS_PER_USER", "GOCARDLESS_PROVIDER_LIMIT", "BANK_CONNECTIONS_OPEN"] as const;

async function createUser(): Promise<string> {
  const id = `test-capacity-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id, name: "Test Capacity", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
  return id;
}

/** Connessione collegata con un conto (occupa il posto dell'utente per quella banca). */
async function linkBank(userId: string, institutionId: string): Promise<string> {
  const [connection] = await db
    .insert(bankConnections)
    .values({ userId, institutionId, institutionName: institutionId, requisitionId: `req-${crypto.randomUUID()}`, status: "linked" })
    .returning();
  const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "checking", source: "auto" }).returning();
  await db.insert(bankAccountLinks).values({ connectionId: connection.id, accountId: account.id, externalAccountId: `ext-${crypto.randomUUID()}` });
  return connection.id;
}

describe("capacity-store", () => {
  const users: string[] = [];
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.BANK_CONNECTIONS_OPEN = "true";
  });

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    if (users.length > 0) {
      await db.delete(bankConnectionAttempts).where(inArray(bankConnectionAttempts.userId, users));
      await db.delete(authUser).where(inArray(authUser.id, users));
      users.length = 0;
    }
  });

  afterAll(async () => {
    await client.end();
  });

  it("prenota il posto, crea la connessione pending e registra il consenso", async () => {
    const userId = await createUser();
    users.push(userId);
    const result = await reserveConnectionSlot({ userId, institutionId: "INST_A", institutionName: "Banca A" });
    expect(result).toMatchObject({ ok: true, kind: "new" });

    const rows = await db.select().from(bankConnections).where(eq(bankConnections.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    const attempts = await db.select().from(bankConnectionAttempts).where(eq(bankConnectionAttempts.userId, userId));
    expect(attempts).toHaveLength(1);
  });

  it("blocca la seconda banca e consente il rinnovo della prima", async () => {
    const userId = await createUser();
    users.push(userId);
    await linkBank(userId, "INST_A");

    expect(await reserveConnectionSlot({ userId, institutionId: "INST_B", institutionName: "Banca B" })).toMatchObject({ ok: false, reason: "user_limit" });
    expect(await reserveConnectionSlot({ userId, institutionId: "INST_A", institutionName: "Banca A" })).toMatchObject({ ok: true, kind: "renewal" });
    expect(await getCapacityStatus(userId)).toEqual({ canConnectNew: false, reason: "user_limit", renewableInstitutionIds: ["INST_A"], interested: false });
  });

  it("with new connections closed refuses a new bank but still renews a linked one", async () => {
    process.env.BANK_CONNECTIONS_OPEN = "false";
    const fresh = await createUser();
    const linked = await createUser();
    users.push(fresh, linked);
    await linkBank(linked, "INST_A");

    expect(await reserveConnectionSlot({ userId: fresh, institutionId: "INST_A", institutionName: "Banca A" })).toMatchObject({ ok: false, reason: "paused", kind: "new" });
    expect(await db.select().from(bankConnections).where(eq(bankConnections.userId, fresh))).toHaveLength(0);
    expect(await reserveConnectionSlot({ userId: linked, institutionId: "INST_A", institutionName: "Banca A" })).toMatchObject({ ok: true, kind: "renewal" });
    expect(await getCapacityStatus(fresh)).toMatchObject({ canConnectNew: false, reason: "paused", interested: false });
  });

  it("records «Tienimi aggiornato» once per person and counts it until withdrawn", async () => {
    const userId = await createUser();
    users.push(userId);
    const before = (await readCapacitySnapshot()).interested;

    expect(await registerBankInterest(userId, "IT")).toEqual({ created: true });
    expect(await registerBankInterest(userId, "IT")).toEqual({ created: false });
    expect((await getCapacityStatus(userId)).interested).toBe(true);
    expect((await readCapacitySnapshot()).interested).toBe(before + 1);

    expect(await withdrawBankInterest(userId)).toEqual({ removed: true });
    expect((await readCapacitySnapshot()).interested).toBe(before);
  });

  it("non supera il tetto globale con richieste simultanee", async () => {
    const used = usedSlots(await loadCapacityUsage());
    process.env.GOCARDLESS_MAX_CONNECTIONS = String(used + 3);
    process.env.GOCARDLESS_PROVIDER_LIMIT = String(used + 3);
    const ids = await Promise.all(Array.from({ length: 10 }, () => createUser()));
    users.push(...ids);

    const results = await Promise.all(
      ids.map((userId, i) => reserveConnectionSlot({ userId, institutionId: `INST_${i}`, institutionName: `Banca ${i}` }))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "provider_limit")).toBe(true);
    expect(usedSlots(await loadCapacityUsage())).toBe(used + 3);
  });

  it("una connessione eliminata continua a contare tra i consensi recenti", async () => {
    const userId = await createUser();
    users.push(userId);
    const before = await loadCapacityUsage();
    const result = await reserveConnectionSlot({ userId, institutionId: "INST_A", institutionName: "Banca A" });
    if (!result.ok) throw new Error("prenotazione rifiutata");
    await db.delete(bankConnections).where(eq(bankConnections.id, result.connection.id));
    const after = await loadCapacityUsage();
    expect(after.recent).toBe(before.recent + 1);
  });

  it("conta gli utenti con più banche del limite", async () => {
    const before = (await readCapacitySnapshot()).usersOverLimit;
    const userId = await createUser();
    users.push(userId);
    await linkBank(userId, "INST_A");
    await linkBank(userId, "INST_B");
    expect((await readCapacitySnapshot()).usersOverLimit).toBe(before + 1);
  });
});
