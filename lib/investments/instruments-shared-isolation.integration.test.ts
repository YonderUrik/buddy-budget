import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, userInstrumentSettings } from "@/lib/db/schema/investments";
import { createOrReuseInstrument, type CreateInstrumentDeps } from "./instruments";
import { resolveTaxSettings } from "./tax-settings";

const deps: CreateInstrumentDeps = { quoteMeta: async () => ({ currency: "EUR", exchange: "Milan" }) };

describe("strumenti comuni: nessuna scelta di un utente vale per gli altri", () => {
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

  it("nome e tipo di uno strumento comune vengono dalla fonte, non dal client", async () => {
    const fromSource: CreateInstrumentDeps = { quoteMeta: async () => ({ currency: "EUR", exchange: "Milan", name: "Nome dalla fonte", type: "etf" }) };
    const created = await createOrReuseInstrument(alice, { source: "yahoo", yahooSymbol: symbol, name: "Nome scelto da Alice", type: "obbligazione" }, fromSource);
    if (!created.ok) throw new Error("creazione fallita");
    instrumentIds.push(created.instrument.id);
    expect(created.instrument).toMatchObject({ name: "Nome dalla fonte", type: "etf", priceUnit: "unita" });
  });

  it("lega l'ISIN indicato dal client solo se la fonte lo conferma per quel simbolo", async () => {
    const isin = `IE00${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const unconfirmed = await createOrReuseInstrument(
      alice,
      { source: "yahoo", yahooSymbol: symbol, name: "ETF", type: "etf", isin },
      { ...deps, listings: async () => [{ yahooSymbol: "ALTRO.MI" }] }
    );
    if (!unconfirmed.ok) throw new Error("creazione fallita");
    instrumentIds.push(unconfirmed.instrument.id);
    expect(unconfirmed.instrument.isin).toBeNull();

    const other = `${symbol.slice(0, -3)}X.MI`;
    const confirmed = await createOrReuseInstrument(
      alice,
      { source: "yahoo", yahooSymbol: other, name: "ETF", type: "etf", isin },
      { ...deps, listings: async () => [{ yahooSymbol: other }] }
    );
    if (!confirmed.ok) throw new Error("creazione fallita");
    instrumentIds.push(confirmed.instrument.id);
    expect(confirmed.instrument.isin).toBe(isin);
  });

  it("uno strumento creato solo da ISIN resta privato di chi lo crea", async () => {
    const isin = `IT000${crypto.randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
    const input = { source: "isin" as const, isin, name: "BTP di prova", type: "obbligazione" as const, currency: "EUR" };
    const byAlice = await createOrReuseInstrument(alice, input, deps);
    const byBob = await createOrReuseInstrument(bob, { ...input, name: "Altro nome" }, deps);
    if (!byAlice.ok || !byBob.ok) throw new Error("creazione fallita");
    instrumentIds.push(byAlice.instrument.id, byBob.instrument.id);
    expect(byAlice.instrument.createdByUserId).toBe(alice);
    expect(byBob.instrument.id).not.toBe(byAlice.instrument.id);
    expect(byBob.instrument.name).toBe("Altro nome");
  });
});
