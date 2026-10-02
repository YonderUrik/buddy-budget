import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  listRequisitions: vi.fn(),
  listAgreements: vi.fn(),
  getRequisition: vi.fn(),
  deleteRequisition: vi.fn(),
  deleteAgreement: vi.fn(),
}));

import { deleteAgreement, deleteRequisition, getRequisition, listAgreements, listRequisitions } from "./client";
import { runGoCardlessCleanup } from "./cleanup";

const NOW = new Date("2026-10-01T10:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("runGoCardlessCleanup", () => {
  let userId: string;

  async function connection(values: Partial<typeof bankConnections.$inferInsert>, withLink = false) {
    const [row] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked", ...values })
      .returning();
    if (withLink) {
      const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "0", source: "auto" }).returning();
      await db.insert(bankAccountLinks).values({ connectionId: row.id, accountId: account.id, externalAccountId: `ext-${row.id}` });
    }
    return row;
  }

  const exists = async (id: string) => (await db.select().from(bankConnections).where(eq(bankConnections.id, id))).length === 1;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-cleanup-${crypto.randomUUID()}`, name: "Test", email: `cleanup-${crypto.randomUUID()}@example.com`, emailVerified: false, currency: "EUR" })
      .returning();
    userId = user.id;
    vi.mocked(listRequisitions).mockReset().mockResolvedValue([]);
    vi.mocked(listAgreements).mockReset().mockResolvedValue([]);
    vi.mocked(getRequisition).mockReset().mockResolvedValue({ id: "x", status: "CR", link: "", accounts: [] });
    vi.mocked(deleteRequisition).mockReset().mockResolvedValue();
    vi.mocked(deleteAgreement).mockReset().mockResolvedValue();
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("in dry-run conta i candidati ma non elimina niente né su GoCardless né a DB", async () => {
    const abandoned = await connection({ status: "pending", requisitionId: "req-abandoned", createdAt: daysAgo(5) });
    const report = await runGoCardlessCleanup({ mode: "dry-run", now: NOW });
    expect(report.counts.abandoned_attempt).toBeGreaterThanOrEqual(1);
    expect(deleteRequisition).not.toHaveBeenCalled();
    expect(await exists(abandoned.id)).toBe(true);
  });

  it("in execute elimina un tentativo abbandonato (requisition + riga)", async () => {
    const abandoned = await connection({ status: "error", requisitionId: "req-abandoned", createdAt: daysAgo(5) });
    const report = await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(report.failed).toBe(0);
    expect(deleteRequisition).toHaveBeenCalledWith("req-abandoned");
    expect(await exists(abandoned.id)).toBe(false);
  });

  it("non elimina un tentativo che GoCardless dice già collegato (callback persa)", async () => {
    vi.mocked(getRequisition).mockResolvedValue({ id: "x", status: "LN", link: "", accounts: [] });
    const row = await connection({ status: "pending", requisitionId: "req-linked", createdAt: daysAgo(5) });
    const report = await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(report.counts.skipped_linked).toBe(1);
    expect(deleteRequisition).not.toHaveBeenCalled();
    expect(await exists(row.id)).toBe(true);
  });

  it("una connessione senza conti viene prima segnata, poi eliminata dopo la grazia; con conti non si tocca", async () => {
    const orphan = await connection({ requisitionId: "req-orphan" });
    const healthy = await connection({ requisitionId: "req-healthy" }, true);

    await runGoCardlessCleanup({ mode: "execute", now: NOW });
    const [marked] = await db.select().from(bankConnections).where(eq(bankConnections.id, orphan.id));
    expect(marked.orphanedAt).not.toBeNull();
    expect(await exists(orphan.id)).toBe(true);
    expect(deleteRequisition).not.toHaveBeenCalled();

    await db.update(bankConnections).set({ orphanedAt: daysAgo(8) }).where(eq(bankConnections.id, orphan.id));
    await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(deleteRequisition).toHaveBeenCalledWith("req-orphan");
    expect(deleteRequisition).not.toHaveBeenCalledWith("req-healthy");
    expect(await exists(orphan.id)).toBe(false);
    expect(await exists(healthy.id)).toBe(true);
  });

  it("una connessione scaduta da tempo perde la requisition ma conserva riga e conti (resta da riconnettere)", async () => {
    const stale = await connection({ status: "expired", requisitionId: "req-stale", consentExpiresAt: daysAgo(40) }, true);
    await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(deleteRequisition).toHaveBeenCalledWith("req-stale");
    const [after] = await db.select().from(bankConnections).where(eq(bankConnections.id, stale.id));
    expect(after.requisitionId).toBeNull();
    expect(after.status).toBe("expired");
  });

  it("non tocca gli utenti con eliminazione programmata", async () => {
    await db.update(authUser).set({ deletionScheduledAt: new Date(NOW.getTime() + 86_400_000) }).where(eq(authUser.id, userId));
    const abandoned = await connection({ status: "error", requisitionId: "req-x", createdAt: daysAgo(30) });
    await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(deleteRequisition).not.toHaveBeenCalledWith("req-x");
    expect(await exists(abandoned.id)).toBe(true);
  });

  it("un errore su un elemento viene contato e non ferma gli altri", async () => {
    await connection({ status: "error", requisitionId: "req-bad", createdAt: daysAgo(5) });
    const good = await connection({ status: "error", requisitionId: "req-good", createdAt: daysAgo(5) });
    vi.mocked(deleteRequisition).mockImplementation(async (id) => {
      if (id === "req-bad") throw new Error("GoCardless giù");
    });
    const report = await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(report.failed).toBe(1);
    expect(await exists(good.id)).toBe(false);
  });

  describe("requisition sconosciute su GoCardless", () => {
    const remote = [
      { id: "req-known", created: daysAgo(100).toISOString(), status: "EX", agreement: "ag-known" },
      { id: "req-unknown", created: daysAgo(60).toISOString(), status: "CR", agreement: "ag-unknown" },
    ];

    beforeEach(async () => {
      await connection({ status: "expired", requisitionId: "req-known", consentExpiresAt: daysAgo(5) }, true);
      vi.mocked(listRequisitions).mockResolvedValue(remote);
      vi.mocked(listAgreements).mockResolvedValue([
        { id: "ag-known", created: daysAgo(100).toISOString() },
        { id: "ag-unknown", created: daysAgo(60).toISOString() },
        { id: "ag-orphan", created: daysAgo(60).toISOString() },
      ]);
    });

    it("senza il flag le conta soltanto (anche in execute)", async () => {
      const report = await runGoCardlessCleanup({ mode: "execute", now: NOW });
      expect(report.counts.unknown_requisition).toBe(1);
      expect(report.counts.unknown_agreement).toBe(1);
      expect(deleteRequisition).not.toHaveBeenCalledWith("req-unknown");
      expect(deleteAgreement).not.toHaveBeenCalled();
    });

    it("con il flag in execute elimina requisition e agreement orfani, mai quelli noti", async () => {
      await runGoCardlessCleanup({ mode: "execute", deleteUnknown: true, now: NOW });
      expect(deleteRequisition).toHaveBeenCalledWith("req-unknown");
      expect(deleteRequisition).not.toHaveBeenCalledWith("req-known");
      expect(deleteAgreement).toHaveBeenCalledWith("ag-orphan");
      expect(deleteAgreement).not.toHaveBeenCalledWith("ag-known");
    });

    it("con il flag ma in dry-run non elimina", async () => {
      await runGoCardlessCleanup({ mode: "dry-run", deleteUnknown: true, now: NOW });
      expect(deleteRequisition).not.toHaveBeenCalled();
      expect(deleteAgreement).not.toHaveBeenCalled();
    });
  });

  it("se l'elenco GoCardless fallisce segnala l'errore ma esegue comunque la pulizia delle connessioni note", async () => {
    vi.mocked(listRequisitions).mockRejectedValue(new Error("rete"));
    const abandoned = await connection({ status: "error", requisitionId: "req-a", createdAt: daysAgo(5) });
    const report = await runGoCardlessCleanup({ mode: "execute", now: NOW });
    expect(report.failed).toBe(1);
    expect(await exists(abandoned.id)).toBe(false);
  });
});
