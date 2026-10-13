/** Tipi di debito: text + costante invece di enum Postgres, per aggiungerne senza migrazioni. */
export const DEBT_KINDS = ["loan", "credit_line"] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

/** Come è stato aggiunto un finanziamento: da oggi, ricostruito dall'origine o fotografia della situazione di oggi. */
export const DEBT_START_MODES = ["nuovo", "origine", "fotografia"] as const;
export type DebtStartMode = (typeof DEBT_START_MODES)[number];

/**
 * `rate_change`: nuovo tasso annuo dalla data (per una linea di credito, il nuovo valore dell'indice). `balance_correction`:
 * residuo reale alla data (per una linea, saldo utilizzato). `payment`: rata pagata. `early_repayment`: estinzione
 * anticipata (importo, penale, effetto sul piano). Solo linee di credito: `draw` utilizzo, `repay` rimborso,
 * `interest_charged` interessi realmente addebitati dalla banca.
 */
export const DEBT_EVENT_TYPES = ["payment", "rate_change", "balance_correction", "early_repayment", "draw", "repay", "interest_charged"] as const;
export type DebtEventType = (typeof DEBT_EVENT_TYPES)[number];

/** Effetto di un'estinzione anticipata: rata più bassa a parità di scadenza, o stessa rata e fine anticipata. */
export const DEBT_EARLY_EFFECTS = ["reduce_installment", "reduce_duration"] as const;
export type DebtEarlyEffect = (typeof DEBT_EARLY_EFFECTS)[number];

/** Ogni quanto la banca addebita gli interessi di una linea di credito. */
export const CREDIT_LINE_FREQUENCIES = ["monthly", "quarterly"] as const;
export type CreditLineFrequency = (typeof CREDIT_LINE_FREQUENCIES)[number];

/** Base del giorno per gli interessi: 360, 365 o giorni effettivi dell'anno. */
export const CREDIT_LINE_DAY_COUNTS = ["360", "365", "actual"] as const;
export type CreditLineDayCount = (typeof CREDIT_LINE_DAY_COUNTS)[number];

/** Soglia di allerta dell'utilizzo: percentuale del fido o importo assoluto. */
export const CREDIT_LINE_ALERT_TYPES = ["percent", "amount"] as const;
export type CreditLineAlertType = (typeof CREDIT_LINE_ALERT_TYPES)[number];
