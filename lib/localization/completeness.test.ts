import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import en from "./catalogs/en.json";
import de from "./catalogs/de.json";
import { translate } from "./messages";
import { localizedDebtFormats } from "@/components/domain/debts/debts-format";
import { localizedFormats } from "./format";
import { localizedHeatmap } from "@/lib/calc/return-heatmap";

const placeholders = (text: string) => [...new Set(text.match(/\{\d+\}/g) ?? [])].sort();

describe("translation coverage", () => {
  it("preserves interpolation values in both catalogs", () => {
    for (const catalog of [en, de]) {
      for (const [source, translated] of Object.entries(catalog)) {
        expect(placeholders(translated), source).toEqual(placeholders(source));
      }
    }
  });

  it("covers static translation calls in the app", () => {
    const missing = new Set<string>();
    function visitDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { if (entry.name !== "style-guide") visitDirectory(file); continue; }
        if (!/\.tsx?$/.test(file) || /\.test\./.test(file)) continue;
        const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node) && /^(tr|t)$/.test(node.expression.getText(source))) {
            const key = node.arguments[0];
            if (key && ts.isStringLiteral(key) && /[A-Za-zÀ-ÿ]{2}/.test(key.text)) {
              for (const language of ["en", "de"] as const) {
                // Identical translations (e.g. technical terms) are valid catalog entries.
                const catalog = language === "en" ? en : de;
                if (!(key.text in catalog) && translate(language, key.text) === key.text) missing.add(`${language}: ${key.text}`);
              }
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    for (const root of ["app", "components", "lib"]) visitDirectory(root);
    expect([...missing]).toEqual([]);
  });
});

describe("language isolation", () => {
  it("keeps simultaneous helper instances in their own language", () => {
    const english = localizedDebtFormats("en");
    const german = localizedDebtFormats("de");
    expect(english.formatDuration(25)).toBe("2 years and 1 month");
    expect(german.formatDuration(25)).toBe("2 Jahre und 1 Monat");
    expect(english.formatMonthYear("2026-10-14")).toBe("October 2026");
    expect(german.formatMonthYear("2026-10-14")).toBe("Oktober 2026");
    expect(localizedDebtFormats("it").formatDuration(25)).toBe("2 anni e 1 mese");
    expect(english.formatDuration(25)).toBe("2 years and 1 month");
  });

  it("formats numbers by language and leaves inserted user text untouched", () => {
    expect(localizedFormats("en-GB").formatRatio(1234.5)).toBe("1,234.5");
    expect(localizedFormats("de-DE").formatRatio(1234.5)).toBe("1.234,5");
    expect(translate("de", 'Ricollega a "{0}"', {0: "Conto corrente"})).toBe("Erneut mit „Conto corrente“ verbinden");
  });

  it("changes heatmap presentation without changing return calculations", () => {
    const samples = [{date: "2026-10-01", ret: 0.02, gain: 2}, {date: "2026-10-02", ret: -0.01, gain: -1}];
    const italian = localizedHeatmap("it");
    const german = localizedHeatmap("de");
    const deBucket = german.groupDailyReturns(samples, "mese").get("2026-10")!;
    const itBucket = italian.groupDailyReturns(samples, "mese").get("2026-10")!;
    expect(deBucket.label).toBe("Oktober 2026");
    expect(itBucket.label).toBe("ottobre 2026");
    expect({...deBucket, label: itBucket.label}).toEqual(itBucket);
    expect(deBucket.factor).toBeCloseTo(1.0098);
    expect(deBucket.gain).toBe(1);
  });
});
