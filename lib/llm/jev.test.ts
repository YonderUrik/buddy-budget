import { describe, expect, it, vi } from "vitest";
import { buildCategorizationRequest, classifyWithJev, parseDecisions, type JevRequestInput } from "./jev";

const input: JevRequestInput = {
  merchants: [
    { id: "a", name: "Esselunga", mcc: "5411", isIncome: false },
    { id: "b", name: "Stipendio Acme", mcc: null, isIncome: true },
  ],
  categories: [
    { name: "Spesa", type: "voluta" },
    { name: "Affitto", type: "dovuta" },
    { name: "Stipendio", type: "entrata" },
  ],
  examples: [{ name: "Coop", category: "Spesa" }],
};

describe("buildCategorizationRequest", () => {
  it("offre solo le categorie compatibili con la direzione", () => {
    const body = buildCategorizationRequest(input) as { questions: Record<string, { criteria: object }> };
    expect(Object.keys(body.questions.m0.criteria)).toEqual(["Spesa", "Affitto"]);
    expect(Object.keys(body.questions.m1.criteria)).toEqual(["Stipendio"]);
  });

  it("non manda importi né identificativi e pretende ZDR", () => {
    const body = buildCategorizationRequest(input);
    expect(body.provider).toEqual({ zdr: true, data_collection: "deny" });
    expect(Object.keys(body.state.merchants[0]).sort()).toEqual(["id", "isIncome", "mcc", "name"]);
  });
});

describe("parseDecisions", () => {
  it("scarta le categorie fuori dalla lista ammessa", () => {
    const decisions = parseDecisions(
      {
        answers: {
          m0: { type: "choice", choice: "Stipendio", confidence: 0.9 },
          m1: { type: "choice", choice: "Stipendio", confidence: 0.8, probabilities: { Stipendio: 0.8 } },
        },
      },
      input
    );
    expect(decisions).toEqual([{ id: "b", categoryName: "Stipendio", confidence: 0.8, probabilities: { Stipendio: 0.8 } }]);
  });
});

describe("classifyWithJev", () => {
  it("restituisce decisioni, token e costo", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          answers: { m0: { type: "choice", choice: "Spesa", confidence: 0.97, probabilities: { Spesa: 0.97, Affitto: 0.03 } } },
          usage: { input_tokens: 500, output_tokens: 0, cost: 0.00002 },
        })
      )
    ) as unknown as typeof fetch;
    const result = await classifyWithJev(input, { apiKey: "k", fetchImpl });
    expect(result.decisions[0]).toMatchObject({ id: "a", categoryName: "Spesa", confidence: 0.97 });
    expect(result.inputTokens).toBe(500);
    expect(result.costUsd).toBe(0.00002);
  });

  it("lancia se il servizio risponde con un errore", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 502 })) as unknown as typeof fetch;
    await expect(classifyWithJev(input, { apiKey: "k", fetchImpl })).rejects.toThrow("HTTP 502");
  });
});
