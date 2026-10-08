import { describe, expect, it, vi, afterEach } from "vitest";
import { readTable, validateOutcomes } from "./contract";
import { executeParser } from "./sandbox";
import { generateParser, inputForModel } from "./generate";
import { seal, unseal } from "./crypto";
const csv = 'Date;Amount;Description\n2024-01-01;-12,50;Shop';
const table = readTable(csv);
const cash = { row: 0, kind: "cash", date: "2024-01-01", amount: -12.5, currency: "EUR", description: "Shop", transfer: false };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("personal CSV validation and sandbox", () => {
  it("reads quoted cells and refuses malformed, empty, oversized or non-UTF8 files", () => {
    expect(readTable('a,b\n"x,y",z').rows).toEqual([["x,y", "z"]]);
    for (const input of ['', 'a,b\nx', 'a,b\n"x,y', 'a,b\nx,\uFFFD', 'a,b\n' + 'x,y\n'.repeat(50001)]) expect(() => readTable(input)).toThrow();
  });
  it("accepts 50,000 rows and files larger than the previous 5 MB limit", () => {
    const big = readTable('Date,Amount,Description\n' + Array.from({ length: 50000 }, () => '2024-01-01,1,' + 'x'.repeat(110)).join('\n'));
    expect(big.rows).toHaveLength(50000);
    expect(inputForModel(big).rows).toHaveLength(50000);
    expect(inputForModel(big).rows[49999][2]).toHaveLength(110);
  });
  it("requires exactly one outcome per row and validates real dates and amounts", () => {
    expect(validateOutcomes([cash], table)).toEqual([cash]);
    expect(validateOutcomes([{ ...cash, amount: 0 }], table)[0]).toMatchObject({ amount: 0 });
    for (const output of [[], [cash, cash], [{ ...cash, row: 1 }], [{ ...cash, date: "2024-02-30" }], [{ ...cash, date: "2099-01-01" }], [{ ...cash, amount: Infinity }]]) expect(() => validateOutcomes(output, table)).toThrow();
  });
  it("runs a declarative mapping and refuses malformed financial numbers", async () => {
    const parser = { kind: "mapping" as const, dateColumn: 0, amountColumn: 1, descriptionColumn: 2, currencyColumn: null, currency: "EUR", decimal: "," as const, dateOrder: "ymd" as const };
    expect(await executeParser(parser, table)).toEqual([cash]);
    await expect(executeParser(parser, readTable(csv.replace('-12,50', 'junk12')))).rejects.toThrow();
  });
  it("runs JavaScript without host APIs", async () => {
    const code = `function(t) { if (typeof process !== 'undefined' || typeof fetch !== 'undefined' || typeof require !== 'undefined') throw Error('host'); return [{row:0, kind:'cash',date:t.rows[0][0],amount:-12.5,currency:'EUR',description:t.rows[0][2],transfer:false}]; }`;
    expect(await executeParser({ kind: "javascript", code }, table)).toEqual([cash]);
  });
  it("interrupts loops and isolates each invocation", async () => {
    await expect(executeParser({ kind: "javascript", code: "function(){while(true){}}" }, table)).rejects.toThrow();
    expect(await executeParser({ kind: "javascript", code: `function(){return ${JSON.stringify([cash])}}` }, table)).toEqual([cash]);
  }, 15000);
  it("hard-kills a noninterruptible regex and rejects oversized allocations", async () => {
    await expect(executeParser({ kind: "javascript", code: "function(){ /^(a+)+$/.test('a'.repeat(100)+'!'); return []; }" }, table)).rejects.toThrow();
    await expect(executeParser({ kind: "javascript", code: "function(){ return new Array(100000000).fill('x'); }" }, table)).rejects.toThrow();
  }, 20000);
  it("binds encryption to the owner and detects tampering", () => {
    vi.stubEnv("PERSONAL_CSV_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const sealed = seal(csv, "one"); expect(sealed).not.toContain("Shop"); expect(unseal(sealed, "one")).toBe(csv);
    expect(() => unseal(sealed, "two")).toThrow();
    expect(() => unseal(sealed.slice(0, -4) + 'AAAA', "one")).toThrow();
  });
  it("sends all rows without truncation and redacts identifiers; requests a configurable model with ZDR", async () => {
    const sample = inputForModel(readTable('A,B\n' + Array.from({ length: 100 }, () => 'IT60X0542811101000000123456,test@example.test').join('\n')));
    expect(sample.rows).toHaveLength(100); expect(JSON.stringify(sample)).not.toContain('test@example.test'); expect(JSON.stringify(sample)).not.toContain('IT60X');
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key"); vi.stubEnv("OPENROUTER_MODEL", "configured/model");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ kind: "javascript", code: "function(){return []}" }) } }] })); vi.stubGlobal("fetch", fetcher);
    await generateParser(table);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model).toBe("configured/model"); expect(body.provider).toMatchObject({ zdr: true, data_collection: "deny" });
    expect(body.max_tokens).toBeLessThanOrEqual(32768);
  });
  it("reserves output for DeepSeek and rejects truncated completions explicitly", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key"); vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4.1-flash");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: "length", message: { content: null } }] })); vi.stubGlobal("fetch", fetcher);
    await expect(generateParser(table)).rejects.toThrow("budget di generazione");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.reasoning).toEqual({ enabled: false, exclude: true });
    expect(body.provider.zdr).toBe(true);
    expect(body.max_tokens).toBe(32768);
  });

});
