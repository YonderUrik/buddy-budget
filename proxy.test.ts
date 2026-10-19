import { describe, expect, it, vi } from "vitest";

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

describe("personal setup routing", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const call = (path: string, headers = {}) => proxy(new NextRequest(`http://localhost:8080${path}`, { headers: { host: "localhost:8080", ...headers } }));

  it("opens the local session entry from both the app and login screen", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("SELFHOST_AUTH_MODE", "local");
    vi.stubEnv("APP_BIND", "127.0.0.1");
    vi.stubEnv("APP_URL", "http://localhost:8080");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:8080");
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    try {
      for (const path of ["/", "/login"]) {
        expect((await call(path)).headers.get("location")).toMatch(/^http:\/\/localhost:8080\/api\/auth\/selfhost-local\?/);
      }
      expect((await call("/api/transactions")).status).toBe(401);
      expect((await call("/", { origin: "https://evil.test" })).status).toBe(403);
      expect((await call("/", { host: "evil.test" })).status).toBe(403);
      expect((await call("/api/health/ready", { host: "localhost:3000" })).status).toBe(200);
    } finally { vi.unstubAllEnvs(); }
  });
});
