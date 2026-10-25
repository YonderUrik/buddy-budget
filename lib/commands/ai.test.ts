import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { interpretWithModel } = await import("./ai");
const { checkSentence } = await import("./guard");

const reply = (content: unknown) => vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] })));
const options = (fetchImpl: typeof fetch) => ({ apiKey: "k", model: "m", language: "it" as const, today: "2026-10-24", fetchImpl });

describe("interpretWithModel", () => {
  it("returns the draft and sends only the sentence, the date and the language", async () => {
    const fetchImpl = reply({ kind: "acquisto", quantity: 3, price: 50, amount: null, date: "2026-10-24", subject: "Apple" });
    const draft = await interpretWithModel("ho preso altre tre Apple stamattina a cinquanta", options(fetchImpl as unknown as typeof fetch));
    expect(draft).toMatchObject({ kind: "acquisto", quantity: 3, price: 50, subject: "Apple", source: "ai" });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.parse(body.messages[1].content)).toEqual({ today: "2026-10-24", appLanguage: "it", sentence: "ho preso altre tre Apple stamattina a cinquanta" });
    expect(body.provider).toMatchObject({ zdr: true, data_collection: "deny" });
    expect(body.max_tokens).toBeLessThanOrEqual(160);
  });

  it("refuses answers outside the schema and cleans what it keeps", async () => {
    await expect(interpretWithModel("x", options(reply("Sure! Here is a poem…") as unknown as typeof fetch))).rejects.toThrow();
    await expect(interpretWithModel("x", options(reply({ kind: "bonifico_a_tutti" }) as unknown as typeof fetch))).rejects.toThrow();
    await expect(interpretWithModel("x", options(reply({ kind: "spesa", amount: -5 }) as unknown as typeof fetch))).rejects.toThrow();
    const draft = await interpretWithModel("x", options(reply({ kind: "spesa", amount: 5, date: "2031-01-01", subject: "<b>Bar</b> https://evil.example" }) as unknown as typeof fetch));
    expect(draft).toMatchObject({ date: "2026-10-24", subject: "bBar/b" });
    expect(await interpretWithModel("x", options(reply({ kind: null }) as unknown as typeof fetch))).toBeNull();
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
