import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { deletePersonalImport, previewPersonalImportDeletion } from "@/lib/personal-import/delete";
import { enqueue, getPreview } from "@/lib/personal-import/jobs";
import { GET, POST } from "./route";
import { GET as preview, POST as confirm, DELETE as remove } from "./[id]/route";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/personal-import/jobs", () => ({ enqueue: vi.fn().mockResolvedValue({ id: "job" }), listImports: vi.fn().mockResolvedValue({ formats: [], jobs: [] }), getPreview: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/personal-import/delete", () => ({ previewPersonalImportDeletion: vi.fn().mockResolvedValue({ token: "a".repeat(64) }), deletePersonalImport: vi.fn().mockResolvedValue({ cashCount: 0, investmentCount: 0 }) }));
vi.mock("@/lib/personal-import/confirm", () => ({ confirmImport: vi.fn().mockResolvedValue({ inserted: 0 }) }));
const req = (method = "GET", body?: unknown, path = "", origin = "http://localhost:3000") => new NextRequest(`http://localhost:3000/api/personal-imports${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
beforeEach(() => { vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "owner" } } as never); vi.stubEnv("PERSONAL_CSV_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64")); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
describe("personal import API", () => {
  it("requires authentication on every route", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401); expect((await POST(req("POST", {}))).status).toBe(401);
    expect((await remove(req("DELETE", {}))).status).toBe(401); expect((await preview(req())).status).toBe(401); expect((await confirm(req("POST", {}))).status).toBe(401);
  });
  it("rejects cross-origin writes, malformed JSON and missing consent", async () => {
    expect((await POST(req("POST", {}, "", "https://other.example"))).status).toBe(403);
    expect((await POST(req("POST", "bad-json"))).status).toBe(400);
    expect((await POST(req("POST", { csv: "a,b\nx,y", name: "Test" }))).status).toBe(400);
    expect((await remove(req("DELETE", {}, "/d42c811b-f061-4a42-8023-0c84c8e1ce85", "https://other.example"))).status).toBe(403);
    expect((await remove(req("DELETE", {}, "/d42c811b-f061-4a42-8023-0c84c8e1ce85"))).status).toBe(400);
    expect((await POST(req("POST", { csv: "a,b\nx,y", name: "Test", consent: true, consentVersion: "openrouter-zdr-v1" }))).status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("previews and deletes only under the authenticated owner with the reviewed token", async () => {
    const id = "d42c811b-f061-4a42-8023-0c84c8e1ce85", token = "a".repeat(64);
    expect((await preview(req("GET", undefined, `/${id}?deletion=1`))).status).toBe(200);
    expect(previewPersonalImportDeletion).toHaveBeenCalledWith("owner", id);
    expect((await remove(req("DELETE", { token }, `/${id}`))).status).toBe(200);
    expect(deletePersonalImport).toHaveBeenCalledWith("owner", id, token);
  });
  it("enqueues under the authenticated owner and hides unknown previews", async () => {
    expect((await POST(req("POST", { csv: "a,b\nx,y", name: "Test", consent: true, consentVersion: "openrouter-raw-zdr-v2" }))).status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith("owner", expect.objectContaining({ name: "Test" }));
    expect((await preview(req("GET", undefined, "/d42c811b-f061-4a42-8023-0c84c8e1ce85"))).status).toBe(404);
    expect(getPreview).toHaveBeenCalledWith("owner", "d42c811b-f061-4a42-8023-0c84c8e1ce85");
  });
});
