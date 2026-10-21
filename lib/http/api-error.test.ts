import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_ERROR_CODES, apiError, genericErrorCode, validationError, withErrorCode } from "./api-error";

describe("genericErrorCode", () => {
  it("maps statuses to stable codes, leaving 401 and successes alone", () => {
    expect(genericErrorCode(400)).toBe("bad_request");
    expect(genericErrorCode(404)).toBe("not_found");
    expect(genericErrorCode(409)).toBe("conflict");
    expect(genericErrorCode(418)).toBe("bad_request");
    expect(genericErrorCode(503)).toBe("internal_error");
    expect(genericErrorCode(401)).toBeNull();
    expect(genericErrorCode(200)).toBeNull();
  });

  it("only uses codes of the closed list", () => {
    for (const status of [400, 403, 404, 409, 422, 429, 500]) expect(API_ERROR_CODES).toContain(genericErrorCode(status));
  });
});

describe("withErrorCode", () => {
  it("adds the generic code to a JSON error without one", async () => {
    const res = await withErrorCode(Response.json({ error: "Conto non valido" }, { status: 400 }));
    expect(await res.json()).toEqual({ error: "Conto non valido", code: "bad_request" });
  });

  it("keeps a code set by the route", async () => {
    const res = await withErrorCode(apiError(400, "invalid_account", "Conto non valido"));
    expect(await res.json()).toEqual({ error: "Conto non valido", code: "invalid_account" });
  });

  it("gives an empty error body a code, but not a 401", async () => {
    const notFound = await withErrorCode(new Response(null, { status: 404 }));
    expect(notFound.headers.get("content-type")).toBe("application/json");
    expect(await notFound.json()).toEqual({ code: "not_found" });
    const unauthorized = await withErrorCode(new Response(null, { status: 401 }));
    expect(await unauthorized.text()).toBe("");
  });

  it("leaves 4xx bodies without `error` unchanged", async () => {
    const res = await withErrorCode(Response.json({ status: "already-running" }, { status: 409 }));
    expect(await res.json()).toEqual({ status: "already-running" });
  });

  it("leaves successes, non-JSON and array bodies unchanged", async () => {
    const ok = Response.json({ a: 1 });
    expect(await withErrorCode(ok)).toBe(ok);
    const text = new Response("nope", { status: 400, headers: { "content-type": "text/plain" } });
    expect(await withErrorCode(text)).toBe(text);
  });
});

describe("validationError", () => {
  it("returns the first issue with its field", async () => {
    const parsed = z.object({ amount: z.number({ error: "Importo non valido" }) }).safeParse({ amount: "x" });
    if (parsed.success) throw new Error("expected a failure");
    const res = validationError(parsed.error);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Importo non valido", code: "validation_failed", field: "amount" });
  });
});
