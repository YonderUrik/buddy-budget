import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/sync-jobs/redis-store", async () => {
  const { createMemorySyncJobKv, createSyncJobStore } = await import("@/lib/sync-jobs/store");
  return { redisSyncJobStore: createSyncJobStore(createMemorySyncJobKv()) };
});

import { auth } from "@/lib/auth";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { queuedAccount } from "@/lib/sync-jobs/types";
import { GET } from "./route";
import { POST as DISMISS } from "./[id]/dismiss/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function dismiss(id: string) {
  return DISMISS(new NextRequest(`http://localhost/api/sync-jobs/${id}/dismiss`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("API sync-jobs", () => {
  let userId: string;

  beforeEach(() => {
    userId = `user-${crypto.randomUUID()}`;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  it("GET risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/sync-jobs"));
    expect(response.status).toBe(401);
  });

  it("GET restituisce solo i job non chiusi dell'utente, come vista", async () => {
    const mine = await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [queuedAccount("a", "A")] });
    const closed = await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [] });
    await redisSyncJobStore.dismissJob(userId, closed.id);
    await redisSyncJobStore.createJob({ userId: "altro-utente", kind: "manual-sync", accounts: [] });

    const response = await GET(new NextRequest("http://localhost/api/sync-jobs"));
    const body = await response.json();
    expect(body.map((job: { id: string }) => job.id)).toEqual([mine.id]);
    expect(body[0].interrupted).toBe(false);
  });

  it("dismiss chiude un proprio job e rifiuta con 404 quello di un altro utente", async () => {
    const foreign = await redisSyncJobStore.createJob({ userId: "altro-utente", kind: "manual-sync", accounts: [] });
    expect((await dismiss(foreign.id)).status).toBe(404);

    const mine = await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [] });
    expect((await dismiss(mine.id)).status).toBe(204);
    expect((await redisSyncJobStore.listJobs(userId))[0].dismissed).toBe(true);
  });

  it("GET risponde 503 se lo store non risponde", async () => {
    vi.spyOn(redisSyncJobStore, "listJobs").mockRejectedValueOnce(new Error("Redis giù"));
    const response = await GET(new NextRequest("http://localhost/api/sync-jobs"));
    expect(response.status).toBe(503);
  });
});
