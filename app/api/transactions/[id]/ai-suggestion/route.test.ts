import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/categorization/ai/suggest-one", () => ({ suggestCategoryForTransaction: vi.fn() }));
vi.mock("@/lib/redis/client", () => ({ redis: { incr: vi.fn(async () => 1), expire: vi.fn() } }));

import { auth } from "@/lib/auth";
import { suggestCategoryForTransaction } from "@/lib/categorization/ai/suggest-one";
import { POST } from "./route";

const ID = "4b8f2c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";
const call = (id: string) => POST(new NextRequest(`http://localhost/api/transactions/${id}/ai-suggestion`, { method: "POST" }), { params: Promise.resolve({ id }) });

describe("POST /api/transactions/[id]/ai-suggestion", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(suggestCategoryForTransaction).mockReset();
  });

  it("returns the model's answer for the user's transaction", async () => {
    vi.mocked(suggestCategoryForTransaction).mockResolvedValue({ status: "ok", categoryId: "c1", confidence: 0.8 });
    const response = await call(ID);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", categoryId: "c1", confidence: 0.8 });
    expect(vi.mocked(suggestCategoryForTransaction).mock.calls[0].slice(0, 2)).toEqual(["user-1", ID]);
  });

  it("answers 404 for someone else's transaction or an invalid id, and 401 without a session", async () => {
    vi.mocked(suggestCategoryForTransaction).mockResolvedValue(null);
    expect((await call(ID)).status).toBe(404);
    expect((await call("not-an-id")).status).toBe(404);
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    expect((await call(ID)).status).toBe(401);
  });
});
