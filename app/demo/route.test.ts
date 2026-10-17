import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const signInPublicDemo = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession, signInPublicDemo } } }));

const { GET } = await import("./route");

const PUBLIC_URL = "https://app.example.test";

/** A request as the container sees it: the URL carries the bind address, not the public host. */
function demoRequest(search = ""): NextRequest {
  return new NextRequest(`http://0.0.0.0:3000/demo${search}`);
}

describe("GET /demo", () => {
  beforeEach(() => {
    process.env.APP_URL = PUBLIC_URL;
    getSession.mockReset().mockResolvedValue(null);
    signInPublicDemo.mockReset().mockResolvedValue({ headers: new Headers({ "set-cookie": "demo=1; Path=/" }) });
  });

  it("redirects to the public address, not the container's", async () => {
    const response = await GET(demoRequest("?lang=en"));
    expect(response.headers.get("location")).toBe(`${PUBLIC_URL}/`);
    expect(response.headers.get("set-cookie")).toContain("demo=1");
  });

  it("keeps the requested page and falls back to the sign-in page on the public address", async () => {
    const withNext = await GET(demoRequest("?next=/liquidita"));
    expect(withNext.headers.get("location")).toBe(`${PUBLIC_URL}/liquidita`);
    signInPublicDemo.mockRejectedValue(new Error("demo_disabled"));
    const failed = await GET(demoRequest());
    expect(failed.headers.get("location")).toBe(`${PUBLIC_URL}/login`);
  });
});
