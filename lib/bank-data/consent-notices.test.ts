import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";

vi.mock("./consent-emails", () => ({ sendConsentEmail: vi.fn() }));

import { sendConsentEmail } from "./consent-emails";
import { markExpiredConnections, sendConsentNotices } from "./consent-notices";

const NOW = new Date("2026-10-01T10:00:00Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

describe("avvisi sul consenso bancario", () => {
  let userId: string;
  let email: string;

  async function connection(values: Partial<typeof bankConnections.$inferInsert>, withLink = true) {
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
  const reload = async (id: string) => (await db.select().from(bankConnections).where(eq(bankConnections.id, id)))[0];
  const sentTo = () => vi.mocked(sendConsentEmail).mock.calls.filter(([to]) => to === email);

  beforeEach(async () => {
    email = `consent-${crypto.randomUUID()}@example.com`;
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-consent-${crypto.randomUUID()}`, name: "Test", email, emailVerified: false, currency: "EUR" })
      .returning();
    userId = user.id;
    vi.mocked(sendConsentEmail).mockReset().mockResolvedValue(true);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("markExpiredConnections segna scadute solo le linked con consenso passato", async () => {
    const past = await connection({ consentExpiresAt: inDays(-1) });
    const future = await connection({ consentExpiresAt: inDays(10) });
    await markExpiredConnections(NOW);
    expect((await reload(past.id)).status).toBe("expired");
    expect((await reload(future.id)).status).toBe("linked");
  });

  it("manda l'avviso 'in scadenza' una sola volta, dagli ultimi 7 giorni", async () => {
    const soon = await connection({ consentExpiresAt: inDays(5) });
    await connection({ consentExpiresAt: inDays(20) });

    await sendConsentNotices(NOW);
    expect(sentTo()).toHaveLength(1);
    expect(sentTo()[0][1]).toBe("expiring");
    expect((await reload(soon.id)).expiryWarningSentAt).not.toBeNull();

    await sendConsentNotices(NOW);
    expect(sentTo()).toHaveLength(1);
  });

  it("manda l'avviso 'scaduto' una sola volta", async () => {
    const dead = await connection({ status: "expired", consentExpiresAt: inDays(-2) });
    await sendConsentNotices(NOW);
    expect(sentTo().map(([, kind]) => kind)).toEqual(["expired"]);
    expect((await reload(dead.id)).expiredNoticeSentAt).not.toBeNull();
    await sendConsentNotices(NOW);
    expect(sentTo()).toHaveLength(1);
  });

  it("non avvisa per scadenze vecchie di oltre 30 giorni, connessioni senza conti o utenti disattivati", async () => {
    await connection({ status: "expired", consentExpiresAt: inDays(-45) });
    await connection({ status: "expired", consentExpiresAt: inDays(-2) }, false);
    await sendConsentNotices(NOW);
    expect(sentTo()).toHaveLength(0);

    await db.update(authUser).set({ deletionScheduledAt: inDays(10) }).where(eq(authUser.id, userId));
    await connection({ status: "expired", consentExpiresAt: inDays(-2) });
    await sendConsentNotices(NOW);
    expect(sentTo()).toHaveLength(0);
  });

  it("se l'email non parte non segna l'avviso (si riprova) e lo conta come fallito", async () => {
    vi.mocked(sendConsentEmail).mockResolvedValue(false);
    const soon = await connection({ consentExpiresAt: inDays(3) });
    const result = await sendConsentNotices(NOW);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect((await reload(soon.id)).expiryWarningSentAt).toBeNull();
  });
});
