/**
 * Indipendenza finanziaria (FIRE): quanto capitale serve, tra quanti anni lo raggiungi e quanto cambia con le ipotesi.
 * Tutto puro e in termini reali (euro di oggi): il rendimento è già al netto dell'inflazione.
 */

/** Oltre questi anni il risultato si considera "mai": non ha senso pianificare più lontano. */
export const MAX_PLANNING_YEARS = 80;

/** Capitale necessario perché un prelievo del `withdrawalRate` annuo copra la spesa annua. */
export function fireNumber(annualSpending: number, withdrawalRate: number): number | null {
  if (!(annualSpending >= 0) || !(withdrawalRate > 0)) return null;
  return annualSpending / withdrawalRate;
}

/**
 * Capitale necessario tenendo conto delle imposte sulle plusvalenze che si realizzano prelevando: se una quota `taxShare`
 * di ogni euro prelevato se ne va in imposte, ne vanno prelevati `1 / (1 − taxShare)` per spenderne uno.
 */
export function fireNumberAfterTax(grossNumber: number, taxShare: number): number | null {
  if (!(taxShare >= 0) || taxShare >= 1) return null;
  return grossNumber / (1 - taxShare);
}

/** Parametri di una crescita con versamenti costanti, in termini reali. */
export interface GrowthInput {
  current: number;
  annualSaving: number;
  realReturn: number;
}

/** Patrimonio dopo `years` anni, con i versamenti a fine anno. */
export function wealthAfterYears({ current, annualSaving, realReturn }: GrowthInput, years: number): number {
  if (years <= 0) return current;
  if (Math.abs(realReturn) < 1e-12) return current + annualSaving * years;
  const growth = (1 + realReturn) ** years;
  return current * growth + (annualSaving * (growth - 1)) / realReturn;
}

/**
 * Anni (anche frazionari) per arrivare a `target`; 0 se ci sei già, null se non ci arrivi mai o oltre `MAX_PLANNING_YEARS`.
 * Soluzione chiusa: n = ln((T·r + c) / (P·r + c)) / ln(1 + r), con P patrimonio, c versamento annuo, r rendimento reale.
 */
export function yearsToTarget(input: GrowthInput, target: number): number | null {
  const { current, annualSaving, realReturn } = input;
  if (current >= target) return 0;
  let years: number;
  if (Math.abs(realReturn) < 1e-12) {
    if (annualSaving <= 0) return null;
    years = (target - current) / annualSaving;
  } else {
    const top = target * realReturn + annualSaving;
    const bottom = current * realReturn + annualSaving;
    if (!(top > 0) || !(bottom > 0)) return null;
    years = Math.log(top / bottom) / Math.log(1 + realReturn);
  }
  if (!Number.isFinite(years) || years < 0 || years > MAX_PLANNING_YEARS) return null;
  return years;
}

/**
 * Coast number: il patrimonio che oggi basta per arrivare al `target` fra `years` anni senza versare altro,
 * con il solo rendimento reale.
 */
export function coastNumber(target: number, realReturn: number, years: number): number {
  if (years <= 0) return target;
  return target / (1 + realReturn) ** years;
}

/** Le varianti del numero FIRE a partire dalla spesa annua divisa per gruppo. */
export interface FireVariants {
  /** Solo le spese che non puoi evitare (gruppo Dovute) più le saltuarie. */
  lean: number;
  /** Tutta la spesa attuale. */
  standard: number;
}

/** Spesa di una variante "essenziale": dovute + saltuarie (le spese rare ma inevitabili). */
export function leanSpending(byGroup: { dovuta: number; saltuaria: number }): number {
  return byGroup.dovuta + byGroup.saltuaria;
}

/** Una cella della tabella di sensibilità. */
export interface SensitivityCell {
  rowValue: number;
  columnValue: number;
  years: number | null;
}

/**
 * Anni al numero FIRE al variare di due ipotesi: righe = tasso di prelievo, colonne = rendimento reale.
 * Il versamento e il patrimonio restano quelli dati.
 */
export function sensitivityByRateAndReturn(params: {
  annualSpending: number;
  current: number;
  annualSaving: number;
  withdrawalRates: number[];
  realReturns: number[];
}): SensitivityCell[][] {
  const { annualSpending, current, annualSaving, withdrawalRates, realReturns } = params;
  return withdrawalRates.map((rate) =>
    realReturns.map((realReturn) => {
      const target = fireNumber(annualSpending, rate);
      return {
        rowValue: rate,
        columnValue: realReturn,
        years: target === null ? null : yearsToTarget({ current, annualSaving, realReturn }, target),
      };
    })
  );
}

/**
 * Anni al numero FIRE al variare della spesa (righe, in variazione relativa: −0,2 = 20% in meno) e del versamento
 * (colonne, in variazione relativa). Spendere meno ha un doppio effetto: abbassa il traguardo e libera risparmio, perciò
 * la variazione della spesa sposta anche il versamento di pari importo.
 */
export function sensitivityBySpendingAndSaving(params: {
  annualSpending: number;
  withdrawalRate: number;
  realReturn: number;
  current: number;
  annualSaving: number;
  spendingChanges: number[];
  savingChanges: number[];
}): SensitivityCell[][] {
  const { annualSpending, withdrawalRate, realReturn, current, annualSaving, spendingChanges, savingChanges } = params;
  return spendingChanges.map((spendingChange) =>
    savingChanges.map((savingChange) => {
      const spending = annualSpending * (1 + spendingChange);
      const target = fireNumber(spending, withdrawalRate);
      const saving = annualSaving * (1 + savingChange) - (spending - annualSpending);
      return {
        rowValue: spendingChange,
        columnValue: savingChange,
        years: target === null ? null : yearsToTarget({ current, annualSaving: saving, realReturn }, target),
      };
    })
  );
}

/** Tasso di risparmio: quota delle entrate che non spendi (0,25 = 25%); null senza entrate. */
export function savingsRate(income: number, expenses: number): number | null {
  return income > 0 ? (income - expenses) / income : null;
}

/** Mesi di spesa coperti da una somma, null se la spesa mensile è zero. */
export function monthsOfCoverage(amount: number, monthlySpending: number): number | null {
  return monthlySpending > 0 ? amount / monthlySpending : null;
}
