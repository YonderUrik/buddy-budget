import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { meBootstrapSchema } from "@/lib/account/bootstrap";
import { LEGAL_VERSION } from "@/lib/legal";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

const call = () => GET(new NextRequest("http://localhost/api/me/bootstrap", { headers: { Authorization: "Bearer session-token" } }));
const createdAt = new Date("2026-10-18T08:00:00.000Z");

beforeEach(() => vi.clearAllMocks());

describe("GET /api/me/bootstrap", () => {
  it("requires a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("returns the launch state of the session user, read with the request headers", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "user-1", name: "Mario", email: "mario@example.com", emailVerified: true, image: null, createdAt, updatedAt: createdAt,
        productCountry: "DE", language: "en", currency: "EUR", homePage: "/investimenti", hideAmounts: true,
        onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedAt: createdAt, legalAcceptedVersion: "2020-01-01",
      },
      session: { id: "s", userId: "user-1", token: "t", createdAt, updatedAt: createdAt, expiresAt: new Date("2026-10-25T08:00:00.000Z") },
    } as never);
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = meBootstrapSchema.parse(await response.json());
    expect(body).toMatchObject({
      user: { id: "user-1", email: "mario@example.com" },
      profile: { productCountry: "DE", language: "en", homePage: "/investimenti", hideAmounts: true },
      gate: "legal_acceptance_required",
      legal: { currentVersion: LEGAL_VERSION, acceptedVersion: "2020-01-01", needsAcceptance: true },
      capabilities: { sections: { pension: false, investmentTaxes: true } },
    });
    expect(new Headers(vi.mocked(auth.api.getSession).mock.calls[0]?.[0]?.headers).get("authorization")).toBe("Bearer session-token");
  });
});
