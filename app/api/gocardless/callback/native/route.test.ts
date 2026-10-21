import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, getRequisition: vi.fn() };
});

import { auth } from "@/lib/auth";
import { getRequisition } from "@/lib/gocardless/client";
import { GET } from "./route";

const REF = "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b";

async function returnTo(query: string) {
  const response = await GET(new NextRequest(`http://localhost/api/gocardless/callback/native${query}`));
  expect(response.status).toBe(302);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return new URL(response.headers.get("location")!);
}

describe("GET /api/gocardless/callback/native", () => {
  it("hands the browser back to the app with the reference, without a session and without touching state", async () => {
    const location = await returnTo(`?ref=${REF}`);
    expect(location.protocol).toBe("buddybudget:");
    expect(`${location.protocol}//${location.host}${location.pathname}`).toBe("buddybudget://bank/return");
    expect(Object.fromEntries(location.searchParams)).toEqual({ ref: REF, status: "returned" });
    expect(auth.api.getSession).not.toHaveBeenCalled();
    expect(getRequisition).not.toHaveBeenCalled();
  });

  it("reports a cancelled consent", async () => {
    const location = await returnTo(`?ref=${REF}&error=UserCancelledSession&details=User+cancelled+the+session.`);
    expect(Object.fromEntries(location.searchParams)).toEqual({ ref: REF, status: "cancelled", error: "UserCancelledSession" });
  });

  it("reports any other GoCardless error as failed, passing its code on (sanitized)", async () => {
    const failed = await returnTo(`?ref=${REF}&error=InstitutionTechnicalError`);
    expect(Object.fromEntries(failed.searchParams)).toEqual({ ref: REF, status: "failed", error: "InstitutionTechnicalError" });
    const odd = await returnTo(`?ref=${REF}&error=${encodeURIComponent("<script>")}`);
    expect(Object.fromEntries(odd.searchParams)).toEqual({ ref: REF, status: "failed", error: "unknown" });
  });

  it("returns to the app with invalid_ref when the reference is missing or not a uuid", async () => {
    expect(Object.fromEntries((await returnTo("")).searchParams)).toEqual({ status: "invalid_ref" });
    expect(Object.fromEntries((await returnTo("?ref=../../evil")).searchParams)).toEqual({ status: "invalid_ref" });
  });
});
