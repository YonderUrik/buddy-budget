import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it.each(["/api/health", "/api/health/ready", "/api/cron/gocardless-sync", "/api/metrics", "/api/auth/callback/google", "/favicon.ico"])(
    "%s è pubblico",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(["/api/transactions", "/api/healthz", "/api/cronjobs", "/api/metricsx", "/conti", "/"])("%s richiede sessione", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("proxy con account disattivato", async () => {
  const { NextRequest } = await import("next/server");
  const { auth } = await import("@/lib/auth");
  const { proxy } = await import("./proxy");
  const mockedGetSession = vi.mocked(auth.api.getSession);

  function sessionWith(user: Record<string, unknown>) {
    mockedGetSession.mockResolvedValue({ user: { onboardingCompleted: true, deletionScheduledAt: null, ...user }, session: {} } as never);
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
