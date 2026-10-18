import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { LEGAL_VERSION } from "@/lib/legal";
import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it.each(["/api/health", "/api/health/ready", "/api/legal", "/api/cron/gocardless-sync", "/api/metrics", "/api/auth/callback/google", "/favicon.ico", "/api/email/unsubscribe", "/disiscrizione", "/api/gocardless/callback/native", "/banca/ritorno"])(
    "%s è pubblico",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(["/api/transactions", "/api/me/bootstrap", "/api/legalx", "/api/healthz", "/api/cronjobs", "/api/metricsx", "/api/emails", "/disiscrizionex", "/api/user/notifications", "/conti", "/", "/api/gocardless/callback", "/api/gocardless/connections", "/api/gocardless/callback/nativex"])("%s richiede sessione", (path) => {
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

describe("proxy gates for API clients (native apps)", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  function sessionWith(user: Record<string, unknown>) {
    mockedGetSession.mockResolvedValue({ user: { onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION, ...user }, session: {} } as never);
  }
  const call = (path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(`http://localhost${path}`, { headers }));

  it("answers a deactivated account's API calls with a coded 403", async () => {
    sessionWith({ deletionScheduledAt: new Date("2026-10-29") });
    const response = await call("/api/transactions");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "account_deactivated" });
  });

  it("answers legal-gated API calls with a coded 403 carrying the version to accept", async () => {
    sessionWith({ legalAcceptedVersion: "2020-01-01" });
    const response = await call("/api/transactions");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "legal_acceptance_required", version: LEGAL_VERSION });
  });

  it("lets the bootstrap through every gate, and the onboarding gate never blocks the API", async () => {
    for (const user of [{ deletionScheduledAt: new Date("2026-10-29") }, { legalAcceptedVersion: null }, { onboardingCompleted: false, legalAcceptedVersion: null }, {}]) {
      sessionWith(user);
      expect((await call("/api/me/bootstrap")).status).toBe(200);
    }
    sessionWith({ onboardingCompleted: false, legalAcceptedVersion: null });
    expect((await call("/api/transactions")).status).toBe(200);
  });

  it("reads the session from the request headers, so a bearer token works like the cookie", async () => {
    sessionWith({});
    await call("/api/transactions", { Authorization: "Bearer session-token" });
    expect(new Headers(mockedGetSession.mock.lastCall?.[0]?.headers).get("authorization")).toBe("Bearer session-token");
    mockedGetSession.mockResolvedValue(null);
    expect((await call("/api/transactions", { Authorization: "Bearer expired" })).status).toBe(401);
  });

  it("keeps redirecting pages, not answering JSON", async () => {
    sessionWith({ legalAcceptedVersion: null });
    expect((await call("/panoramica")).headers.get("location")).toBe("http://localhost/accetta-termini");
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
