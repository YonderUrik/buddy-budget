import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { orderStatementFiles, validateImportFiles } from "./batch";
import { parseBrokerStatement } from "./parse-statement";
import { brokerSeries } from "./__fixtures__/broker-series";
const file = (name: string, text: string) => ({ name, text, parsed: parseBrokerStatement(text, "2026-10-05") });
describe("multi-file statement queue", () => {
  it("orders each broker history chronologically, with IBKR before DEGIRO", () => {
    const degiro = file("Account.csv", readFileSync(new URL("./__fixtures__/degiro-account.csv", import.meta.url), "utf8"));
    const first = file("2023.csv", brokerSeries(2023)), second = file("2024.csv", brokerSeries(2024));
    const selection = [second, degiro, first];
    expect(orderStatementFiles(selection).map((f) => f.name)).toEqual(["2023.csv", "2024.csv", "Account.csv"]);
    expect(selection[0]).toBe(second);
  });
  it("keeps duplicate files as separate idempotent requests and orders YTD extensions last", () => {
    const first = file("first.csv", brokerSeries(2023));
    const extended = structuredClone(first); extended.name = "extension.csv"; extended.parsed.statement!.to = "2024-01-01";
    expect(orderStatementFiles([extended, first, first]).map((f) => f.name)).toEqual(["first.csv", "first.csv", "extension.csv"]);
  });
  it("rejects invalid statements before starting the queue and identifies the file", () => {
    const bad = file("bad.csv", brokerSeries(2023));
    bad.parsed.issues.push({ line: 1, section: "Cash", severity: "error", message: "Invalid balance" });
    expect(() => orderStatementFiles([bad])).toThrow("bad.csv: Invalid balance");
  });
  it("bounds selection count, individual size and aggregate size", () => {
    expect(() => validateImportFiles(Array.from({ length: 21 }, () => ({ size: 1 })))).toThrow(/20/);
    expect(() => validateImportFiles([{ size: 6 * 1024 * 1024 }])).toThrow(/5 MB/);
    expect(() => validateImportFiles(Array.from({ length: 6 }, () => ({ size: 5 * 1024 * 1024 })))).toThrow(/25 MB/);
    expect(() => validateImportFiles([{ size: 100 }])).not.toThrow();
  });
});
