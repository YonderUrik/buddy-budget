/**
 * Piano di un finanziamento costruito da condizioni iniziali + registro eventi (tutto puro).
 *
 * Il piano è una sequenza di segmenti: il primo nasce dalle condizioni del debito, ogni `rate_change` e
 * `balance_correction` ne apre uno nuovo dalla rata successiva alla sua data, con le rate rimanenti invariate.
 * Le rate già concluse restano quelle del segmento precedente. Gli importi reali pagati non cambiano il piano: per
 * riallineare il residuo dopo sospensioni o rinegoziazioni c'è la correzione del residuo.
 */

import { addMonthsClamped, buildSegmentSchedule, round2, type IsoDate, type ScheduleRow } from "./amortization";

export const DEBT_START_MODES = ["nuovo", "origine", "fotografia"] as const;
export type DebtStartMode = (typeof DEBT_START_MODES)[number];

export interface DebtTerms {
  startMode: DebtStartMode;
  /** Capitale erogato (modalità nuovo/origine) o residuo attuale (fotografia di oggi). */
  principal: number;
  /** TAN annuo in %. */
  annualRate: number;
  /** Numero di rate totali (nuovo/origine) o rimanenti (fotografia). */
  installments: number;
  /** Scadenza della prima rata (nuovo/origine) o della prossima (fotografia). */
  firstInstallmentDate: IsoDate;
  /** Rata dichiarata dall'utente; se assente si usa quella calcolata. */
  installment?: number | null;
}

export type DebtPlanEvent =
  | { type: "payment"; installmentNumber: number; date: IsoDate; amount: number; transactionId?: string | null }
  | { type: "balance_correction"; date: IsoDate; amount: number }
  | { type: "rate_change"; date: IsoDate; rate: number };

export type InstallmentStatus = "pagata" | "da_pagare" | "scaduta" | "da_confermare";

export interface LoanPlanRow extends ScheduleRow {
  status: InstallmentStatus;
  /** Pagamento registrato per questa rata. */
  payment: { date: IsoDate; amount: number; transactionId: string | null } | null;
}

export interface LoanPlanTotals {
  /** Capitale residuo a oggi secondo il piano (dopo l'ultima rata con scadenza ≤ oggi). */
  residual: number;
  /** Rata della prossima scadenza (0 se il finanziamento è concluso). */
  currentInstallment: number;
  /** Interessi delle rate con scadenza ≤ oggi. */
  interestToDate: number;
  /** Interessi delle rate con scadenza dopo oggi. */
  interestRemaining: number;
  /** Somma degli importi realmente registrati come pagati. */
  paidTotal: number;
  remainingInstallments: number;
  /** Scadenza dell'ultima rata. */
  endDate: IsoDate;
  /** Prima rata non ancora saldata (da pagare o scaduta). */
  nextDueDate: IsoDate | null;
  overdueCount: number;
  /** Rate passate ricostruite ma non ancora confermate dall'utente. */
  unconfirmedCount: number;
  finished: boolean;
}

export interface LoanPlan {
  rows: LoanPlanRow[];
  totals: LoanPlanTotals;
  /** Residuo nel tempo, dalla situazione iniziale all'ultima rata (per il grafico). */
  residualSeries: { date: IsoDate; residual: number }[];
  /** Eventi non applicabili (rata inesistente o già pagata, evento oltre la fine del piano). */
  warnings: string[];
}

type AnchorEvent = Extract<DebtPlanEvent, { type: "balance_correction" | "rate_change" }>;

function isAnchorEvent(event: DebtPlanEvent): event is AnchorEvent {
  return event.type !== "payment";
}

/** Righe del piano teorico (senza stato) applicando in ordine di data i cambi di tasso e le correzioni. */
function buildTheoreticalRows(terms: DebtTerms, anchors: AnchorEvent[], warnings: string[]): ScheduleRow[] {
  const anchorDay = Number(terms.firstInstallmentDate.slice(8, 10));
  let rows = buildSegmentSchedule({
    firstDueDate: terms.firstInstallmentDate,
    principal: terms.principal,
    annualRate: terms.annualRate,
    installments: terms.installments,
    installment: terms.installment ?? undefined,
  });
  let currentRate = terms.annualRate;
  for (const event of anchors) {
    const frozen = rows.filter((r) => r.dueDate <= event.date);
    const remaining = rows.length - frozen.length;
    if (remaining === 0) {
      warnings.push(`Evento del ${event.date} oltre l'ultima rata: ignorato`);
      continue;
    }
    const residualBefore = frozen.length > 0 ? frozen[frozen.length - 1].residual : terms.principal;
    if (event.type === "rate_change") currentRate = event.rate;
    const principal = event.type === "balance_correction" ? event.amount : residualBefore;
    if (!(principal > 0)) {
      warnings.push(`Correzione del ${event.date} con residuo non positivo: ignorata`);
      continue;
    }
    const tail = buildSegmentSchedule({
      firstDueDate: rows[frozen.length].dueDate,
      anchorDay,
      principal,
      annualRate: currentRate,
      installments: remaining,
      firstNumber: frozen.length + 1,
    });
    rows = [...frozen, ...tail];
  }
  return rows;
}

/** Costruisce il piano del finanziamento a `today` da condizioni ed eventi. */
export function buildLoanPlan(terms: DebtTerms, events: DebtPlanEvent[], today: IsoDate): LoanPlan {
  const warnings: string[] = [];
  const anchors = events.filter(isAnchorEvent).sort((a, b) => a.date.localeCompare(b.date));
  const theoretical = buildTheoreticalRows(terms, anchors, warnings);

  const payments = new Map<number, Extract<DebtPlanEvent, { type: "payment" }>>();
  for (const event of events) {
    if (event.type !== "payment") continue;
    const exists = theoretical.some((r) => r.number === event.installmentNumber);
    if (!exists) {
      warnings.push(`Pagamento della rata ${event.installmentNumber}, che non esiste: ignorato`);
    } else if (payments.has(event.installmentNumber)) {
      warnings.push(`Rata ${event.installmentNumber} già pagata: secondo pagamento ignorato`);
    } else {
      payments.set(event.installmentNumber, event);
    }
  }

  const rows: LoanPlanRow[] = theoretical.map((row) => {
    const payment = payments.get(row.number);
    let status: InstallmentStatus;
    if (payment) status = "pagata";
    else if (row.dueDate >= today) status = "da_pagare";
    else status = terms.startMode === "origine" ? "da_confermare" : "scaduta";
    return {
      ...row,
      status,
      payment: payment ? { date: payment.date, amount: payment.amount, transactionId: payment.transactionId ?? null } : null,
    };
  });

  const past = rows.filter((r) => r.dueDate <= today);
  const future = rows.filter((r) => r.dueDate > today);
  const settledResidual = past.length > 0 ? past[past.length - 1].residual : terms.principal;
  const nextUnsettled = rows.find((r) => r.status === "da_pagare" || r.status === "scaduta");
  const sum = (list: LoanPlanRow[], pick: (r: LoanPlanRow) => number) => round2(list.reduce((s, r) => s + pick(r), 0));

  const first = rows[0];
  const startBefore = addMonthsClamped(first.dueDate, -1, Number(terms.firstInstallmentDate.slice(8, 10)));
  const residualSeries = [{ date: startBefore, residual: round2(terms.principal) }, ...rows.map((r) => ({ date: r.dueDate, residual: r.residual }))];

  return {
    rows,
    totals: {
      residual: settledResidual,
      currentInstallment: future.length > 0 ? future[0].installment : 0,
      interestToDate: sum(past, (r) => r.interest),
      interestRemaining: sum(future, (r) => r.interest),
      paidTotal: round2([...payments.values()].reduce((s, p) => s + p.amount, 0)),
      remainingInstallments: future.length,
      endDate: rows[rows.length - 1].dueDate,
      nextDueDate: nextUnsettled?.dueDate ?? null,
      overdueCount: rows.filter((r) => r.status === "scaduta").length,
      unconfirmedCount: rows.filter((r) => r.status === "da_confermare").length,
      finished: future.length === 0,
    },
    residualSeries,
    warnings,
  };
}
