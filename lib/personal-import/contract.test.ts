import { describe, expect, it, vi, afterEach } from "vitest";
import { readRawFile, validateOutcomes } from "./contract";
import { executeParser } from "./sandbox";
import { generateParser, inputForModel, messagesFor } from "./generate";
import { LADDER_STEPS, type GenerationRequest } from "./analysis";
import type { ModelHints } from "./hints";
import { seal, unseal } from "./crypto";
const csv = 'Date;Amount;Description\n2024-01-01;-12,50;Shop';
const table = { rawCsv: csv, delimiter: ";", headers: ["Date", "Amount", "Description"], rows: [["2024-01-01", "-12,50", "Shop"]] };
const cash = { row: 0, kind: "cash", date: "2024-01-01", amount: -12.5, currency: "EUR", description: "Shop", transfer: false };
const hints: ModelHints = { defaultCurrency: "EUR", today: "2026-10-31", dateOrderHint: "dmy", fileKind: "bank" };
const stepRequest = (i: 0 | 1 | 2, extra: Partial<GenerationRequest> = {}): GenerationRequest => ({ step: LADDER_STEPS[i].step, reasoning: LADDER_STEPS[i].reasoning, reasoningTokens: LADDER_STEPS[i].reasoningTokens, maxTokens: LADDER_STEPS[i].maxTokens, timeoutMs: LADDER_STEPS[i].timeoutMs, feedback: [], ...extra });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("personal CSV validation and sandbox", () => {
  it("preserves quoted text and refuses only empty or over-limit files", () => {
    expect(readRawFile('a,b\n"x,y",z').rows).toEqual([["a,b"], ['"x,y",z']]);
    for (const input of ['', 'a,b\n' + 'x,y\n'.repeat(50001)]) expect(() => readRawFile(input)).toThrow();
  });
  it("passes preambles, uneven sections and unusual quoting to the AI without losing records", () => {
    const document = '"Account report"\n"contact@example.test"\nDate;Amount;Description\n2024-01-01;12;Deposit\nSummary\nTotal;12';
    const parsed = readRawFile(document);
    expect(readRawFile("2024-01-01,12,Deposit").rows).toEqual([["2024-01-01,12,Deposit"]]);
    expect(parsed.layout).toBe("document"); expect(parsed.delimiter).toBe("");
    expect(parsed.rows).toHaveLength(6); expect(parsed.rows[2]).toEqual(["Date;Amount;Description"]);
    expect(parsed.sourceLines).toEqual([1, 2, 3, 4, 5, 6]);
    expect(inputForModel(parsed, "Example Bank", hints)).toMatchObject({ sourceName: "Example Bank", rawCsv: document });
    expect(Object.keys(inputForModel(parsed, undefined, hints))).toEqual(["sourceName", "hints", "rawCsv"]);
    expect(readRawFile('Intro\na,b\nx').rows).toEqual([["Intro"], ["a,b"], ["x"]]);
    expect(readRawFile('a,b\n"x,y').rawCsv).toBe('a,b\n"x,y');
  });
  it("accepts 50,000 rows and files larger than the previous 5 MB limit", () => {
    const big = readRawFile(Array.from({ length: 50000 }, () => '2024-01-01,1,' + 'x'.repeat(110)).join('\n'));
    expect(big.rows).toHaveLength(50000);
    expect(inputForModel(big, undefined, hints).rawCsv).toBe(big.rawCsv);
    expect(big.rows[49999][0]).toContain("x".repeat(110));
  });
  it("requires exactly one outcome per row and validates real dates and amounts", () => {
    expect(validateOutcomes([cash], table)).toEqual([cash]);
    expect(validateOutcomes([{ ...cash, amount: 0 }], table)[0]).toMatchObject({ amount: 0 });
    for (const output of [[], [cash, cash], [{ ...cash, row: 1 }], [{ ...cash, date: "2024-02-30" }], [{ ...cash, date: "2099-01-01" }], [{ ...cash, amount: Infinity }]]) expect(() => validateOutcomes(output, table)).toThrow();
  });
  it("runs a declarative mapping and refuses malformed financial numbers", async () => {
    const parser = { kind: "mapping" as const, dateColumn: 0, amountColumn: 1, descriptionColumn: 2, currencyColumn: null, currency: "EUR", decimal: "," as const, dateOrder: "ymd" as const };
    expect(await executeParser(parser, table)).toEqual([cash]);
    await expect(executeParser(parser, readRawFile(csv.replace('-12,50', 'junk12')))).rejects.toThrow();
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
  it("sends the original raw file unchanged and requests a configurable model with ZDR", async () => {
    const sample = inputForModel(readRawFile('A,B\n' + Array.from({ length: 100 }, () => 'IT60X0542811101000000123456,test@example.test').join('\n')), undefined, hints);
    expect(sample.rawCsv?.split('\n')).toHaveLength(101); expect(sample.rawCsv).toContain('test@example.test'); expect(sample.rawCsv).toContain('IT60X');
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key"); vi.stubEnv("OPENROUTER_MODEL", "configured/model");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ kind: "javascript", code: "function(){return []}", metadata: { version: 1, institution: { name: "Example Bank", evidence: "user" }, delimiter: ";", columns: [] } }) } }] })); vi.stubGlobal("fetch", fetcher);
    await generateParser(table, { sourceName: "Example Bank", hints, request: stepRequest(0) });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(JSON.parse(body.messages[1].content)).toEqual({ sourceName: "Example Bank", hints, rawCsv: csv });
    expect(body.model).toBe("configured/model"); expect(body.provider).toMatchObject({ zdr: true, data_collection: "deny" });
    expect(body.max_tokens).toBeLessThanOrEqual(32768);
  });
  it("reserves output for DeepSeek and rejects truncated completions explicitly", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key"); vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4.1-flash");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: "length", message: { content: null } }] })); vi.stubGlobal("fetch", fetcher);
    await expect(generateParser(table, { hints, request: stepRequest(0) })).rejects.toThrow("budget di generazione");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.reasoning).toEqual({ enabled: false, exclude: true });
    expect(body.provider.zdr).toBe(true);
    expect(body.max_tokens).toBe(32768);
  });
  it("turns capped reasoning on with a 128k budget only on the last step", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key"); vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4.1-flash");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "not json" } }] })); vi.stubGlobal("fetch", fetcher);
    await expect(generateParser(table, { hints, request: stepRequest(2) })).rejects.toThrow("non è un JSON valido");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.reasoning).toEqual({ max_tokens: 32768, exclude: true });
    expect(body.max_tokens).toBe(131072);
    expect(body.messages[0].content).toContain("at most 32000 characters");
  });
  it("says exactly what is wrong with an unusable answer, without values", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key"); vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4.1-flash");
    const answer = (content: unknown) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] })));
    answer({ kind: "javascript", code: "x".repeat(32001), metadata: {} });
    await expect(generateParser(table, { hints, request: stepRequest(0) })).rejects.toThrow("supera 32000 caratteri (32001)");
    answer({ kind: "javascript", code: "function(){}", metadata: { version: 1 } });
    await expect(generateParser(table, { hints, request: stepRequest(0) })).rejects.toThrow(/formato richiesto: .*institution/);
  });
  it("puts the source's old parser and each rejection after the file, with the failing lines", () => {
    const parser = { kind: "javascript" as const, code: "function(){return []}" };
    const messages = messagesFor(table, "Banca", hints, stepRequest(1, { reference: { parser, failure: "Parser non deterministico" }, feedback: [{ parser, reason: "unrecognized_rows", lines: [{ row: 3, text: "2024;?;x" }], moreLines: 7, columns: [{ index: 4, name: "Saldo" }] }] }));
    expect(messages.map(m => m.role)).toEqual(["system", "user", "user", "assistant", "user"]);
    expect(messages[0].content).toContain("ZERO error outcomes");
    expect(messages[2].content).toContain("changed its layout");
    expect(messages[3].content).toBe(JSON.stringify(parser));
    expect(messages[4].content).toContain("3: 2024;?;x"); expect(messages[4].content).toContain("7 more lines"); expect(messages[4].content).toContain("4: Saldo");
  });

});
