import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  domainFromText,
  isTransferText,
  MIN_USERS_FOR_NAME_SEARCH,
  nameSearchKey,
  pickMatchingDomain,
  resolveMerchantLogo,
  resolveNameDomain,
  searchBrandDomain,
  type MerchantNameStore,
} from ".";
import { merchantLogoPath, verifyMerchantLogoSignature } from "./sign";

describe("domainFromText", () => {
  it("trova il sito scritto nel movimento, senza sottodomini", () => {
    expect(domainFromText("PAGAMENTO POS HETZNER.COM 12/10")).toBe("hetzner.com");
    expect(domainFromText("www.esselunga.it via Roma")).toBe("esselunga.it");
    expect(domainFromText("HELP.UBER.COM AMSTERDAM")).toBe("uber.com");
    expect(domainFromText("AMAZON.CO.UK MARKETPLACE")).toBe("amazon.co.uk");
  });

  it("salta gli intermediari di pagamento e ciò che non è un sito", () => {
    expect(domainFromText("PAYPAL.COM *VINTED")).toBeNull();
    expect(domainFromText("FERRAMENTA ROSSI S.R.L.")).toBeNull();
    expect(domainFromText("IMPORTO 12.50 EUR")).toBeNull();
    expect(domainFromText(null)).toBeNull();
  });
});

describe("nameSearchKey e isTransferText", () => {
  it("riduce il nome alla forma del marchio", () => {
    expect(nameSearchKey("Ferramenta Rossi S.r.l.")).toBe("ferramenta rossi");
    expect(nameSearchKey("CAFFÈ NERO")).toBe("caffe nero");
  });

  it("scarta ciò che non sembra un marchio", () => {
    expect(nameSearchKey("ab")).toBeNull();
    expect(nameSearchKey("pagamento carta presso negozio di via roma")).toBeNull();
    expect(nameSearchKey("123 456")).toBeNull();
  });

  it("riconosce bonifici e giroconti", () => {
    expect(isTransferText("BONIFICO A FAVORE DI LUCA BIANCHI")).toBe(true);
    expect(isTransferText("Giroconto verso conto deposito")).toBe(true);
    expect(isTransferText("PAGAMENTO POS BAR CENTRALE")).toBe(false);
  });
});

describe("resolveMerchantLogo", () => {
  it("preferisce il dizionario, poi il sito nel movimento, poi il nome", () => {
    expect(resolveMerchantLogo({ label: "Netflix", texts: [], isExpense: true })).toEqual({ kind: "domain", domain: "netflix.com", origin: "dictionary" });
    expect(resolveMerchantLogo({ label: "Hetzner", texts: ["HETZNER.COM ONLINE"], isExpense: true })).toEqual({ kind: "domain", domain: "hetzner.com", origin: "text" });
    expect(resolveMerchantLogo({ label: "Bar Centrale", texts: ["POS BAR CENTRALE"], isExpense: true })).toEqual({ kind: "name", name: "bar centrale" });
  });

  it("non cerca mai per nome bonifici ed entrate", () => {
    expect(resolveMerchantLogo({ label: "Luca Bianchi", texts: ["BONIFICO A FAVORE DI LUCA BIANCHI"], isExpense: true })).toBeNull();
    expect(resolveMerchantLogo({ label: "Bar Centrale", texts: [], isExpense: false })).toBeNull();
  });
});

describe("firma dei loghi", () => {
  beforeEach(() => vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("i domini del dizionario non hanno firma, gli altri sì e solo per quel valore", () => {
    expect(merchantLogoPath({ kind: "domain", domain: "netflix.com", origin: "dictionary" })).toBe("/api/merchant-logos/netflix.com");
    const path = merchantLogoPath({ kind: "name", name: "bar centrale" });
    const signature = new URL(path!, "http://x").searchParams.get("s");
    expect(path).toMatch(/^\/api\/merchant-logos\/name\/bar%20centrale\?s=/);
    expect(verifyMerchantLogoSignature("name", "bar centrale", signature)).toBe(true);
    expect(verifyMerchantLogoSignature("name", "bar centro", signature)).toBe(false);
    expect(verifyMerchantLogoSignature("domain", "bar centrale", signature)).toBe(false);
    expect(verifyMerchantLogoSignature("name", "bar centrale", null)).toBe(false);
  });
});

describe("ricerca per nome", () => {
  it("accetta solo un risultato con lo stesso nome", () => {
    const results = [
      { name: "Bar Centrale Group", domain: "barcentralegroup.com" },
      { name: "BAR CENTRALE S.p.A.", domain: "www.barcentrale.it" },
    ];
    expect(pickMatchingDomain("bar centrale", results)).toBe("barcentrale.it");
    expect(pickMatchingDomain("bar centrale", results.slice(0, 1))).toBeNull();
  });

  it("legge la risposta di Logo.dev e non lancia sugli errori", async () => {
    const ok = vi.fn(async () => Response.json({ data: [{ object: "search_result", name: "Hetzner", domain: "hetzner.com" }] }));
    expect(await searchBrandDomain("hetzner", { secretKey: "sk_test", fetchFn: ok })).toEqual({ outcome: "found", domain: "hetzner.com" });
    expect(String((ok.mock.calls[0] as unknown[])[0])).toContain("q=hetzner");
    const limited = vi.fn(async () => new Response(null, { status: 429 }));
    expect(await searchBrandDomain("hetzner", { secretKey: "sk_test", fetchFn: limited })).toEqual({ outcome: "error", status: 429 });
  });
});

function memoryStore(users: number, budget = 10): MerchantNameStore & { domains: Map<string, string | null> } {
  const domains = new Map<string, string | null>();
  let used = 0;
  return {
    domains,
    async getDomain(name) {
      return domains.has(name) ? domains.get(name)! : undefined;
    },
    async setDomain(name, domain) {
      domains.set(name, domain);
    },
    async addPresence() {},
    async countUsers() {
      return users;
    },
    async takeSearchBudget() {
      used += 1;
      return used <= budget;
    },
  };
}

describe("resolveNameDomain", () => {
  const found = vi.fn(async () => Response.json({ data: [{ name: "Bar Centrale", domain: "barcentrale.it" }] }));

  it("non cerca un nome visto in pochi utenti né senza chiave", async () => {
    expect(await resolveNameDomain("bar centrale", { store: memoryStore(MIN_USERS_FOR_NAME_SEARCH - 1), secretKey: "sk", fetchFn: found })).toEqual({
      status: "skipped",
      reason: "few_users",
    });
    expect(await resolveNameDomain("bar centrale", { store: memoryStore(10), secretKey: undefined, fetchFn: found })).toEqual({
      status: "skipped",
      reason: "disabled",
    });
  });

  it("cerca una volta e poi usa la cache, anche per un nome senza risultato", async () => {
    const store = memoryStore(MIN_USERS_FOR_NAME_SEARCH);
    expect(await resolveNameDomain("bar centrale", { store, secretKey: "sk", fetchFn: found })).toEqual({
      status: "searched",
      search: { outcome: "found", domain: "barcentrale.it" },
    });
    expect(await resolveNameDomain("bar centrale", { store, secretKey: "sk", fetchFn: found })).toEqual({ status: "cached", domain: "barcentrale.it" });

    const empty = vi.fn(async () => Response.json({ data: [] }));
    await resolveNameDomain("ottica vista", { store, secretKey: "sk", fetchFn: empty });
    expect(store.domains.get("ottica vista")).toBeNull();
  });

  it("si ferma quando il budget del giorno è finito", async () => {
    expect(await resolveNameDomain("bar centrale", { store: memoryStore(10, 0), secretKey: "sk", fetchFn: found })).toEqual({
      status: "skipped",
      reason: "budget",
    });
  });
});
