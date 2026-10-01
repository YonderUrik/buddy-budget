import { describe, expect, it } from "vitest";
import {
  MOSAIC_EVENTS,
  MOSAIC_FEED_SIZE,
  MOSAIC_INITIAL_STATE,
  MOSAIC_INVEST_POINTS,
  MOSAIC_NET_POINTS,
  MOSAIC_RESET_EVERY_ROUNDS,
  advanceMosaicLive,
  applyEvent,
  buildLinePaths,
  createMosaicLive,
  debtPaidShare,
  monthSavingsRate,
  netWorth,
  pushWindow,
  seedSeries,
} from "./login-mosaic.model";

const box = { width: 200, height: 60, padX: 4, padY: 6 };
const advance = (times: number) => Array.from({ length: times }).reduce<ReturnType<typeof createMosaicLive>>((l) => advanceMosaicLive(l), createMosaicLive());

describe("netWorth", () => {
  it("somma liquidità e investimenti e toglie i debiti", () => {
    expect(netWorth(MOSAIC_INITIAL_STATE)).toBe(8740 + 3900 - 240 + 38700 - 21300);
  });
});

describe("applyEvent", () => {
  it("muove il conto corrente senza modificare lo stato di partenza", () => {
    const next = applyEvent(MOSAIC_INITIAL_STATE, MOSAIC_EVENTS[0]);
    expect(next.checking).toBeCloseTo(8740 - 86.4);
    expect(MOSAIC_INITIAL_STATE.checking).toBe(8740);
  });

  it("la rata toglie dal conto più di quanto toglie al debito (la differenza sono interessi)", () => {
    const rata = MOSAIC_EVENTS.find((e) => e.id === "rata")!;
    const next = applyEvent(MOSAIC_INITIAL_STATE, rata);
    expect(MOSAIC_INITIAL_STATE.checking - next.checking).toBe(640);
    expect(MOSAIC_INITIAL_STATE.debt - next.debt).toBe(569);
    expect(next.installment).toBe(MOSAIC_INITIAL_STATE.installment + 1);
    expect(netWorth(next)).toBe(netWorth(MOSAIC_INITIAL_STATE) - 71);
  });

  it("il PAC sposta soldi dal conto al portafoglio senza cambiare il patrimonio", () => {
    const pac = MOSAIC_EVENTS.find((e) => e.id === "pac")!;
    expect(netWorth(applyEvent(MOSAIC_INITIAL_STATE, pac))).toBe(netWorth(MOSAIC_INITIAL_STATE));
  });
});

describe("debtPaidShare / monthSavingsRate", () => {
  it("limita la quota rimborsata tra 0 e 1", () => {
    expect(debtPaidShare(0, 100)).toBe(1);
    expect(debtPaidShare(200, 100)).toBe(0);
    expect(debtPaidShare(25, 100)).toBeCloseTo(0.75);
  });
  it("non calcola il risparmio senza entrate", () => {
    expect(monthSavingsRate(0, 500)).toBeNull();
    expect(monthSavingsRate(1000, 800)).toBeCloseTo(0.2);
  });
});

describe("seedSeries / pushWindow", () => {
  it("finisce esattamente sul valore richiesto e ha la lunghezza richiesta", () => {
    const s = seedSeries(1000, 10, 0.1, 0.01);
    expect(s).toHaveLength(10);
    expect(s[9]).toBe(1000);
  });
  it("la finestra scorre mantenendo la lunghezza", () => {
    expect(pushWindow([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });
});

describe("advanceMosaicLive", () => {
  it("al primo passo arriva il primo movimento e le finestre mantengono la lunghezza", () => {
    const live = advance(1);
    expect(live.step).toBe(1);
    expect(live.feed[0].event.id).toBe(MOSAIC_EVENTS[0].id);
    expect(live.netHistory).toHaveLength(MOSAIC_NET_POINTS);
    expect(live.investHistory).toHaveLength(MOSAIC_INVEST_POINTS);
    expect(live.netHistory.at(-1)).toBe(netWorth(live.state));
  });

  it("l'elenco tiene solo gli ultimi movimenti, il più recente in cima, con chiavi uniche", () => {
    const live = advance(MOSAIC_FEED_SIZE + 3);
    expect(live.feed).toHaveLength(MOSAIC_FEED_SIZE);
    expect(live.feed[0].key).toBe(MOSAIC_FEED_SIZE + 3);
    expect(new Set(live.feed.map((f) => f.key)).size).toBe(MOSAIC_FEED_SIZE);
  });

  it("riporta la variazione del patrimonio dovuta all'ultimo passo", () => {
    const first = advance(3); // arriva lo stipendio
    expect(first.netDelta).toBeGreaterThan(2000);
  });

  it("dopo il numero di giri previsto riparte dallo stato iniziale e non diverge", () => {
    const steps = MOSAIC_EVENTS.length * MOSAIC_RESET_EVERY_ROUNDS;
    const before = advance(steps);
    const restarted = advanceMosaicLive(before);
    // Primo evento (Esselunga) applicato allo stato iniziale, non a quello accumulato.
    expect(restarted.state.checking).toBeCloseTo(MOSAIC_INITIAL_STATE.checking - 86.4);
    expect(restarted.state.installment).toBe(MOSAIC_INITIAL_STATE.installment);
    expect(restarted.step).toBe(steps + 1);
  });

  it("non muta lo stato precedente", () => {
    const live = createMosaicLive();
    advanceMosaicLive(live);
    expect(live.step).toBe(0);
    expect(live.feed).toHaveLength(0);
  });
});

describe("buildLinePaths", () => {
  it("parte da un punto e ha la stessa struttura per serie diverse della stessa lunghezza", () => {
    const a = buildLinePaths([1, 5, 3, 8], box);
    const b = buildLinePaths([9, 2, 7, 1], box);
    const shape = (d: string) => d.replace(/-?\d+(\.\d+)?/g, "#");
    expect(a.line.startsWith("M")).toBe(true);
    expect(shape(a.line)).toBe(shape(b.line));
    expect(shape(a.area)).toBe(shape(b.area));
  });

  it("il valore massimo sta in alto e il minimo in basso, dentro il margine", () => {
    const { lastY } = buildLinePaths([0, 10], box);
    expect(lastY).toBe(box.padY);
    expect(buildLinePaths([10, 0], box).lastY).toBe(box.height - box.padY);
  });

  it("una serie piatta non produce NaN", () => {
    expect(buildLinePaths([5, 5, 5], box).line).not.toContain("NaN");
  });
});
