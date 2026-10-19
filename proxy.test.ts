import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { LEGAL_VERSION } from "@/lib/legal";
import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it.each(["/api/health", "/api/health/ready", "/api/cron/gocardless-sync", "/api/metrics", "/api/auth/callback/google", "/favicon.ico", "/api/email/unsubscribe", "/disiscrizione"])(
    "%s è pubblico",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(["/api/transactions", "/api/healthz", "/api/cronjobs", "/api/metricsx", "/api/emails", "/disiscrizionex", "/api/user/notifications", "/conti", "/"])("%s richiede sessione", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

// .env.local may define APP_URL: without it the proxy falls back to the request URL, which these tests assert.
beforeEach(() => {
  vi.stubEnv("APP_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy con account disattivato", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  function sessionWith(user: Record<string, unknown>) {
    mockedGetSession.mockResolvedValue({ user: { onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION, ...user }, session: {} } as never);
  }
  const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

  it("manda le pagine su /account-disattivato e blocca le API tranne la riattivazione", async () => {
    sessionWith({ deletionScheduledAt: new Date("2026-10-29") });
    expect((await call("/panoramica")).headers.get("location")).toBe("http://localhost/account-disattivato");
    expect((await call("/impostazioni")).headers.get("location")).toBe("http://localhost/account-disattivato");
    expect((await call("/account-disattivato")).headers.get("location")).toBeNull();
    expect((await call("/api/transactions")).status).toBe(403);
    expect((await call("/api/user/export")).status).toBe(403);
    expect((await call("/api/user/reactivate")).headers.get("location")).toBeNull();
    expect((await call("/api/user/reactivate")).status).toBe(200);
  });

  it("un account attivo non vede la pagina di disattivazione", async () => {
    sessionWith({});
    expect((await call("/account-disattivato")).headers.get("location")).toBe("http://localhost/");
    expect((await call("/impostazioni")).headers.get("location")).toBeNull();
  });
});

describe("proxy con documenti legali da accettare", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  function sessionWith(user: Record<string, unknown>) {
    mockedGetSession.mockResolvedValue({
      user: { onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: null, ...user },
      session: {},
    } as never);
  }
  const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

  it("manda le pagine su /accetta-termini e blocca le API tranne accettazione, export ed eliminazione", async () => {
    sessionWith({});
    expect((await call("/panoramica")).headers.get("location")).toBe("http://localhost/accetta-termini");
    expect((await call("/accetta-termini")).headers.get("location")).toBeNull();
    expect((await call("/api/transactions")).status).toBe(403);
    for (const path of ["/api/user/legal-acceptance", "/api/user/export", "/api/user/account"]) {
      expect((await call(path)).status).toBe(200);
    }
  });

  it("una versione vecchia richiede di nuovo l'accettazione, quella in vigore no", async () => {
    sessionWith({ legalAcceptedVersion: "2020-01-01" });
    expect((await call("/conti")).headers.get("location")).toBe("http://localhost/accetta-termini");
    sessionWith({ legalAcceptedVersion: LEGAL_VERSION });
    expect((await call("/conti")).headers.get("location")).toBeNull();
    expect((await call("/accetta-termini")).headers.get("location")).toBe("http://localhost/");
  });

  it("chi non ha finito l'onboarding accetta lì, senza passare dalla pagina di accettazione", async () => {
    sessionWith({ onboardingCompleted: false });
    expect((await call("/panoramica")).headers.get("location")).toBe("http://localhost/onboarding");
    expect((await call("/onboarding")).headers.get("location")).toBeNull();
  });

  it("un account disattivato vede prima la pagina di disattivazione", async () => {
    sessionWith({ deletionScheduledAt: new Date("2026-10-29") });
    expect((await call("/panoramica")).headers.get("location")).toBe("http://localhost/account-disattivato");
  });
});

describe("proxy con la demo pubblica", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  function sessionAs(id: string) {
    mockedGetSession.mockResolvedValue({
      user: { id, language: "en", productCountry: "IT", onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION },
      session: {},
    } as never);
  }
  const call = (path: string, method = "GET") => proxy(new NextRequest(`http://localhost${path}`, { method }));

  it("/demo è pubblico", () => {
    expect(isPublicPath("/demo")).toBe(true);
  });

  it("la demo legge tutto e non scrive niente", async () => {
    sessionAs("public-demo-en");
    expect((await call("/api/transactions")).status).toBe(200);
    expect((await call("/panoramica")).headers.get("location")).toBeNull();
    const blocked = await call("/api/transactions", "POST");
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: "demo_read_only" });
    expect((await call("/api/user/account", "DELETE")).status).toBe(403);
    expect((await call("/api/transactions/abc", "PATCH")).status).toBe(403);
  });

  it("un utente vero scrive come sempre", async () => {
    sessionAs("Xk2l9ZqP");
    expect((await call("/api/transactions", "POST")).status).toBe(200);
  });
});

describe("proxy behind the ingress", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  it("redirects to the public APP_URL, never to the container bind address", async () => {
    vi.stubEnv("APP_URL", "https://app.example.test/");
    mockedGetSession.mockResolvedValue(null as never);
    const signedOut = await proxy(new NextRequest("http://0.0.0.0:3000/panoramica"));
    expect(signedOut.headers.get("location")).toBe("https://app.example.test/login?redirect=%2Fpanoramica");

    mockedGetSession.mockResolvedValue({ user: { onboardingCompleted: false, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION }, session: {} } as never);
    const notOnboarded = await proxy(new NextRequest("http://0.0.0.0:3000/panoramica"));
    expect(notOnboarded.headers.get("location")).toBe("https://app.example.test/onboarding");

    const loggedIn = await proxy(new NextRequest("http://0.0.0.0:3000/login?redirect=/liquidita"));
    expect(loggedIn.headers.get("location")).toBe("https://app.example.test/liquidita");
  });
});

describe("proxy and the visitor's country", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  it("turns ?lang= on the sign-in page into the language choice and drops it from the address", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const response = await proxy(new NextRequest("http://localhost/login?utm_source=landing&lang=it&signup=1"));
    expect(response.headers.get("location")).toBe("http://localhost/login?utm_source=landing&signup=1");
    expect(response.cookies.get("bb-language")?.value).toBe("it");
    expect((await proxy(new NextRequest("http://localhost/login?lang=fr"))).headers.get("location")).toBeNull();
  });

  it("sends a section another country does not have to the explanation page, and APIs get a translated 403", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u1", language: "en", productCountry: "OTHER", onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION },
      session: {},
    } as never);
    expect((await proxy(new NextRequest("http://localhost/pensione"))).headers.get("location")).toBe("http://localhost/country-unavailable");
    const api = await proxy(new NextRequest("http://localhost/api/investments/tax-carryforwards"));
    expect(api.status).toBe(403);
    expect(await api.json()).toMatchObject({ code: "country_feature_unavailable", error: "Not available in your country yet. Coming soon." });
    expect((await proxy(new NextRequest("http://localhost/liquidita"))).headers.get("location")).toBeNull();
  });
});

describe("proxy with the Free and Pro plans", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  function sessionWith(user: Record<string, unknown>) {
    mockedGetSession.mockResolvedValue({
      user: { id: "user-1", email: "anna@example.com", onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION, ...user },
      session: {},
    } as never);
  }
  const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`));
  const billingOn = () => {
    vi.stubEnv("BILLING_MODE", "on");
    vi.stubEnv("SELF_HOSTED", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_MONTHLY", "price_m");
    vi.stubEnv("STRIPE_PRICE_YEARLY", "price_y");
  };

  it("leaves everything open while billing is off", async () => {
    sessionWith({ proUntil: null });
    expect((await call("/investimenti")).headers.get("location")).toBeNull();
    expect((await call("/api/investments/portfolio")).status).toBe(200);
  });

  it("sends a Free account from a Pro page to the plans page and answers 402 on a Pro API", async () => {
    billingOn();
    sessionWith({ proUntil: null });
    expect((await call("/investimenti/tasse")).headers.get("location")).toBe("http://localhost/pro?da=investimenti");
    expect((await call("/panoramica")).headers.get("location")).toBe("http://localhost/pro?da=panoramica");
    const api = await call("/api/debts");
    expect(api.status).toBe(402);
    expect(await api.json()).toMatchObject({ code: "pro_required" });
    expect((await call("/liquidita/movimenti")).headers.get("location")).toBeNull();
    expect((await call("/api/transactions")).status).toBe(200);
    expect((await call("/pro")).headers.get("location")).toBeNull();
    expect((await call("/api/billing/status")).status).toBe(200);
  });

  it("opens everything to a Pro account and to the shared public demo", async () => {
    billingOn();
    sessionWith({ proUntil: new Date(Date.now() + 86_400_000), proSource: "trial" });
    expect((await call("/investimenti")).headers.get("location")).toBeNull();
    sessionWith({ id: "public-demo-it-it", proUntil: null });
    expect((await call("/investimenti")).headers.get("location")).toBeNull();
  });

  it("checks the country first: a section the country lacks is not offered as Pro", async () => {
    billingOn();
    sessionWith({ proUntil: null, productCountry: "DE", language: "de" });
    expect((await call("/pensione")).headers.get("location")).toBe("http://localhost/country-unavailable");
  });

  it("keeps the Stripe webhook public", () => {
    expect(isPublicPath("/api/stripe/webhook")).toBe(true);
  });
});
