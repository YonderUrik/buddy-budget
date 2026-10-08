import { describe, expect, it } from "vitest";
import { ProviderBlockedError, ProviderRateLimitedError } from "../errors";
import { fetchOpenFigiListings } from "./openfigi";
import { fakeContext } from "./test-utils";

const BODY = JSON.stringify([
  {
    data: [
      { ticker: "IWDA", exchCode: "NA" },
      { ticker: "SWDA", exchCode: "LN" },
      { ticker: "EUNL", exchCode: "GR" },
      { ticker: "EUNL", exchCode: "GY" },
      { ticker: "IWDA", exchCode: "XH" },
      { ticker: "SWDA", exchCode: "IM" },
      { ticker: "SWDAEUR", exchCode: "ER" },
      { ticker: "BAD TICKER", exchCode: "SW" },
    ],
  },
]);

describe("openfigi", () => {
  it("tiene solo le borse gestite, nell'ordine di preferenza e senza doppioni", async () => {
    const listings = await fetchOpenFigiListings("IE00B4L5Y983", fakeContext(BODY));
    expect(listings.map((l) => l.yahooSymbol)).toEqual(["SWDA.MI", "EUNL.DE", "IWDA.AS", "SWDA.L"]);
  });

  it("scrive i ticker con barra come su Yahoo e lascia i titoli USA senza suffisso", async () => {
    const body = JSON.stringify([{ data: [{ ticker: "BRK/B", exchCode: "US" }] }]);
    expect((await fetchOpenFigiListings("US0846707026", fakeContext(body))).map((l) => l.yahooSymbol)).toEqual(["BRK-B"]);
  });

  it("manda l'ISIN e la chiave solo se c'è", async () => {
    const withKey = fakeContext(BODY, 200, { OPENFIGI_API_KEY: "k" });
    await fetchOpenFigiListings("IE00B4L5Y983", withKey);
    const [, init] = (withKey.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual([{ idType: "ID_ISIN", idValue: "IE00B4L5Y983" }]);
    expect((init.headers as Record<string, string>)["X-OPENFIGI-APIKEY"]).toBe("k");
    const noKey = fakeContext(BODY);
    await fetchOpenFigiListings("IE00B4L5Y983", noKey);
    const [, init2] = (noKey.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(init2.headers as Record<string, string>).not.toHaveProperty("X-OPENFIGI-APIKEY");
  });

  it("un ISIN sconosciuto o malformato è una risposta vuota", async () => {
    expect(await fetchOpenFigiListings("IE00B4L5Y983", fakeContext('[{"warning":"No identifier found."}]'))).toEqual([]);
    const ctx = fakeContext(BODY);
    expect(await fetchOpenFigiListings("non-un-isin", ctx)).toEqual([]);
    expect(ctx.urls).toEqual([]);
  });

  it("429 e 403 diventano errori tipizzati", async () => {
    await expect(fetchOpenFigiListings("IE00B4L5Y983", fakeContext("", 429))).rejects.toBeInstanceOf(ProviderRateLimitedError);
    await expect(fetchOpenFigiListings("IE00B4L5Y983", fakeContext("", 403))).rejects.toBeInstanceOf(ProviderBlockedError);
  });
});
