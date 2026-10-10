import { describe, expect, it } from "vitest";
import { clampStep, initialStepFlow, stepFlowReducer } from "./step-flow.state";

describe("stepFlowReducer", () => {
  const reduce = stepFlowReducer(3);

  it("avanza e torna indietro segnando il verso", () => {
    const first = initialStepFlow(3);
    const second = reduce(first, { type: "next" });
    expect(second).toEqual({ index: 1, direction: 1 });
    expect(reduce(second, { type: "back" })).toEqual({ index: 0, direction: -1 });
  });

  it("si ferma agli estremi senza cambiare lo stato", () => {
    const first = initialStepFlow(3);
    expect(reduce(first, { type: "back" })).toBe(first);
    const last = { index: 2, direction: 1 as const };
    expect(reduce(last, { type: "next" })).toBe(last);
  });

  it("goTo ricava il verso e rispetta i limiti", () => {
    expect(reduce(initialStepFlow(3), { type: "goTo", index: 2 })).toEqual({ index: 2, direction: 1 });
    expect(reduce({ index: 2, direction: 1 }, { type: "goTo", index: -5 })).toEqual({ index: 0, direction: -1 });
  });

  it("clampStep porta l'indice nei limiti", () => {
    expect(clampStep(9, 3)).toBe(2);
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(0, 0)).toBe(0);
  });
});
