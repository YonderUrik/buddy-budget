import { describe, expect, it, vi } from "vitest";
import { buildLogoUrl, LOGO_MAX_BYTES, lookupLogo, type CachedLogo, type LogoStore } from "./logo-service";
import type { LogoSource } from "./logo-source";

const ISSUER: LogoSource = { kind: "issuer", domain: "ishares.com", key: "issuer:ishares.com" };
const STOCK: LogoSource = { kind: "isin", isin: "IT0003132476", key: "isin:IT0003132476" };

function memoryStore(initial: Record<string, CachedLogo> = {}) {
  const data = new Map<string, CachedLogo>(Object.entries(initial));
  const ttls = new Map<string, number>();
  let cooling = false;
  const store: LogoStore = {
    get: async (key) => (data.has(key) ? data.get(key) : undefined),
    set: async (key, value, ttl) => {
      data.set(key, value);
      ttls.set(key, ttl);
    },
    isCoolingDown: async () => cooling,
    markCoolingDown: async () => {
      cooling = true;
    },
  };
  return { store, data, ttls, isCooling: () => cooling };
}

const image = (body = "logo", status = 200, type = "image/webp") =>
  vi.fn(async () => new Response(body, { status, headers: { "content-type": type } })) as unknown as typeof fetch;

describe("buildLogoUrl", () => {
  it("chiede il 404 al posto del monogramma e usa il percorso giusto per ISIN e dominio", () => {
    expect(buildLogoUrl(STOCK, "pk_x")).toBe("https://img.logo.dev/isin/IT0003132476?token=pk_x&size=128&format=webp&fallback=404");
    expect(buildLogoUrl(ISSUER, "pk_x")).toContain("https://img.logo.dev/ishares.com?");
  });
});

describe("lookupLogo", () => {
  it("senza chiave non fa niente", async () => {
    const { store } = memoryStore();
    const fetchFn = image();
    expect(await lookupLogo(ISSUER, { token: undefined, store, fetchFn })).toEqual({ outcome: "disabled", cached: false });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("scarica il logo, lo salva e la volta dopo lo serve dalla cache", async () => {
    const { store, data } = memoryStore();
    const fetchFn = image("abc");
    const first = await lookupLogo(ISSUER, { token: "pk", store, fetchFn });
    expect(first).toMatchObject({ outcome: "hit", cached: false });
    expect(first.logo?.bytes.toString()).toBe("abc");
    expect(data.get(ISSUER.key)).toMatchObject({ contentType: "image/webp" });
    const second = await lookupLogo(ISSUER, { token: "pk", store, fetchFn });
    expect(second).toMatchObject({ outcome: "hit", cached: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("ricorda per qualche giorno che il logo manca", async () => {
    const { store, data, ttls } = memoryStore();
    const fetchFn = image("", 404);
    expect(await lookupLogo(STOCK, { token: "pk", store, fetchFn })).toEqual({ outcome: "miss", cached: false });
    expect(data.get(STOCK.key)).toBeNull();
    expect(ttls.get(STOCK.key)).toBe(3 * 24 * 60 * 60);
    expect(await lookupLogo(STOCK, { token: "pk", store, fetchFn })).toEqual({ outcome: "miss", cached: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("un errore del servizio apre una pausa e non salva niente", async () => {
    const { store, data, isCooling } = memoryStore();
    const fetchFn = image("boom", 503, "text/plain");
    expect(await lookupLogo(ISSUER, { token: "pk", store, fetchFn })).toEqual({ outcome: "error", cached: false });
    expect(isCooling()).toBe(true);
    expect(data.size).toBe(0);
    expect(await lookupLogo(STOCK, { token: "pk", store, fetchFn })).toEqual({ outcome: "error", cached: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("una risposta che non è un'immagine, o è enorme, non si salva come logo", async () => {
    const html = memoryStore();
    expect((await lookupLogo(ISSUER, { token: "pk", store: html.store, fetchFn: image("<html>", 200, "text/html") })).outcome).toBe("error");
    const big = memoryStore();
    const result = await lookupLogo(ISSUER, { token: "pk", store: big.store, fetchFn: image("x".repeat(LOGO_MAX_BYTES + 1)) });
    expect(result.outcome).toBe("miss");
    expect(big.data.get(ISSUER.key)).toBeNull();
  });

  it("un errore di rete non lancia", async () => {
    const { store } = memoryStore();
    const fetchFn = vi.fn(async () => {
      throw new Error("rete");
    }) as unknown as typeof fetch;
    expect(await lookupLogo(ISSUER, { token: "pk", store, fetchFn })).toEqual({ outcome: "error", cached: false });
  });
});
