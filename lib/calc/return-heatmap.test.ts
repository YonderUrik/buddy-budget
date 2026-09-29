import { describe, expect, it } from "vitest";
import { buildReturnHeatmap, groupDailyReturns, heatmapLevel, isoWeek, HEATMAP_LEVELS } from "./return-heatmap";
import type { DailyReturn } from "./returns";

function days(fromKey: string, count: number, ret: (i: number) => number | null): DailyReturn[] {
  const out: DailyReturn[] = [];
  const cursor = new Date(`${fromKey}T00:00:00`);
  for (let i = 0; i < count; i += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    const r = ret(i);
    out.push({ date: key, ret: r, gain: r === null ? 0 : r * 1000 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

describe("groupDailyReturns", () => {
  it("concatena i rendimenti dei giorni del gruppo e somma i guadagni", () => {
    const buckets = groupDailyReturns(
      [
        { date: "2026-03-01", ret: 0.1, gain: 100 },
        { date: "2026-03-02", ret: 0.1, gain: 110 },
        { date: "2026-04-01", ret: null, gain: 0 },
      ],
      "mese"
    );
    expect(buckets.get("2026-03")!.factor - 1).toBeCloseTo(0.21);
    expect(buckets.get("2026-03")!.gain).toBe(210);
    expect(buckets.get("2026-04")!.hasReturn).toBe(false);
  });
});

describe("isoWeek", () => {
  it("segue le settimane ISO anche a cavallo d'anno", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(new Date(2027, 0, 1))).toEqual({ year: 2026, week: 53 });
    expect(isoWeek(new Date(2026, 8, 29))).toEqual({ year: 2026, week: 40 });
  });
});

describe("heatmapLevel", () => {
  it("neutro sotto la soglia o senza dato, poi livelli crescenti fino al massimo", () => {
    expect(heatmapLevel(null, 0.01)).toBe(0);
    expect(heatmapLevel(0.0001, 0.01)).toBe(0);
    expect(heatmapLevel(0.002, 0.01)).toBe(1);
    expect(heatmapLevel(-0.01, 0.01)).toBe(HEATMAP_LEVELS);
    expect(heatmapLevel(0.5, 0.01)).toBe(HEATMAP_LEVELS);
  });
});

describe("buildReturnHeatmap", () => {
  const daily = days("2025-01-01", 638, (i) => (i < 10 ? null : i % 2 === 0 ? 0.01 : -0.005));

  it("per mese: un anno per riga dal più recente, 12 colonne e il totale dell'anno", () => {
    const map = buildReturnHeatmap(daily, "mese", "2026-09-30")!;
    expect(map.columns).toHaveLength(12);
    expect(map.rows.map((r) => r.label)).toEqual(["2026", "2025"]);
    expect(map.rows[0].cells[9]).toBeNull();
    expect(map.rows[1].cells[0]!.ret).not.toBeNull();
    expect(map.rows[1].total!.ret).toBeGreaterThan(0);
    expect(map.positive + map.negative).toBeLessThanOrEqual(map.counted);
  });

  it("per giorno: sette righe, un anno di settimane, niente caselle nel futuro", () => {
    const map = buildReturnHeatmap(daily, "giorno", "2026-09-30")!;
    // Qui anche il weekend si muove (come per le crypto), quindi restano tutte e sette le righe.
    expect(map.rows).toHaveLength(7);
    expect(map.columns.length).toBeGreaterThanOrEqual(52);
    // Il 30/09/2026 è un mercoledì: da giovedì in poi l'ultima colonna è vuota.
    expect(map.rows[3].cells.at(-1)).toBeNull();
    expect(map.rows[2].cells.at(-1)!.key).toBe("2026-09-30");
    expect(map.positive).toBeGreaterThan(0);
    expect(map.negative).toBeGreaterThan(0);
  });

  it("per giorno nasconde il weekend se non si è mai mosso (mercati chiusi)", () => {
    const weekdaysOnly = days("2025-01-01", 638, (i) => {
      const weekday = (new Date(2025, 0, 1 + i).getDay() + 6) % 7;
      return weekday >= 5 ? 0 : 0.01;
    });
    const map = buildReturnHeatmap(weekdaysOnly, "giorno", "2026-09-30")!;
    expect(map.rows.map((r) => r.label)).toEqual(["lun", "mar", "mer", "gio", "ven"]);
    expect(map.negative).toBe(0);
    expect(map.counted).toBe(map.positive);
  });

  it("per settimana e per anno, e nulla se non c'è mai stato niente investito", () => {
    expect(buildReturnHeatmap(daily, "settimana", "2026-09-30")!.rows[0].cells).toHaveLength(53);
    expect(buildReturnHeatmap(daily, "anno", "2026-09-30")!.columns).toEqual(["2025", "2026"]);
    expect(buildReturnHeatmap(days("2026-01-01", 5, () => null), "mese", "2026-01-05")).toBeNull();
  });
});
