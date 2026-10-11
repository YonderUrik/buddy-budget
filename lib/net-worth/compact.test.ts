import { describe, expect, it } from "vitest";
import { compactSnapshotRows } from "./compact";

const row = (date: string, assetClass = "liquidita") => ({ date, assetClass });

describe("compactSnapshotRows", () => {
  it("tiene per intero le righe recenti", () => {
    const rows = [row("2026-09-01"), row("2026-09-02"), row("2026-10-10")];
    expect(compactSnapshotRows(rows, "2026-10-11")).toEqual(rows);
  });

  it("delle righe vecchie tiene l'ultima di ogni mese per classe e la prima in assoluto", () => {
    const rows = [
      row("2024-01-03"),
      row("2024-01-15"),
      row("2024-01-31"),
      row("2024-02-10"),
      row("2024-02-20"),
      row("2024-01-20", "investimenti"),
      row("2024-01-21", "investimenti"),
    ];
    expect(compactSnapshotRows(rows, "2026-10-11")).toEqual([
      row("2024-01-03"),
      row("2024-01-31"),
      row("2024-02-20"),
      row("2024-01-20", "investimenti"),
      row("2024-01-21", "investimenti"),
    ]);
  });

  it("non modifica l'ordine e funziona senza righe", () => {
    expect(compactSnapshotRows([], "2026-10-11")).toEqual([]);
  });
});
