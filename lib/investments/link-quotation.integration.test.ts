import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentSymbols, instruments, type Instrument } from "@/lib/db/schema/investments";
import { createOrReuseInstrument } from "./instruments";
import type { IsinListingsDeps } from "./isin-listings";
import { linkQuotation } from "./link-quotation";

const ISIN = "IE00B4L5Y983";
const deps: IsinListingsDeps = {
  listings: async () => [
    { yahooSymbol: "SWDA.MI", exchCode: "IM", name: null, securityType: null },
    { yahooSymbol: "SWDA.L", exchCode: "LN", name: null, securityType: null },
  ],
  quoteMeta: async (symbol) => ({ currency: symbol.endsWith(".L") ? "USD" : "EUR", exchange: "Milan" }),
};

describe("collegamento di uno strumento manuale a una quotazione", () => {
  let userId: string;
  let manual: Instrument;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-link-quotation-${crypto.randomUUID()}`, name: "Test Link", email: `test-link-${crypto.randomUUID()}@example.com`, emailVerified: false })
      .returning();
    userId = user.id;
    [manual] = await db
      .insert(instruments)
      .values({ isin: ISIN, name: "iShares Core MSCI World", type: "etf", currency: "EUR", priceMode: "manuale", createdByUserId: userId })
      .returning();
  });

  afterEach(async () => {
    await db.delete(instruments).where(eq(instruments.id, manual.id));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("aggiunge i simboli e passa ai prezzi automatici", async () => {
    const outcome = await linkQuotation(manual, userId, "SWDA.MI", deps);
    expect(outcome.ok && outcome.instrument.priceMode).toBe("auto");
    const symbols = await db.select().from(instrumentSymbols).where(eq(instrumentSymbols.instrumentId, manual.id));
    expect(symbols.find((s) => s.provider === "yahoo")?.symbol).toBe("SWDA.MI");
    // Lo strumento resta privato: non diventa un strumento comune.
    const [stored] = await db.select().from(instruments).where(eq(instruments.id, manual.id));
    expect(stored.createdByUserId).toBe(userId);
  });

  it("rifiuta una quotazione in un'altra valuta o non proposta dall'ISIN", async () => {
    expect(await linkQuotation(manual, userId, "SWDA.L", deps)).toMatchObject({ ok: false, status: 422 });
    expect(await linkQuotation(manual, userId, "AAPL", deps)).toMatchObject({ ok: false, status: 422 });
    const [stored] = await db.select().from(instruments).where(eq(instruments.id, manual.id));
    expect(stored.priceMode).toBe("manuale");
  });

  it("non si collega due volte né per lo strumento di un altro utente", async () => {
    await linkQuotation(manual, userId, "SWDA.MI", deps);
    const [fresh] = await db.select().from(instruments).where(eq(instruments.id, manual.id));
    expect(await linkQuotation(fresh, userId, "SWDA.MI", deps)).toMatchObject({ ok: false, status: 409 });
    expect(await linkQuotation({ ...manual, priceMode: "manuale" }, "altro-utente", "SWDA.MI", deps)).toMatchObject({ ok: false, status: 409 });
  });

  it("un altro utente che cerca lo stesso simbolo non trova lo strumento privato", async () => {
    await linkQuotation(manual, userId, "SWDA.MI", deps);
    const other = await createOrReuseInstrument(
      "altro-utente",
      { source: "yahoo", yahooSymbol: "SWDA.MI", name: "iShares Core MSCI World", type: "etf" },
      { quoteMeta: async () => ({ currency: "EUR", exchange: "Milan" }) }
    );
    expect(other.ok && other.instrument.id).not.toBe(manual.id);
    if (other.ok) await db.delete(instruments).where(eq(instruments.id, other.instrument.id));
  });
});
