import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { initialPensionMapping, missingPensionFields, normalizePensionRows, pensionTemplateCsv, readCsvTable } from "./mapping";
import { planSnapshotImport } from "./plan";
import { excelSerialToIso, readXlsx } from "./xlsx";

const TODAY = "2026-10-03";

describe("lettura CSV e mappatura", () => {
  it("riconosce colonne, date e decimali all'italiana dal modello", () => {
    const table = readCsvTable(pensionTemplateCsv());
    const mapping = initialPensionMapping(table);
    expect(mapping).toMatchObject({ columns: { date: 0, netContributions: 1, value: 2 }, dateOrder: "dmy", decimal: "," });
    expect(missingPensionFields(mapping)).toEqual([]);
    const rows = normalizePensionRows(table, mapping, TODAY);
    expect(rows.map((r) => (r.status === "ok" ? [r.snapshot.date, r.snapshot.netContributions, r.snapshot.value] : null))).toEqual([
      ["2026-03-31", 10880, 11250.4],
      ["2026-06-30", 11420, 11890.15],
    ]);
  });

  it("riconosce le intestazioni dell'area clienti e segnala le righe sbagliate con il motivo", () => {
    const table = readCsvTable("Data di riferimento;Totale versato;Posizione maturata\n31/12/2025;1.000,00;1.050,00\n31/02/2026;1,00;1,00\n01/01/2099;1,00;1,00\n30/06/2026;abc;5\n30/09/2026;-5;5");
    const mapping = initialPensionMapping(table);
    expect(mapping.columns).toEqual({ date: 0, netContributions: 1, value: 2 });
    const rows = normalizePensionRows(table, mapping, TODAY);
    expect(rows.map((r) => (r.status === "ok" ? "ok" : r.message))).toEqual([
      "ok",
      "Data non valida",
      "Data nel futuro o troppo vecchia",
      "Contributi netti non validi",
      "Importo fuori dai limiti",
    ]);
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
  });

  it("senza una colonna indispensabile non legge nulla e dice cosa manca", () => {
    const table = readCsvTable("Data;Valore\n01/01/2026;5");
    const mapping = initialPensionMapping(table);
    expect(missingPensionFields(mapping)).toEqual(["contributi netti"]);
    expect(normalizePensionRows(table, mapping, TODAY)).toEqual([]);
  });
});

describe("planSnapshotImport", () => {
  const existing = [{ date: "2026-03-31", netContributions: 1000, value: 1100 }];
  const snap = (line: number, date: string, net: number, value: number) => ({ line, date, netContributions: net, value });

  it("aggiunge le nuove, aggiorna la stessa data con valori diversi e salta le identiche", () => {
    const plan = planSnapshotImport([snap(2, "2026-03-31", 1000, 1100), snap(3, "2026-06-30", 1200, 1300), snap(4, "2026-01-31", 900, 950)], existing, TODAY, 100);
    expect(plan.rows.map((r) => r.status)).toEqual(["unchanged", "new", "new"]);
    const updated = planSnapshotImport([snap(2, "2026-03-31", 1000, 1150)], existing, TODAY, 100);
    expect(updated.rows[0]).toMatchObject({ status: "update", previous: { netContributions: 1000, value: 1100 } });
    expect(updated.counts).toEqual({ new: 0, update: 1, unchanged: 0, error: 0 });
  });

  it("è idempotente: reimportare lo stesso file non cambia nulla", () => {
    const first = planSnapshotImport([snap(2, "2026-06-30", 1200, 1300)], existing, TODAY, 100);
    expect(first.counts.new).toBe(1);
    const second = planSnapshotImport([snap(2, "2026-06-30", 1200, 1300)], [...existing, { date: "2026-06-30", netContributions: 1200, value: 1300 }], TODAY, 100);
    expect(second.counts).toEqual({ new: 0, update: 0, unchanged: 1, error: 0 });
  });

  it("stessa data due volte nel file: uguale si salta, diversa è un errore", () => {
    const plan = planSnapshotImport([snap(2, "2026-06-30", 1, 2), snap(3, "2026-06-30", 1, 2), snap(4, "2026-06-30", 1, 3)], [], TODAY, 100);
    expect(plan.rows.map((r) => r.status)).toEqual(["new", "unchanged", "error"]);
    expect(plan.rows[2].message).toContain("riga 2");
  });

  it("rifiuta date non plausibili e il superamento del massimo di fotografie", () => {
    expect(planSnapshotImport([snap(2, "2099-01-01", 1, 1)], [], TODAY, 100).rows[0].status).toBe("error");
    expect(planSnapshotImport([snap(2, "2026-06-30", 1, 1)], existing, TODAY, 1).error).toMatch(/più di 1/);
  });
});

/** Costruisce un .xlsx minimo (stringhe condivise, numeri e una data con formato). */
function buildXlsx(sheetRows: string): Uint8Array {
  return zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="r"><sheets><sheet name="Fondo" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8('<sst><si><t>Data</t></si><si><t>Contributi netti</t></si><si><r><t>Contro</t></r><r><t>valore</t></r></si></sst>'),
    "xl/styles.xml": strToU8('<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
  });
}

describe("readXlsx", () => {
  it("legge intestazioni, numeri e date (anche con celle vuote in mezzo)", () => {
    const table = readXlsx(
      buildXlsx(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
          '<row r="2"><c r="A2" s="1"><v>46112</v></c><c r="B2"><v>10880.5</v></c><c r="C2"><v>11250.4</v></c></row>' +
          '<row r="3"><c r="A3" s="2"><v>46203</v></c><c r="C3"><v>11890.15</v></c></row>' +
          '<row r="4"></row>'
      )
    );
    expect(table.headers).toEqual(["Data", "Contributi netti", "Controvalore"]);
    expect(table.rows).toEqual([
      ["2026-03-31", "10880.5", "11250.4"],
      ["2026-06-30", "", "11890.15"],
    ]);
    const mapping = initialPensionMapping(table);
    expect(mapping.decimal).toBe(".");
    expect(normalizePensionRows(table, mapping, TODAY).map((r) => r.status)).toEqual(["ok", "error"]);
  });

  it("rifiuta file che non sono xlsx con un messaggio comprensibile", () => {
    expect(() => readXlsx(strToU8("non sono un excel"))).toThrow(/non è un Excel/);
  });

  it("converte i numeri di serie in date ISO", () => {
    expect(excelSerialToIso(45658)).toBe("2025-01-01");
    expect(excelSerialToIso(46112.75)).toBe("2026-03-31");
    expect(excelSerialToIso(0)).toBeNull();
  });
});
