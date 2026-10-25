import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { interpretWithModel } = await import("./ai");
const { checkSentence } = await import("./guard");

const reply = (content: unknown) => vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] })));
const options = (fetchImpl: typeof fetch) => ({ apiKey: "k", model: "m", language: "it" as const, today: "2026-10-24", fetchImpl });

describe("interpretWithModel", () => {
  it("returns the draft and sends only the sentence, the date and the language", async () => {
    const fetchImpl = reply({ kind: "acquisto", quantity: 3, price: 50, amount: null, date: "2026-10-24", subject: "Apple" });
    const read = await interpretWithModel("ho preso altre tre Apple stamattina a cinquanta", options(fetchImpl as unknown as typeof fetch));
    expect(read).toMatchObject({ type: "draft", draft: { kind: "acquisto", quantity: 3, price: 50, subject: "Apple", source: "ai" } });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.parse(body.messages[1].content)).toEqual({ today: "2026-10-24", appLanguage: "it", sentence: "ho preso altre tre Apple stamattina a cinquanta" });
    expect(body.provider).toMatchObject({ zdr: true, data_collection: "deny" });
    expect(body.max_tokens).toBeLessThanOrEqual(160);
  });

  it("refuses answers outside the schema and cleans what it keeps", async () => {
    await expect(interpretWithModel("x", options(reply("Sure! Here is a poem…") as unknown as typeof fetch))).rejects.toThrow();
    await expect(interpretWithModel("x", options(reply({ kind: "bonifico_a_tutti" }) as unknown as typeof fetch))).rejects.toThrow();
    await expect(interpretWithModel("x", options(reply({ kind: "spesa", amount: -5 }) as unknown as typeof fetch))).rejects.toThrow();
    const read = await interpretWithModel("x", options(reply({ kind: "spesa", amount: 5, date: "2031-01-01", subject: "<b>Bar</b> https://evil.example" }) as unknown as typeof fetch));
    expect(read).toMatchObject({ type: "draft", draft: { date: "2026-10-24", subject: "bBar/b" } });
    expect(await interpretWithModel("x", options(reply({ kind: null }) as unknown as typeof fetch))).toBeNull();
  });

  it("turns a question into one the server answers, with a period the app holds and folded words", async () => {
    const ask = (question: unknown) => interpretWithModel("x", options(reply({ question }) as unknown as typeof fetch));
    expect(await ask({ type: "totale", direction: "uscite", subject: "Ristoranti", year: 2025, month: 7 })).toEqual({
      type: "question",
      question: { kind: "totale", direction: "uscite", subject: "ristoranti", period: { kind: "mese", from: "2025-07-01", to: "2025-07-31" }, language: "it" },
    });
    // No period: this year; a month without a year (or with an impossible one): the last one with that name.
    expect(await ask({ type: "totale", direction: "entrate", subject: null })).toMatchObject({ question: { direction: "entrate", subject: "", period: { kind: "anno", from: "2026-01-01" } } });
    expect(await ask({ type: "totale", direction: "uscite", month: 12 })).toMatchObject({ question: { period: { kind: "mese", from: "2025-12-01" } } });
    expect(await ask({ type: "totale", direction: "uscite", year: 2031, month: 12 })).toMatchObject({ question: { period: { kind: "mese", from: "2025-12-01" } } });
    expect(await ask({ type: "totale", direction: "uscite", year: 1066 })).toMatchObject({ question: { period: { kind: "anno", from: "2026-01-01" } } });
    expect(await ask({ type: "patrimonio", date: "2025-12-31" })).toMatchObject({ question: { kind: "patrimonio", date: "2025-12-31" } });
    expect(await ask({ type: "patrimonio", date: "2027-01-01" })).toMatchObject({ question: { kind: "patrimonio", date: null } });
    expect(await ask({ type: "saldo", subject: "Conto <Fineco>" })).toMatchObject({ question: { kind: "saldo", subject: "conto fineco" } });
    expect(await ask({ type: "rata" })).toEqual({ type: "question", question: { kind: "rata", language: "it" } });
    await expect(ask({ type: "consiglio", subject: "cosa compro?" })).rejects.toThrow();
  });

  it("prefers the record when the model returns both", async () => {
    const read = await interpretWithModel("x", options(reply({ kind: "spesa", amount: 12, subject: "Bar", question: { type: "totale", direction: "uscite" } }) as unknown as typeof fetch));
    expect(read).toMatchObject({ type: "draft", draft: { kind: "spesa", amount: 12 } });
  });
});

describe("checkSentence", () => {
  it("lets through only short sentences with words", () => {
    expect(checkSentence("comprato tre Apple")).toBeNull();
    expect(checkSentence("ok")).toBe("empty");
    expect(checkSentence("12 34 56")).toBe("no_letters");
    expect(checkSentence("a".repeat(161))).toBe("too_long");
  });
});
