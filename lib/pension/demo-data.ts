/** Dati d'esempio del prototipo di Pensione: un fondo aperto nel 2022 con solo TFR versato ogni trimestre. */

import type { PensionSnapshot } from "@/lib/calc/pension";

export interface PensionProfile {
  /** Nome della forma previdenziale, come lo riconosce l'utente. */
  name: string;
  /** Data di prima adesione a una forma pensionistica (decide l'aliquota in uscita). */
  adhesionDate: string;
}

export const DEMO_PROFILE: PensionProfile = { name: "Piano pensione", adhesionDate: "2022-03-15" };

/** Versamento del TFR per trimestre nei dati d'esempio. */
const DEMO_QUARTERLY_CONTRIBUTION = 640;
/** Rendimento trimestrale d'esempio, dal 2022 al 2026 (un anno negativo, poi recupero). */
const DEMO_QUARTERLY_RETURNS = [-0.031, -0.022, 0.012, 0.018, 0.021, 0.009, 0.015, 0.024, 0.012, 0.008, 0.017, 0.011, 0.006, 0.019, 0.013, 0.01, 0.008, 0.007];
const DEMO_FIRST_QUARTER_END = [2022, 5] as const;

const quarterEnd = (index: number): string => {
  const total = DEMO_FIRST_QUARTER_END[0] * 12 + DEMO_FIRST_QUARTER_END[1] + index * 3;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const day = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/** Una fotografia per trimestre, con valori d'esempio coerenti tra loro. */
export function buildDemoSnapshots(): PensionSnapshot[] {
  let contributions = 0;
  let value = 0;
  return DEMO_QUARTERLY_RETURNS.map((quarterReturn, index) => {
    contributions += DEMO_QUARTERLY_CONTRIBUTION;
    value = (value + DEMO_QUARTERLY_CONTRIBUTION) * (1 + quarterReturn);
    return { id: `demo-${index}`, date: quarterEnd(index), netContributions: contributions, value: Math.round(value * 100) / 100 };
  });
}
