import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ImportResult } from "@/lib/investments/import/types";
import { ImportSummaryStep } from "./import-summary-step";

const DONE: ImportResult = { rows: [], counts: { new: 12, duplicate: 0, error: 0 }, inserted: 12, instrumentsCreated: 2 };

/** The last step of a broker statement, as «Aggiungi» shows it over any page (no Investimenti layout around it). */
function renderDone(onManageImports?: () => void) {
  return renderToStaticMarkup(<ImportSummaryStep result={DONE} rows={[]} newInstruments={2} done keepsOriginal onManageImports={onManageImports} />);
}

describe("ImportSummaryStep", () => {
  // 0.88.0: the step read the Investimenti layout's actions and threw when the import was opened from «Aggiungi».
  it("renders outside the Investimenti layout", () => {
    expect(() => renderDone()).not.toThrow();
    expect(renderDone()).toContain("operazioni importate");
  });

  it("offers «Gestisci importazioni» as a button only when the caller can open the list", () => {
    expect(renderDone(() => {})).toMatch(/<button[^>]*>Gestisci importazioni<\/button>/);
    expect(renderDone()).not.toMatch(/<button[^>]*>Gestisci importazioni/);
    expect(renderDone()).toContain("Gestisci importazioni");
  });
});
