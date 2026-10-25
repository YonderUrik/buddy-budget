import { expect, it, vi } from "vitest";

// Opt-in only: point this variable at a disposable, migrated, empty Postgres database.
const databaseURL = process.env.SELFHOST_TEST_DATABASE_URL;
it.skipIf(!databaseURL)("creates one local owner atomically, preserves data and revokes sessions when moving to a server", async () => {
  vi.stubEnv("DATABASE_URL", databaseURL!);
  vi.stubEnv("SELF_HOSTED", "true");
  vi.stubEnv("SELFHOST_AUTH_MODE", "local");
  vi.stubEnv("SELFHOST_OWNER_EMAIL", "");
  vi.stubEnv("APP_BIND", "127.0.0.1");
  vi.stubEnv("APP_URL", "http://localhost:8080");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:8080");
  const { client } = await import("@/lib/db/client");
  const { initializeLocalOwner } = await import("./local-owner");
  const { auth } = await import("./index");
  const { LOCAL_OWNER_ID } = await import("@/lib/selfhost");
  // Fail before changing anything if this is not an empty disposable database.
  const original = await client`select count(*)::int as count from auth_user`;
  expect(original[0].count).toBe(0);
  try {
    await Promise.all([initializeLocalOwner(), initializeLocalOwner()]);
    const users = await client`select id, email from auth_user`;
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(LOCAL_OWNER_ID);
    const categories = await client`select count(*)::int as count from categories where user_id = ${LOCAL_OWNER_ID}`;
    expect(categories[0].count).toBeGreaterThan(0);
    await client`update auth_user set name = 'Preserved personal profile' where id = ${LOCAL_OWNER_ID}`;
    const response = await auth.handler(new Request("http://localhost:8080/api/auth/selfhost-local", { headers: { host: "localhost:8080" } }));
    expect(response.status).toBe(302);
    const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    expect((await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.id).toBe(LOCAL_OWNER_ID);
    vi.stubEnv("SELFHOST_AUTH_MODE", "server");
    await expect(initializeLocalOwner()).rejects.toThrow("real email");
    vi.stubEnv("SELFHOST_OWNER_EMAIL", "owner@example.test");
    await initializeLocalOwner();
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
    const [preserved] = await client`select name, email from auth_user where id = ${LOCAL_OWNER_ID}`;
    expect(preserved).toEqual({ name: "Preserved personal profile", email: "owner@example.test" });
    expect((await client`select count(*)::int as count from categories where user_id = ${LOCAL_OWNER_ID}`)[0].count).toBe(categories[0].count);
    expect((await auth.handler(new Request("http://localhost:8080/api/auth/selfhost-local", { headers: { host: "localhost:8080" } }))).status).toBe(403);
    // A normal server session survives a restart; only mode/email transitions revoke it.
    const context = await auth.$context;
    await context.internalAdapter.createSession(LOCAL_OWNER_ID);
    await initializeLocalOwner();
    expect((await client`select count(*)::int as count from auth_session`)[0].count).toBe(1);
    await client`insert into auth_user (id, name, email) values ('other-test-account', 'Other account', 'other@example.test')`;
    vi.stubEnv("SELFHOST_AUTH_MODE", "local");
    await expect(initializeLocalOwner()).rejects.toThrow("other accounts");
    expect((await client`select count(*)::int as count from auth_user`)[0].count).toBe(2);
    await client`delete from auth_user where id = 'other-test-account'`;
    await initializeLocalOwner();
    expect((await client`select count(*)::int as count from auth_session`)[0].count).toBe(0);
  } finally {
    await client`delete from auth_user where id in (${LOCAL_OWNER_ID}, 'other-test-account')`;
    await client.end();
    vi.unstubAllEnvs();
  }
}, 20_000);
