import { describe, expect, it } from "vitest";
import { parseAccountIncludes, parseNetWorthPeriod, parseTodayParam } from "./params";

const req = (query: string) => new Request(`http://localhost/api/x${query}`);

describe("view query parameters", () => {
  it("reads the client's day as a local midnight", () => {
    const today = parseTodayParam(req("?today=2026-02-28"));
    expect(today && [today.getFullYear(), today.getMonth(), today.getDate(), today.getHours()]).toEqual([2026, 1, 28, 0]);
    expect(parseTodayParam(req(""))).toBeUndefined();
    expect(parseTodayParam(req("?today=28/02/2026"))).toBeNull();
  });

  it("accepts only the web's chart periods", () => {
    expect(parseNetWorthPeriod(null, "3mesi")).toBe("3mesi");
    expect(parseNetWorthPeriod("1anno", "3mesi")).toBe("1anno");
    expect(parseNetWorthPeriod("ytd", "3mesi")).toBeNull();
  });

  it("parses the account extras", () => {
    expect([...(parseAccountIncludes("trend, health") ?? [])]).toEqual(["trend", "health"]);
    expect(parseAccountIncludes(null)?.size).toBe(0);
    expect(parseAccountIncludes("trend,secrets")).toBeNull();
  });
});
