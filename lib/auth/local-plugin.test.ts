import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { localAccessPlugin } from "./local-plugin";
import { LOCAL_OWNER_ID } from "@/lib/selfhost";

const baseURL = "http://localhost:8080";
function fixture() {
  const database = { user: [{ id: LOCAL_OWNER_ID, name: "My budget", email: "local@buddybudget.invalid", emailVerified: false, createdAt: new Date(), updatedAt: new Date() }], session: [], account: [], verification: [] };
  const auth = betterAuth({ baseURL, secret: "local-access-test-secret-with-32-characters", database: memoryAdapter(database), plugins: [localAccessPlugin()] });
  const call = (path: string, headers = {}) => auth.handler(new Request(baseURL + path, { headers: { host: "localhost:8080", ...headers } }));
  return { database, call };
}

describe("automatic local sessions using Better Auth", () => {
  beforeEach(() => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("SELFHOST_AUTH_MODE", "local");
    vi.stubEnv("APP_BIND", "127.0.0.1");
    vi.stubEnv("APP_URL", baseURL);
    vi.stubEnv("BETTER_AUTH_URL", baseURL);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sets a signed cookie that normal getSession can read, and reuses the session", async () => {
    const { call, database } = fixture();
    const opened = await call("/api/auth/selfhost-local?redirect=/impostazioni");
    expect(opened.status).toBe(302);
    expect(opened.headers.get("location")).toBe(baseURL + "/impostazioni");
    expect(opened.headers.get("cache-control")).toBe("no-store");
    const cookie = opened.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    expect(cookie).toContain("session_token=");
    expect(opened.headers.getSetCookie().join(";")).toContain("HttpOnly");
    const session = await (await call("/api/auth/get-session", { cookie })).json();
    expect(session.user.id).toBe(LOCAL_OWNER_ID);
    await call("/api/auth/selfhost-local", { cookie });
    expect(database.session).toHaveLength(1);
    expect(database.user).toHaveLength(1);
  });

  it.each(["server", ""])("never issues a local session with mode %s", async mode => {
    vi.stubEnv("SELFHOST_AUTH_MODE", mode);
    const { call, database } = fixture();
    expect((await call("/api/auth/selfhost-local")).status).toBe(403);
    expect(database.session).toHaveLength(0);
  });

  it.each([{ host: "evil.test" }, { origin: "https://evil.test" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }])("blocks an untrusted request %j", async headers => {
    const { call, database } = fixture();
    expect((await call("/api/auth/selfhost-local", headers)).status).toBe(403);
    expect(database.session).toHaveLength(0);
  });

  it.each(["https://evil.test", "//evil.test", "/api/auth/selfhost-local", "/api/transactions", "/a/../../api/auth/selfhost-local"])("does not redirect outside the app or into auth/API loops: %s", async redirect => {
    const { call } = fixture();
    const response = await call("/api/auth/selfhost-local?redirect=" + encodeURIComponent(redirect));
    expect(response.headers.get("location")).toBe(baseURL + "/");
  });
});
