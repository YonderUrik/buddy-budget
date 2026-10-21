import { afterEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer } from "better-auth/plugins";
import { PUBLIC_DEMO_BLOCKED_AUTH_PATHS, PUBLIC_DEMO_READ_ONLY_CODE } from "@/lib/public-demo/config";
import { publicDemo, type PublicDemoSessionReader } from "./public-demo-plugin";

vi.mock("@/lib/observability", () => ({
  recordPublicDemoEvent: vi.fn(),
  requestLogger: () => ({ info: vi.fn(), warn: vi.fn() }),
}));

const BASE_URL = "http://localhost:3000";
const DEMO_ID = "public-demo-it-en";
type Credentials = "cookie" | "bearer" | "both" | "cookie-invalid-bearer";

afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  vi.stubEnv("PUBLIC_DEMO_ENABLED", "true");
  const readSession: PublicDemoSessionReader = (headers) => auth.api.getSession({ headers });
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: "test-only-public-demo-bearer-secret",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    plugins: [publicDemo(readSession), bearer()],
  });
  const ctx = await auth.$context;
  await ctx.internalAdapter.createUser({ id: DEMO_ID, name: "Demo", email: "demo@example.test", emailVerified: true });

  const post = (path: string, body: unknown, headers?: HeadersInit) => auth.handler(new Request(`${BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json", ...Object.fromEntries(new Headers(headers)) },
    body: JSON.stringify(body),
  }));
  const signIn = await post("/public-demo/sign-in", { language: "en", productCountry: "IT" });
  expect(signIn.status).toBe(200);
  const token = signIn.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  const credentials = (method: Credentials): HeadersInit => ({
    ...(method !== "bearer" ? { Cookie: `better-auth.session_token=${token}` } : {}),
    ...(method !== "cookie" ? { Authorization: `Bearer ${method === "cookie-invalid-bearer" ? "invalid.signature" : token}` } : {}),
  });
  return { auth, ctx, post, credentials };
}

describe("public demo authentication protection", () => {
  it.each<Credentials>(["cookie", "bearer", "both", "cookie-invalid-bearer"])("blocks every available protected auth endpoint with %s credentials", async (method) => {
    const { auth, ctx, post, credentials } = await fixture();
    const availablePaths = new Set(Object.values(auth.api).map((endpoint) => endpoint.path));
    for (const path of PUBLIC_DEMO_BLOCKED_AUTH_PATHS) {
      // Some guarded paths belong to optional plugins or older better-auth versions.
      if (!availablePaths.has(path)) continue;
      const response = await post(path, { name: "Changed" }, credentials(method));
      expect(response.status, path).toBe(403);
      expect(await response.json()).toMatchObject({ code: PUBLIC_DEMO_READ_ONLY_CODE });
    }
    expect((await ctx.internalAdapter.findUserById(DEMO_ID))?.name).toBe("Demo");
  });

  it.each<Credentials>(["cookie", "bearer"])("allows demo session reads and sign-out with %s credentials", async (method) => {
    const { auth, post, credentials } = await fixture();
    const headers = credentials(method);
    const response = await auth.handler(new Request(`${BASE_URL}/api/auth/get-session`, { headers }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: DEMO_ID } });
    expect((await post("/sign-out", {}, headers)).status).toBe(200);
    expect(await auth.api.getSession({ headers: new Headers(headers) })).toBeNull();
  });

  it("allows real bearer sessions to update their account and prevents replacing them with a demo session", async () => {
    const { ctx, post } = await fixture();
    const signUp = await post("/sign-up/email", { name: "Real user", email: "real@example.test", password: "test-password-123" });
    expect(signUp.status).toBe(200);
    const token = signUp.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    const headers = { Authorization: `Bearer ${token}` };
    expect((await post("/update-user", { name: "Updated" }, headers)).status).toBe(200);
    const session = await ctx.internalAdapter.findSession((await signUp.json()).token);
    expect(session?.user.name).toBe("Updated");
    expect((await post("/public-demo/sign-in", { language: "en", productCountry: "IT" }, headers)).status).toBe(409);
  });
});
