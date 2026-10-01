/**
 * Piano di un finanziamento costruito da condizioni iniziali + registro eventi (tutto puro).
 *
 * Il piano è una sequenza di segmenti: il primo nasce dalle condizioni del debito, ogni `rate_change` e
 * `balance_correction` ne apre uno nuovo dalla rata successiva alla sua data, con le rate rimanenti invariate.
 * Le rate già concluse restano quelle del segmento precedente. Gli importi reali pagati non cambiano il piano: per
 * riallineare il residuo dopo sospensioni o rinegoziazioni c'è la correzione del residuo.
 */

import { addMonthsClamped, buildSegmentSchedule, round2, solveInstallments, type IsoDate, type ScheduleRow } from "./amortization";

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

/** Effetto di un'estinzione anticipata: stessa scadenza con rata più bassa, o stessa rata e fine anticipata. */
export const EARLY_REPAYMENT_EFFECTS = ["reduce_installment", "reduce_duration"] as const;
export type EarlyRepaymentEffect = (typeof EARLY_REPAYMENT_EFFECTS)[number];

export type DebtPlanEvent =
  | { type: "payment"; installmentNumber: number; date: IsoDate; amount: number; transactionId?: string | null }
  | { type: "balance_correction"; date: IsoDate; amount: number }
  | { type: "rate_change"; date: IsoDate; rate: number }
  | { type: "early_repayment"; date: IsoDate; amount: number; penalty: number; effect: EarlyRepaymentEffect };

/** Estinzione anticipata applicata al piano, con il residuo che ne resta. */
export interface AppliedEarlyRepayment {
  date: IsoDate;
  amount: number;
  penalty: number;
  effect: EarlyRepaymentEffect;
  /** Residuo dopo l'estinzione (0 se chiude il debito). */
  residualAfter: number;
}

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
  /** Penali pagate sulle estinzioni anticipate già applicate (scadenza ≤ oggi). */
  penaltiesPaid: number;
  /** Data in cui un'estinzione anticipata ha chiuso il debito (null se non è successo). */
  closedOn: IsoDate | null;
}

export interface LoanPlan {
  rows: LoanPlanRow[];
  totals: LoanPlanTotals;
  /** Residuo nel tempo, dalla situazione iniziale all'ultima rata (per il grafico). */
  residualSeries: { date: IsoDate; residual: number }[];
  /** Estinzioni anticipate applicate, in ordine di data. */
  earlyRepayments: AppliedEarlyRepayment[];
  /** Eventi non applicabili (rata inesistente o già pagata, evento oltre la fine del piano). */
  warnings: string[];
}

type AnchorEvent = Extract<DebtPlanEvent, { type: "balance_correction" | "rate_change" | "early_repayment" }>;

function isAnchorEvent(event: DebtPlanEvent): event is AnchorEvent {
  return event.type !== "payment";
}

interface TheoreticalPlan {
  rows: ScheduleRow[];
  closedOn: IsoDate | null;
  repayments: AppliedEarlyRepayment[];
}

/** Righe del piano teorico (senza stato) applicando in ordine di data i cambi di tasso, le correzioni e le estinzioni. */
function buildTheoreticalRows(terms: DebtTerms, anchors: AnchorEvent[], warnings: string[]): TheoreticalPlan {
  const anchorDay = Number(terms.firstInstallmentDate.slice(8, 10));
  let rows = buildSegmentSchedule({
    firstDueDate: terms.firstInstallmentDate,
    principal: terms.principal,
    annualRate: terms.annualRate,
    installments: terms.installments,
    installment: terms.installment ?? undefined,
  });
  let currentRate = terms.annualRate;
  let closedOn: IsoDate | null = null;
  const repayments: AppliedEarlyRepayment[] = [];
  for (const event of anchors) {
    const frozen = rows.filter((r) => r.dueDate <= event.date);
    const remaining = rows.length - frozen.length;
    if (remaining === 0) {
      warnings.push(`Evento del ${event.date} oltre l'ultima rata: ignorato`);
      continue;
    }
    const residualBefore = frozen.length > 0 ? frozen[frozen.length - 1].residual : terms.principal;
    if (event.type === "rate_change") currentRate = event.rate;
    if (event.type === "early_repayment") {
      const principal = round2(residualBefore - event.amount);
      if (principal <= 0) {
        repayments.push({ date: event.date, amount: round2(residualBefore), penalty: event.penalty, effect: event.effect, residualAfter: 0 });
        closedOn = event.date;
        rows = frozen;
        break;
      }
      const current = rows[frozen.length].installment;
      let installments = remaining;
      let installment: number | undefined;
      if (event.effect === "reduce_duration") {
        installment = current;
        try {
          installments = Math.min(remaining, solveInstallments({ principal, annualRate: currentRate, installment: current }));
        } catch {
          installment = undefined;
        }
      }
      const tail = buildSegmentSchedule({
        firstDueDate: rows[frozen.length].dueDate,
        anchorDay,
        principal,
        annualRate: currentRate,
        installments,
        installment,
        firstNumber: frozen.length + 1,
      });
      rows = [...frozen, ...tail];
      repayments.push({ date: event.date, amount: event.amount, penalty: event.penalty, effect: event.effect, residualAfter: principal });
      continue;
    }
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
  return { rows, closedOn, repayments };
}

/** Costruisce il piano del finanziamento a `today` da condizioni ed eventi. */
export function buildLoanPlan(terms: DebtTerms, events: DebtPlanEvent[], today: IsoDate): LoanPlan {
  const warnings: string[] = [];
  const anchors = events.filter(isAnchorEvent).sort((a, b) => a.date.localeCompare(b.date));
  const { rows: theoretical, closedOn, repayments } = buildTheoreticalRows(terms, anchors, warnings);

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
  const closed = closedOn !== null && closedOn <= today;
  // Residuo di oggi: l'ultima rata scaduta o l'ultima estinzione già avvenuta, quella più recente (a pari data conta l'estinzione).
  const lastPast = past.at(-1);
  const lastRepayment = repayments.filter((r) => r.date <= today).at(-1);
  const settledResidual = closed
    ? 0
    : lastRepayment && (!lastPast || lastRepayment.date >= lastPast.dueDate)
      ? lastRepayment.residualAfter
      : (lastPast?.residual ?? terms.principal);
  const nextUnsettled = rows.find((r) => r.status === "da_pagare" || r.status === "scaduta");
  const sum = (list: LoanPlanRow[], pick: (r: LoanPlanRow) => number) => round2(list.reduce((s, r) => s + pick(r), 0));

  const anchorDay = Number(terms.firstInstallmentDate.slice(8, 10));
  const startDate = rows.length > 0 ? addMonthsClamped(rows[0].dueDate, -1, anchorDay) : (closedOn as IsoDate);
  const residualSeries = [
    { date: startDate, residual: round2(terms.principal) },
    ...rows.map((r) => ({ date: r.dueDate, residual: r.residual })),
    ...repayments.map((r) => ({ date: r.date, residual: r.residualAfter })),
  ].sort((x, y) => x.date.localeCompare(y.date));

  return {
    rows,
    totals: {
      residual: settledResidual,
      currentInstallment: future.length > 0 ? future[0].installment : 0,
      interestToDate: sum(past, (r) => r.interest),
      interestRemaining: sum(future, (r) => r.interest),
      paidTotal: round2([...payments.values()].reduce((s, p) => s + p.amount, 0)),
      remainingInstallments: future.length,
      endDate: closedOn ?? rows[rows.length - 1].dueDate,
      nextDueDate: nextUnsettled?.dueDate ?? null,
      overdueCount: rows.filter((r) => r.status === "scaduta").length,
      unconfirmedCount: rows.filter((r) => r.status === "da_confermare").length,
      finished: future.length === 0,
      penaltiesPaid: round2(repayments.filter((r) => r.date <= today).reduce((s, r) => s + r.penalty, 0)),
      closedOn,
    },
    residualSeries,
    earlyRepayments: repayments,
    warnings,
  };
}
