import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/account/emails", () => ({ sendAccountEmail: vi.fn() }));
vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, deleteRequisition: vi.fn() };
});

import { auth } from "@/lib/auth";
import { client, db } from "@/lib/db/client";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { sendAccountEmail } from "@/lib/account/emails";
import { REAUTH_REQUIRED_CODE, RECENT_LOGIN_MAX_AGE_MINUTES, RESET_CONFIRMATION_WORD } from "@/lib/account/constants";
import { redis } from "@/lib/redis/client";
import { GET as getSettings, PATCH as patchSettings } from "./settings/route";
import { GET as listSessions, DELETE as revokeOthers } from "./sessions/route";
import { DELETE as revokeOne } from "./sessions/[id]/route";
import { GET as exportData } from "./export/route";
import { POST as resetData } from "./reset/route";
import { POST as deactivate } from "./deactivate/route";
import { POST as reactivate } from "./reactivate/route";
import { DELETE as deleteAccount } from "./account/route";
import { GET as dataSummary } from "./data-summary/route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const userIds: string[] = [];
const MINUTE = 60_000;

interface TestUser {
  id: string;
  email: string;
  sessionId: string;
  otherSessionId: string;
}

async function createUser(): Promise<TestUser> {
  const tag = crypto.randomUUID();
  const id = `test-user-routes-${tag}`;
  const email = `Test-Routes-${tag}@Example.com`;
  await db.insert(authUser).values({ id, name: "Test", email, onboardingCompleted: true });
  userIds.push(id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * MINUTE);
  await db.insert(authSession).values([
    { id: `cur-${tag}`, userId: id, token: `tc-${tag}`, expiresAt, userAgent: "Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36" },
    { id: `oth-${tag}`, userId: id, token: `to-${tag}`, expiresAt, userAgent: "Mozilla/5.0 (iPhone) Safari/604.1 Mobile" },
    { id: `old-${tag}`, userId: id, token: `tx-${tag}`, expiresAt: new Date(Date.now() - MINUTE) },
  ]);
  return { id, email, sessionId: `cur-${tag}`, otherSessionId: `oth-${tag}` };
}

/** Simula la sessione di `user` creata `ageMinutes` minuti fa. */
async function signIn(user: TestUser, ageMinutes = 1) {
  const [row] = await db.select().from(authUser).where(eq(authUser.id, user.id));
  mockedGetSession.mockResolvedValue({
    user: row,
    session: { id: user.sessionId, userId: user.id, createdAt: new Date(Date.now() - ageMinutes * MINUTE) },
  } as never);
}

function req(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("API gestione account", () => {
  beforeEach(() => {
    mockedGetSession.mockReset().mockResolvedValue(null);
    vi.mocked(sendAccountEmail).mockReset();
  });

  afterAll(async () => {
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    await client.end();
    redis.disconnect();
  });

  it("senza sessione tutte le route rispondono 401", async () => {
    const responses = await Promise.all([
      getSettings(req("/api/user/settings")),
      listSessions(req("/api/user/sessions")),
      exportData(req("/api/user/export")),
      resetData(req("/api/user/reset", "POST", {})),
      deactivate(req("/api/user/deactivate", "POST")),
      deleteAccount(req("/api/user/account", "DELETE", {})),
      dataSummary(req("/api/user/data-summary")),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });

  it("impostazioni: legge profilo e salva solo valori ammessi", async () => {
    const user = await createUser();
    await signIn(user);
    const settings = await (await getSettings(req("/api/user/settings"))).json();
    expect(settings).toMatchObject({ email: user.email, currency: "EUR", homePage: "/panoramica", googleLinked: false });

    expect((await patchSettings(req("/api/user/settings", "PATCH", { currency: "XYZ" }))).status).toBe(400);
    expect((await patchSettings(req("/api/user/settings", "PATCH", { onboardingCompleted: false }))).status).toBe(400);
    expect((await patchSettings(req("/api/user/settings", "PATCH", { name: " Anna ", currency: "CHF", homePage: "/conti" }))).status).toBe(204);
    const [row] = await db.select().from(authUser).where(eq(authUser.id, user.id));
    expect(row).toMatchObject({ name: "Anna", currency: "CHF", homePage: "/conti", onboardingCompleted: true });
  });

  it("sessioni: elenca solo quelle valide, senza token, e non chiude sessioni altrui", async () => {
    const user = await createUser();
    const stranger = await createUser();
    await signIn(user);
    const list = await (await listSessions(req("/api/user/sessions"))).json();
    expect(list.map((s: { id: string }) => s.id)).toEqual([user.sessionId, user.otherSessionId]);
    expect(list[0]).toMatchObject({ current: true, device: "Chrome su macOS" });
    expect(list[1]).toMatchObject({ current: false, device: "Safari su iOS", mobile: true });
    expect(JSON.stringify(list)).not.toContain("tc-");

    expect((await revokeOne(req(`/api/user/sessions/${stranger.otherSessionId}`, "DELETE"), params(stranger.otherSessionId))).status).toBe(404);
    expect(await db.select().from(authSession).where(eq(authSession.id, stranger.otherSessionId))).toHaveLength(1);
    expect((await revokeOne(req(`/api/user/sessions/${user.sessionId}`, "DELETE"), params(user.sessionId))).status).toBe(400);
    expect((await revokeOne(req(`/api/user/sessions/${user.otherSessionId}`, "DELETE"), params(user.otherSessionId))).status).toBe(204);
    expect(await db.select().from(authSession).where(eq(authSession.id, user.otherSessionId))).toHaveLength(0);
  });

  it("esci dagli altri dispositivi lascia solo la sessione corrente", async () => {
    const user = await createUser();
    await signIn(user);
    const body = await (await revokeOthers(req("/api/user/sessions", "DELETE"))).json();
    expect(body.revoked).toBe(2);
    const rest = await db.select({ id: authSession.id }).from(authSession).where(eq(authSession.userId, user.id));
    expect(rest.map((s) => s.id)).toEqual([user.sessionId]);
  });

  it("le azioni sensibili richiedono un accesso recente", async () => {
    const user = await createUser();
    await signIn(user, RECENT_LOGIN_MAX_AGE_MINUTES + 1);
    for (const response of [
      await exportData(req("/api/user/export")),
      await resetData(req("/api/user/reset", "POST", { confirmation: RESET_CONFIRMATION_WORD })),
      await deactivate(req("/api/user/deactivate", "POST")),
      await deleteAccount(req("/api/user/account", "DELETE", { email: user.email })),
    ]) {
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe(REAUTH_REQUIRED_CODE);
    }
    expect(await db.select().from(authUser).where(eq(authUser.id, user.id))).toHaveLength(1);
  });

  it("export: ZIP scaricabile con accesso recente", async () => {
    const user = await createUser();
    await signIn(user);
    const response = await exportData(req("/api/user/export"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toMatch(/attachment; filename="buddybudget-export-\d{4}-\d{2}-\d{2}\.zip"/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
  });

  it("reset: serve la parola di conferma, poi si riparte dall'onboarding", async () => {
    const user = await createUser();
    await signIn(user);
    expect((await resetData(req("/api/user/reset", "POST", { confirmation: "resetta" }))).status).toBe(400);
    expect((await resetData(req("/api/user/reset", "POST", { confirmation: RESET_CONFIRMATION_WORD }))).status).toBe(204);
    const [row] = await db.select().from(authUser).where(eq(authUser.id, user.id));
    expect(row.onboardingCompleted).toBe(false);
    expect((await db.select().from(categories).where(eq(categories.userId, user.id))).length).toBeGreaterThan(0);
  });

  it("disattivazione e riattivazione", async () => {
    const user = await createUser();
    await signIn(user);
    const response = await deactivate(req("/api/user/deactivate", "POST"));
    expect(response.status).toBe(200);
    const { deletionScheduledAt } = await response.json();
    expect(new Date(deletionScheduledAt).getTime()).toBeGreaterThan(Date.now());
    expect(vi.mocked(sendAccountEmail)).toHaveBeenCalledWith(user.email, "deactivated", expect.objectContaining({ userId: user.id }));
    const remaining = await db.select({ id: authSession.id }).from(authSession).where(eq(authSession.userId, user.id));
    expect(remaining.map((s) => s.id)).toEqual([user.sessionId]);

    await signIn(user);
    expect((await deactivate(req("/api/user/deactivate", "POST"))).status).toBe(409);
    expect((await reactivate(req("/api/user/reactivate", "POST"))).status).toBe(204);
    const [row] = await db.select().from(authUser).where(eq(authUser.id, user.id));
    expect(row.deletionScheduledAt).toBeNull();
  });

  it("eliminazione: serve l'email giusta (maiuscole ignorate), poi l'utente non esiste più", async () => {
    const user = await createUser();
    await signIn(user);
    expect((await deleteAccount(req("/api/user/account", "DELETE", { email: "altro@example.com" }))).status).toBe(400);
    expect(await db.select().from(authUser).where(eq(authUser.id, user.id))).toHaveLength(1);
    expect((await deleteAccount(req("/api/user/account", "DELETE", { email: ` ${user.email.toLowerCase()} ` }))).status).toBe(204);
    expect(await db.select().from(authUser).where(eq(authUser.id, user.id))).toHaveLength(0);
    expect(await db.select().from(authSession).where(eq(authSession.userId, user.id))).toHaveLength(0);
    expect(vi.mocked(sendAccountEmail)).toHaveBeenCalledWith(user.email, "deleted", expect.anything());
  });
});
