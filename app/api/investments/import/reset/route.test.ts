import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/investments/import/reset", () => ({ previewInvestmentReset: vi.fn(), resetInvestmentHistory: vi.fn() }));
import { auth } from "@/lib/auth";
import { previewInvestmentReset, resetInvestmentHistory } from "@/lib/investments/import/reset";
import { GET, DELETE } from "./route";
const session = vi.mocked(auth.api.getSession);
const request = (body: unknown) => new NextRequest("http://localhost/api/investments/import/reset", { method: "DELETE", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); });
describe("investment reset authorization and confirmation", () => {
  it("requires authentication for preview and deletion", async () => {
    session.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/investments/import/reset"))).status).toBe(401);
    expect((await DELETE(request({}))).status).toBe(401);
    expect(resetInvestmentHistory).not.toHaveBeenCalled();
  });
  it("rejects missing or incorrect explicit confirmation", async () => {
    session.mockResolvedValue({ user: { id: "signed-in-user" } } as never);
    for (const body of [{}, { revision: "a".repeat(64), confirmation: "yes" }, { revision: "bad", confirmation: "AZZERA INVESTIMENTI" }]) expect((await DELETE(request(body))).status).toBe(400);
    expect(resetInvestmentHistory).not.toHaveBeenCalled();
  });
  it("uses only the authenticated user, never a body-supplied user", async () => {
    session.mockResolvedValue({ user: { id: "signed-in-user" } } as never);
    vi.mocked(resetInvestmentHistory).mockResolvedValue({ status: 200, deletedOperations: 2, deletedStatements: 1, deletedPrices: 1, resetCashAccounts: 1 });
    expect((await DELETE(request({ userId: "victim", revision: "a".repeat(64), confirmation: "AZZERA INVESTIMENTI" }))).status).toBe(200);
    expect(resetInvestmentHistory).toHaveBeenCalledWith("signed-in-user", "a".repeat(64), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
  it("disables caching of the preview and returns stale-state conflicts", async () => {
    session.mockResolvedValue({ user: { id: "signed-in-user" } } as never);
    vi.mocked(previewInvestmentReset).mockResolvedValue({ revision: "a".repeat(64), operations: 0, untrackedOperations: 0, statements: 0, prices: 0, cashAccounts: 0 });
    expect((await GET(new NextRequest("http://localhost/api/investments/import/reset"))).headers.get("Cache-Control")).toBe("no-store");
    vi.mocked(resetInvestmentHistory).mockResolvedValue({ status: 409, error: "Refresh" });
    expect((await DELETE(request({ revision: "a".repeat(64), confirmation: "AZZERA INVESTIMENTI" }))).status).toBe(409);
  });
});
