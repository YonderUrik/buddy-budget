import { describe, expect, it } from "vitest";
import { canUndo, decide, initDeck, reconcileDeck, skip, takePending, undo } from "./swipe-deck";

const choice = { categoryId: "c1", remember: false, excludedPercentage: 0, action: "conferma" as const };

describe("swipe-deck", () => {
  it("decide toglie la carta in cima e registra la scelta", () => {
    const state = decide(initDeck(["a", "b"]), choice);
    expect(state.queue).toEqual(["b"]);
    expect(state.pending).toEqual([{ ...choice, groupKey: "a" }]);
  });

  it("skip manda la carta in fondo e undo la riporta in cima", () => {
    const skipped = skip(initDeck(["a", "b", "c"]));
    expect(skipped.queue).toEqual(["b", "c", "a"]);
    expect(undo(skipped).queue).toEqual(["a", "b", "c"]);
  });

  it("con una sola carta skip non fa nulla", () => {
    const state = initDeck(["a"]);
    expect(skip(state)).toBe(state);
  });

  it("undo annulla una scelta non ancora salvata", () => {
    const state = undo(decide(initDeck(["a", "b"]), choice));
    expect(state.queue).toEqual(["a", "b"]);
    expect(state.pending).toEqual([]);
  });

  it("dopo il salvataggio la scelta non è più annullabile", () => {
    const decided = decide(initDeck(["a", "b"]), choice);
    const { state, decisions } = takePending(decided);
    expect(decisions).toHaveLength(1);
    expect(state.pending).toEqual([]);
    expect(canUndo(state)).toBe(false);
    expect(undo(state)).toBe(state);
  });

  it("reconcile toglie le carte sparite e aggiunge solo quelle mai viste", () => {
    const decided = decide(initDeck(["a", "b"]), choice);
    // il server ha ancora «a» (scelta non salvata) e porta una carta nuova «c»
    const state = reconcileDeck(decided, ["a", "b", "c"]);
    expect(state.queue).toEqual(["b", "c"]);
    expect(reconcileDeck(state, ["b", "c"]).queue).toEqual(["b", "c"]);
    expect(reconcileDeck(state, ["c"]).queue).toEqual(["c"]);
  });
});
