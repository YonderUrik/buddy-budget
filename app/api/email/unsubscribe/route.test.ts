import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { createUnsubscribeToken, getNotificationPreferences, saveNotificationPreferences } from "@/lib/notifications/server";
import { GET, POST } from "./route";

const userId = `test-unsub-${crypto.randomUUID()}`;

function call(handler: typeof POST, token: string | null, query = "") {
  const url = `http://localhost/api/email/unsubscribe${token === null ? "" : `?t=${encodeURIComponent(token)}`}${query}`;
  return handler(new NextRequest(url, { method: handler === POST ? "POST" : "GET", body: handler === POST ? "List-Unsubscribe=One-Click" : undefined }));
}

beforeEach(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(40));
  vi.stubEnv("APP_URL", "https://app.example.test");
  await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, onboardingCompleted: true }).onConflictDoNothing();
  await saveNotificationPreferences(userId, { digestEnabled: true, budgetAlertsEnabled: true, deadlineAlertsEnabled: true });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.delete(authUser).where(eq(authUser.id, userId));
  await client.end();
});

describe("POST /api/email/unsubscribe", () => {
  it("one-click senza login: spegne il tipo del token e risponde 200", async () => {
    const response = await call(POST, createUnsubscribeToken({ userId, scope: "budget" }));
    expect(response.status).toBe(200);
    expect(await getNotificationPreferences(userId)).toMatchObject({ digestEnabled: true, budgetAlertsEnabled: false, deadlineAlertsEnabled: true });
  });

  it("`all` spegne tutto e ripetere il clic non cambia l'esito", async () => {
    const token = createUnsubscribeToken({ userId, scope: "all" });
    expect((await call(POST, token, "&source=page")).status).toBe(200);
    expect((await call(POST, token)).status).toBe(200);
    expect(await getNotificationPreferences(userId)).toMatchObject({ digestEnabled: false, budgetAlertsEnabled: false, deadlineAlertsEnabled: false });
  });

  it("rifiuta token mancanti o manomessi senza toccare nulla", async () => {
    expect((await call(POST, null)).status).toBe(400);
    expect((await call(POST, `${createUnsubscribeToken({ userId, scope: "digest" })}x`)).status).toBe(400);
    expect(await getNotificationPreferences(userId)).toMatchObject({ digestEnabled: true });
  });

  it("per un utente non più esistente risponde come per uno esistente", async () => {
    const response = await call(POST, createUnsubscribeToken({ userId: "utente-eliminato", scope: "all" }));
    expect(response.status).toBe(200);
  });
});

describe("GET /api/email/unsubscribe", () => {
  it("non disiscrive: porta alla pagina, dove serve un clic (antivirus e anteprime non toccano le preferenze)", async () => {
    const token = createUnsubscribeToken({ userId, scope: "digest" });
    const response = await call(GET, token);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`https://app.example.test/disiscrizione?t=${encodeURIComponent(token)}`);
    expect(await getNotificationPreferences(userId)).toMatchObject({ digestEnabled: true });
  });
});
