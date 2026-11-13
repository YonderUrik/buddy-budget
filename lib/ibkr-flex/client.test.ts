import { describe, expect, it, vi } from "vitest";
import { flexReport } from "@/lib/investments/import/__fixtures__/ibkr-flex";
import { fetchFlexReport, getFlexStatement, IbkrFlexError, readEnvelope, sendFlexRequest, type IbkrFlexClientDeps } from "./client";
import { acquireSendRequestSlot, RateLimitExceededError, type RateWindowStore } from "./rate-limit";

const CREDENTIALS = { token: "123456789012345678901234", queryId: "987654" };
const ok = (reference = "1234567890") => `<FlexStatementResponse timestamp="06 November, 2026 08:00 AM EST"><Status>Success</Status><ReferenceCode>${reference}</ReferenceCode><Url>https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url></FlexStatementResponse>`;
const fail = (code: number, message = "x") => `<FlexStatementResponse timestamp="x"><Status>Fail</Status><ErrorCode>${code}</ErrorCode><ErrorMessage>${message}</ErrorMessage></FlexStatementResponse>`;
const warn = (code: number) => `<FlexStatementResponse timestamp="x"><Status>Warn</Status><ErrorCode>${code}</ErrorCode><ErrorMessage>Statement generation in progress. Please try again shortly.</ErrorMessage></FlexStatementResponse>`;

/** In-memory counters with the same semantics as the Redis store. */
function memoryStore(): RateWindowStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return { counts, increment: async (key) => { const next = (counts.get(key) ?? 0) + 1; counts.set(key, next); return next; } };
}

/** A fake clock advanced by `sleep`, so polling and backoff run instantly. */
function harness(responses: (string | Error | Response)[]) {
  let clock = Date.UTC(2026, 10, 6, 8, 0, 0);
  const urls: URL[] = [];
  const fetchMock = vi.fn<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>(async (input) => {
    urls.push(new URL(String(input)));
    const next = responses.shift();
    if (next === undefined) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next instanceof Response ? next : new Response(next, { status: 200, headers: { "content-type": "text/xml" } });
  });
  const deps: IbkrFlexClientDeps = { fetch: fetchMock as unknown as typeof fetch, now: () => clock, sleep: async (ms) => { clock += ms; }, rateStore: memoryStore() };
  return { deps, urls, fetchMock, elapsed: () => clock - Date.UTC(2026, 10, 6, 8, 0, 0) };
}

describe("readEnvelope", () => {
  it("reads success, failure and the report itself", () => {
    expect(readEnvelope(ok("42"))).toEqual({ status: "success", referenceCode: "42" });
    expect(readEnvelope(fail(1012))).toEqual({ status: "fail", code: 1012 });
    expect(readEnvelope(flexReport())).toMatchObject({ status: "report" });
    expect(() => readEnvelope("<html>maintenance</html>")).toThrow(IbkrFlexError);
    expect(() => readEnvelope("not xml <")).toThrow(expect.objectContaining({ reason: "invalid_response" }));
  });
});

describe("fetchFlexReport", () => {
  it("generates a report, waits while it is in progress and returns the XML", async () => {
    const { deps, urls } = harness([ok("555"), warn(1019), warn(1019), flexReport()]);
    const xml = await fetchFlexReport(CREDENTIALS, { from: "2026-01-01", to: "2026-11-05" }, deps);
    expect(xml).toContain("<FlexQueryResponse");
    expect(urls[0].pathname).toBe("/AccountManagement/FlexWebService/SendRequest");
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({ t: CREDENTIALS.token, q: "987654", v: "3", fd: "20260101", td: "20261105" });
    expect(urls.slice(1).every((url) => url.pathname.endsWith("/GetStatement") && url.searchParams.get("q") === "555")).toBe(true);
  });

  it("omits the period when the query's own period should be used", async () => {
    const { deps, urls } = harness([ok(), flexReport()]);
    await fetchFlexReport(CREDENTIALS, null, deps);
    expect(urls[0].searchParams.has("fd")).toBe(false);
  });

  it.each([[1012, "token_expired"], [1015, "token_invalid"], [1014, "query_invalid"], [1013, "ip_restricted"], [1011, "account_inactive"]] as const)("maps code %i to %s without retrying", async (code, reason) => {
    const { deps, fetchMock } = harness([fail(code)]);
    await expect(sendFlexRequest(CREDENTIALS, null, deps)).rejects.toMatchObject({ reason, code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures (too many requests, server busy, network) with backoff", async () => {
    const { deps, fetchMock, elapsed } = harness([fail(1018), new TypeError("fetch failed"), fail(1009), ok("9")]);
    expect(await sendFlexRequest(CREDENTIALS, null, deps)).toBe("9");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(elapsed()).toBeGreaterThan(2_000 * 0.8 + 4_000 * 0.8 + 8_000 * 0.8 - 1);
  });

  it("gives up after a bounded number of attempts", async () => {
    const { deps, fetchMock } = harness([fail(1018), fail(1018), fail(1018), fail(1018), fail(1018)]);
    await expect(sendFlexRequest(CREDENTIALS, null, deps)).rejects.toMatchObject({ reason: "rate_limited" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("stops polling after the deadline when the report never becomes ready", async () => {
    const { deps } = harness(Array.from({ length: 60 }, () => warn(1019)));
    await expect(getFlexStatement(CREDENTIALS, "1", deps)).rejects.toMatchObject({ reason: "timeout" });
  });

  it("refuses malformed replies and HTTP errors, and never puts the token in the error", async () => {
    const { deps } = harness(["<FlexStatementResponse><Status>Success</Status><ReferenceCode>abc</ReferenceCode></FlexStatementResponse>"]);
    const error = await sendFlexRequest(CREDENTIALS, null, deps).catch((e: unknown) => e);
    expect(error).toMatchObject({ reason: "invalid_response" });
    expect(String((error as Error).message) + JSON.stringify(error)).not.toContain(CREDENTIALS.token);
    const forbidden = harness([new Response("no", { status: 403 })]);
    await expect(sendFlexRequest(CREDENTIALS, null, forbidden.deps)).rejects.toMatchObject({ reason: "invalid_response" });
  });

  it("does not follow a redirect off IBKR's hosts", async () => {
    const { deps, fetchMock } = harness([new Response(null, { status: 302, headers: { location: "https://example.com/steal" } })]);
    await expect(sendFlexRequest(CREDENTIALS, null, deps)).rejects.toMatchObject({ reason: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends a generic User-Agent", async () => {
    const { deps, fetchMock } = harness([ok()]);
    await sendFlexRequest(CREDENTIALS, null, deps);
    const init = fetchMock.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^BuddyBudget/);
  });
});

describe("acquireSendRequestSlot", () => {
  it("allows one SendRequest per second and ten per minute, shared through the store", async () => {
    const store = memoryStore();
    let clock = Date.UTC(2026, 10, 6, 8, 0, 0, 0);
    const deps = { store, now: () => clock, sleep: async (ms: number) => { clock += ms; } };
    const times: number[] = [];
    for (let i = 0; i < 12; i++) { await acquireSendRequestSlot("scope", deps); times.push(clock); }
    for (let i = 1; i < times.length; i++) expect(Math.floor(times[i] / 1000)).toBeGreaterThan(Math.floor(times[i - 1] / 1000));
    expect(times.filter((t) => Math.floor(t / 60_000) === Math.floor(times[0] / 60_000))).toHaveLength(10);
    expect(Math.floor(times[10] / 60_000)).toBe(Math.floor(times[0] / 60_000) + 1);
  });

  it("keeps separate limits per token scope and gives up past the maximum wait", async () => {
    const store = memoryStore();
    const clock = Date.UTC(2026, 10, 6, 8, 0, 0, 0);
    await acquireSendRequestSlot("a", { store, now: () => clock });
    await acquireSendRequestSlot("b", { store, now: () => clock });
    await expect(acquireSendRequestSlot("a", { store, now: () => clock, sleep: async () => {}, maxWaitMs: 0 })).rejects.toBeInstanceOf(RateLimitExceededError);
  });
});
