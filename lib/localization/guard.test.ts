import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { auth } from "@/lib/auth";
import { withCountryGuard } from "./guard";
const session = vi.mocked(auth.api.getSession);
beforeEach(() => session.mockReset());
it("requires a session even when the proxy is bypassed", async () => {
  session.mockResolvedValue(null);
  const handler = vi.fn(() => new Response());
  expect((await withCountryGuard(handler)(new Request("https://app.test/api/pension"))).status).toBe(401);
  expect(handler).not.toHaveBeenCalled();
});
it("uses the persisted country, ignoring a forged language cookie or query", async () => {
  session.mockResolvedValue({ user: { productCountry: "DE", language: "en" } } as never);
  const handler = vi.fn(() => new Response());
  const response = await withCountryGuard(handler)(new Request("https://app.test/api/pension/funds?productCountry=IT", { headers: { cookie: "bb-language=it" } }));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "country_feature_unavailable" });
  expect(handler).not.toHaveBeenCalled();
});
it("allows the Italian product in English and forwards route parameters", async () => {
  session.mockResolvedValue({ user: { productCountry: "IT", language: "en" } } as never);
  const handler = vi.fn((_request: Request, id: string) => Response.json({ id }));
  expect(await (await withCountryGuard(handler)(new Request("https://app.test/api/pension/funds"), "123")).json()).toEqual({ id: "123" });
});
