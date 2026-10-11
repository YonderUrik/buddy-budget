/** Raggruppa le righe lette di un'anteprima per esito (da importare, escluse, errori) e ne conta i tipi. */

import type { Preview } from "./confirm";

type PreviewRecord = Preview["records"][number];

export type PreviewTab = "importable" | "ignored" | "errors";

export interface PreviewGroups {
  importable: PreviewRecord[];
  ignored: PreviewRecord[];
  errors: PreviewRecord[];
  /** Quante righe diventano movimenti (Liquidità) e quante operazioni (Investimenti). */
  cash: number;
  investments: number;
}

export function groupPreviewRecords(records: PreviewRecord[]): PreviewGroups {
  const groups: PreviewGroups = { importable: [], ignored: [], errors: [], cash: 0, investments: 0 };
  for (const record of records) {
    const kind = record.outcome.kind;
    if (kind === "cash") { groups.importable.push(record); groups.cash += 1; }
    else if (kind === "investment") { groups.importable.push(record); groups.investments += 1; }
    else if (kind === "ignore") groups.ignored.push(record);
    else groups.errors.push(record);
  }
  return groups;
}

/** Scheda aperta all'inizio: gli errori se ci sono (sono ciò che blocca), altrimenti ciò che verrà importato. */
export function defaultPreviewTab(groups: Pick<PreviewGroups, "errors">): PreviewTab {
  return groups.errors.length > 0 ? "errors" : "importable";
}
