import { describe, expect, it } from "vitest";
import { cleanAnalysis, type AnalysisQuery } from "@/lib/commands/analysis";
import { comparisonSpan, runAnalysis, type AnalysisCategory, type AnalysisRow, type ResolvedFilters } from "./analysis-engine";

const TODAY = "2026-11-03";
const categories = new Map<string, AnalysisCategory>([
  ["spesa", { name: "Spesa", type: "dovuta", isFallback: false }],
  ["ristoranti", { name: "Ristoranti", type: "voluta", isFallback: false }],
  ["stipendio", { name: "Stipendio", type: "entrata", isFallback: false }],
  ["giroconti", { name: "Trasferimenti tra i miei conti", type: "trasferimento", isFallback: false }],
]);
const context = { categories, accounts: new Map([["fineco", "Fineco"], ["revolut", "Revolut"]]), firstDay: "2026-01-02", today: TODAY, textFrom: "2024-11-01" };
const noFilters: ResolvedFilters = { text: "", categoryId: null, group: null, accountId: null, min: null, max: null, days: null };

let id = 0;
const row = (date: string, amount: number, categoryId = "spesa", description = "Esselunga", accountId = "fineco"): AnalysisRow => ({ id: `t${++id}`, date, amount, categoryId, accountId, description, note: null });

const rows: AnalysisRow[] = [
  row("2026-10-03", -50, "spesa", "Esselunga"), // Saturday
  row("2026-10-10", -30, "spesa", "Esselunga"), // Saturday
  row("2026-10-14", -120, "ristoranti", "Trattoria Da Mario"), // Wednesday
  row("2026-10-27", 2000, "stipendio", "Stipendio ACME"),
  row("2026-10-20", -500, "giroconti", "Giroconto", "revolut"),
  row("2026-09-05", -40, "spesa", "Esselunga"),
  row("2026-09-18", -80, "ristoranti", "Sushi Ko"),
  row("2026-09-27", 2000, "stipendio", "Stipendio ACME"),
  row("2025-10-08", -60, "spesa", "Esselunga"),
  row("2026-10-21", 0, "spesa", "Rimborsato tutto"),
];

const ask = (raw: Parameters<typeof cleanAnalysis>[0]): AnalysisQuery => cleanAnalysis(raw, { language: "it", today: TODAY });
const run = (query: AnalysisQuery, filters: Partial<ResolvedFilters> = {}) => runAnalysis(rows, query, { ...noFilters, ...filters }, context);

describe("cleanAnalysis", () => {
  it("defaults to the spending of the last 12 months", () => {
    const query = ask({});
    expect(query).toMatchObject({ measure: "somma", direction: "uscite", from: "2025-11-01", to: TODAY, defaultPeriod: true, limit: 5, order: "desc" });
  });

  it("keeps the period inside 2000…today and swaps a reversed one", () => {
    expect(ask({ from: "2026-12-01", to: "2027-01-31" })).toMatchObject({ to: TODAY });
    expect(ask({ from: "2026-10-31", to: "2026-10-01" })).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(ask({ from: "1990-01-01", to: "2026-01-31" }).from).toBe("2000-01-01");
    expect(ask({ all: true })).toMatchObject({ all: true, from: "2000-01-01", compare: null });
  });

  it("folds words, drops links and markup, bounds the limit and the amounts", () => {
    const query = ask({ text: "  <b>McDonald’S</b> https://evil.example ", limit: 99, minAmount: -5, maxAmount: 20 });
    expect(query.filters.text).toBe("bmcdonald’s/b");
    expect(query.limit).toBe(10);
    expect(query.filters.min).toBeNull();
    expect(query.filters.max).toBe(20);
  });

  it("asks for the smallest first only for a minimum or when told", () => {
    expect(ask({ measure: "minimo" }).order).toBe("asc");
    expect(ask({ measure: "massimo" }).order).toBe("desc");
  });
});

describe("runAnalysis", () => {
  const october = { from: "2026-10-01", to: "2026-10-31" };

  it("sums the spending of a month without transfers or fully excluded movements", () => {
    const result = run(ask({ ...october }));
    expect(result).toMatchObject({ value: 200, count: 3, total: 200, rowsKind: null });
  });

  it("filters by category, account, amount bounds and weekend", () => {
    expect(run(ask({ ...october }), { categoryId: "spesa" }).value).toBe(80);
    expect(run(ask({ ...october }), { min: 100 }).value).toBe(120);
    expect(run(ask({ ...october }), { days: "weekend" }).value).toBe(80);
    expect(run(ask({ ...october }), { days: "feriali" }).value).toBe(120);
    expect(run(ask({ ...october }), { text: "esselunga" }).count).toBe(2);
  });

  it("averages per movement, per month from the first movement, and the median", () => {
    expect(run(ask({ ...october, measure: "media" })).value).toBeCloseTo(66.67, 2);
    // From 2 January (first movement) to 31 October: about 10 months, 320 € spent.
    const monthly = run(ask({ from: "2025-11-01", to: "2026-10-31", measure: "media", per: "mese" }));
    expect(monthly.span).toBe(10);
    expect(monthly.value).toBeCloseTo(320 / (303 / (365.25 / 12)), 1);
    expect(run(ask({ ...october, measure: "mediana" })).value).toBe(50);
  });

  it("counts, and answers zero when nothing matches", () => {
    expect(run(ask({ ...october, measure: "conteggio" }), { text: "esselunga" })).toMatchObject({ value: 2, unit: "volte" });
    expect(run(ask({ ...october, measure: "conteggio" }), { text: "netflix" }).value).toBe(0);
    expect(run(ask({ ...october }), { text: "netflix" }).value).toBeNull();
  });

  it("lists the biggest movements with their ids", () => {
    const result = run(ask({ from: "2026-09-01", to: "2026-10-31", measure: "massimo", limit: 2 }));
    expect(result.rowsKind).toBe("movimenti");
    expect(result.rows.map((r) => r.value)).toEqual([120, 80]);
    expect(result.value).toBe(120);
    expect(result.rows[0].movementId).toBeDefined();
  });

  it("splits by category, biggest first, with what is beyond the limit summed", () => {
    const result = run(ask({ from: "2026-09-01", to: "2026-10-31", groupBy: "categoria", limit: 1 }));
    expect(result.rows).toMatchObject([{ label: "Ristoranti", value: 200, count: 2, categoryId: "ristoranti" }]);
    expect(result.others).toEqual({ value: 120, count: 3, groups: 1 });
    expect(result.value).toBe(320);
  });

  it("splits by month in time order with empty months, and names the month with the most", () => {
    const series = run(ask({ from: "2026-08-01", to: "2026-10-31", groupBy: "mese" }));
    expect(series.rowsKind).toBe("serie");
    expect(series.rows.map((r) => [r.key, r.value])).toEqual([["2026-08-01", 0], ["2026-09-01", 120], ["2026-10-01", 200]]);
    const top = run(ask({ from: "2026-08-01", to: "2026-10-31", groupBy: "mese", measure: "massimo" }));
    expect(top.top).toMatchObject({ key: "2026-10-01", value: 200 });
    expect(top.value).toBe(200);
  });

  it("splits by merchant under the newest description", () => {
    const result = run(ask({ ...october, groupBy: "esercente" }));
    expect(result.rows.map((r) => [r.label, r.value, r.text])).toEqual([["Trattoria Da Mario", 120, "trattoria da mario"], ["Esselunga", 80, "esselunga"]]);
  });

  it("splits by weekday Monday to Sunday", () => {
    const result = run(ask({ ...october, groupBy: "giorno_settimana" }));
    expect(result.rows).toHaveLength(7);
    expect(result.rows[2].value).toBe(120);
    expect(result.rows[5].value).toBe(80);
  });

  it("turns a month split over many years into a split by year", () => {
    const result = run(ask({ all: true, groupBy: "mese" }));
    expect(result.groupBy).toBe("anno");
  });

  it("computes income minus spending", () => {
    expect(run(ask({ ...october, direction: "netto" })).value).toBe(1800);
    expect(run(ask({ ...october, direction: "entrate" })).value).toBe(2000);
  });

  it("compares with the month before and the year before", () => {
    expect(run(ask({ ...october, compare: "precedente" })).comparison).toEqual({ value: 120, from: "2026-09-01", to: "2026-09-30" });
    expect(run(ask({ ...october, compare: "anno_prima" })).comparison).toEqual({ value: 60, from: "2025-10-01", to: "2025-10-31" });
  });

  it("marks a text search over a period older than the text window as partial", () => {
    expect(run(ask({ from: "2024-01-01", to: "2026-10-31" }), { text: "esselunga" }).partial).toBe(true);
    expect(run(ask({ from: "2024-01-01", to: "2026-10-31" })).partial).toBe(false);
  });
});

describe("comparisonSpan", () => {
  it("takes the same number of whole months before, or the same days", () => {
    expect(comparisonSpan("2026-01-01", "2026-03-31", "precedente")).toEqual({ from: "2025-10-01", to: "2025-12-31" });
    expect(comparisonSpan("2026-10-10", "2026-10-19", "precedente")).toEqual({ from: "2026-09-30", to: "2026-10-09" });
    expect(comparisonSpan("2024-02-29", "2024-02-29", "anno_prima")).toEqual({ from: "2023-02-28", to: "2023-02-28" });
  });
});
