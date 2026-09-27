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
