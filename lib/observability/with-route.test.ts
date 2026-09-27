import { beforeEach, describe, expect, it, vi } from "vitest";

const lines: Record<string, unknown>[] = [];
vi.mock("./logger", async (importOriginal) => {
  const original = await importOriginal<typeof import("./logger")>();
  const logger = original.createLogger({ level: "debug", write: (line) => lines.push(JSON.parse(line)) });
  return { ...original, logger };
});

import { getMetricsRegistry, resetMetricsForTests } from "./metrics";
import { bindRequestUser, requestLogger } from "./request-context";
import { hashUserId } from "./user-hash";
import { REQUEST_ID_HEADER, withRoute } from "./with-route";

function req(headers?: Record<string, string>, method = "GET") {
  return new Request("http://localhost/api/x", { method, headers });
}

describe("withRoute", () => {
  beforeEach(() => {
    lines.length = 0;
    resetMetricsForTests();
  });

  it("lascia passare status, body e header originali e aggiunge x-request-id", async () => {
    const handler = withRoute("x.get", async () => Response.json({ ok: 1 }, { status: 201, headers: { "x-custom": "a" } }));
    const res = await handler(req());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: 1 });
    expect(res.headers.get("x-custom")).toBe("a");
    expect(res.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines[0]).toMatchObject({ event: "http.request.completed", level: "info", status: 201, route: "x.get", method: "GET" });
  });

  it("riusa un x-request-id valido e rigenera uno non valido", async () => {
    const handler = withRoute("x.get", async () => new Response(null, { status: 204 }));
    expect((await handler(req({ [REQUEST_ID_HEADER]: "abcd-1234-efgh" }))).headers.get(REQUEST_ID_HEADER)).toBe("abcd-1234-efgh");
    expect((await handler(req({ [REQUEST_ID_HEADER]: "no spaces allowed!" }))).headers.get(REQUEST_ID_HEADER)).not.toBe(
      "no spaces allowed!"
    );
  });

  it("trasforma un'eccezione in 500 generico e la logga redatta", async () => {
    const handler = withRoute("x.get", async () => {
      throw new Error("query fallita per mario@example.com");
    });
    const res = await handler(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Errore interno" });
    expect(lines[0]).toMatchObject({ event: "http.request.failed", level: "error", status: 500 });
    expect(JSON.stringify(lines[0])).not.toContain("mario@example.com");
  });

  it("con quietOnSuccess non logga i successi ma logga i fallimenti", async () => {
    let status = 200;
    const handler = withRoute("health.ready", async () => new Response(null, { status }), { quietOnSuccess: true });
    await handler(req());
    expect(lines).toHaveLength(0);
    status = 503;
    await handler(req());
    expect(lines[0]).toMatchObject({ level: "error", status: 503 });
  });

  it("logga 429 come warn", async () => {
    await withRoute("x.get", async () => new Response(null, { status: 429 }))(req());
    expect(lines[0]).toMatchObject({ level: "warn", status: 429 });
  });

  it("aggiorna le metriche HTTP col nome statico", async () => {
    await withRoute("x.update", async () => new Response(null, { status: 404 }))(req(undefined, "PATCH"));
    const text = await getMetricsRegistry().metrics();
    expect(text).toContain('buddybudget_http_requests_total{route="x.update",method="PATCH",status_class="4xx"} 1');
  });

  it("mantiene 307 e Location su un redirect con header immutabili", async () => {
    const res = await withRoute("x.redirect", async () => Response.redirect("http://localhost/conti", 307))(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/conti");
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it("passa gli argomenti extra (params) all'handler", async () => {
    const handler = withRoute("x.get", async (_r: Request, ctx: { params: Promise<{ id: string }> }) =>
      Response.json({ id: (await ctx.params).id })
    );
    const res = await handler(req(), { params: Promise.resolve({ id: "42" }) });
    expect(await res.json()).toEqual({ id: "42" });
  });

  it("requestLogger e bindRequestUser propagano requestId e utente pseudonimizzato", async () => {
    const handler = withRoute("x.get", async () => {
      bindRequestUser("user-1");
      requestLogger().info("domain.thing.done", { count: 1 });
      return new Response(null, { status: 200 });
    });
    await handler(req({ [REQUEST_ID_HEADER]: "req-12345678" }));
    expect(lines[0]).toMatchObject({ event: "domain.thing.done", requestId: "req-12345678", user: hashUserId("user-1") });
    expect(lines[1]).toMatchObject({ event: "http.request.completed", user: hashUserId("user-1") });
    expect(JSON.stringify(lines)).not.toContain('"user-1"');
  });
});
