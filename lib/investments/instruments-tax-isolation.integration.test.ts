import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, userInstrumentSettings } from "@/lib/db/schema/investments";
import { createOrReuseInstrument, type CreateInstrumentDeps } from "./instruments";
import { resolveTaxSettings } from "./tax-settings";

const deps: CreateInstrumentDeps = { quoteMeta: async () => ({ currency: "EUR", exchange: "Milan" }) };

describe("aliquote degli strumenti comuni: isolamento tra utenti", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let alice: string;
  let bob: string;
  const symbol = `TEST${crypto.randomUUID().slice(0, 6).toUpperCase()}.MI`;

  async function newUser(label: string) {
    const [u] = await db
      .insert(authUser)
      .values({ id: `test-tax-${label}-${crypto.randomUUID()}`, name: label, email: `test-tax-${crypto.randomUUID()}@example.com`, emailVerified: false })
      .returning();
    userIds.push(u.id);
    return u.id;
  }
  async function settingOf(userId: string, instrumentId: string) {
    const [row] = await db
      .select()
      .from(userInstrumentSettings)
      .where(and(eq(userInstrumentSettings.userId, userId), eq(userInstrumentSettings.instrumentId, instrumentId)));
    return row;
  }

  beforeEach(async () => {
    alice = await newUser("alice");
    bob = await newUser("bob");
  });

  afterEach(async () => {
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("l'aliquota scelta da chi crea lo strumento resta sua e non cambia quella degli altri", async () => {
    const created = await createOrReuseInstrument(
      alice,
      { source: "yahoo", yahooSymbol: symbol, name: "ETF di prova", type: "etf", taxRate: "0.125", taxHarmonized: false },
      deps
    );
    if (!created.ok) throw new Error("creazione fallita");
    instrumentIds.push(created.instrument.id);
    expect(created.instrument.createdByUserId).toBeNull();
    // La riga condivisa non porta la scelta di Alice.
    expect(created.instrument.taxRate).toBe("0.2600");
    expect(created.instrument.taxHarmonized).toBeNull();

    const reused = await createOrReuseInstrument(bob, { source: "yahoo", yahooSymbol: symbol, name: "ETF di prova", type: "etf" }, deps);
    if (!reused.ok) throw new Error("riuso fallito");
    expect(reused.instrument.id).toBe(created.instrument.id);

    const aliceSetting = await settingOf(alice, created.instrument.id);
    expect(aliceSetting).toMatchObject({ taxRate: "0.1250", taxHarmonized: false });
    expect(await settingOf(bob, created.instrument.id)).toBeUndefined();

    expect(resolveTaxSettings(reused.instrument, aliceSetting)).toMatchObject({ taxRate: 0.125, harmonized: false });
    expect(resolveTaxSettings(reused.instrument, undefined)).toMatchObject({ taxRate: 0.26, harmonized: true });
  });

  it("riusando uno strumento con una scelta propria non tocca quella di chi l'ha creato", async () => {
    const created = await createOrReuseInstrument(alice, { source: "yahoo", yahooSymbol: symbol, name: "ETF", type: "etf", taxRate: "0.125" }, deps);
    if (!created.ok) throw new Error("creazione fallita");
    instrumentIds.push(created.instrument.id);
    await createOrReuseInstrument(bob, { source: "yahoo", yahooSymbol: symbol, name: "ETF", type: "etf", taxRate: "0.26" }, deps);
    expect((await settingOf(alice, created.instrument.id))?.taxRate).toBe("0.1250");
    expect((await settingOf(bob, created.instrument.id))?.taxRate).toBe("0.2600");
  });
});
