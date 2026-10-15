/** Tipi di obiettivo: decidono le domande del form, l'icona e se i soldi escono dal patrimonio quando lo raggiungi. */
export const GOAL_KINDS = ["emergenza", "viaggio", "casa", "acquisto", "altro"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

/** Obiettivi i cui soldi restano nel patrimonio anche una volta raggiunti (non si spendono). */
export const KEPT_GOAL_KINDS: readonly GoalKind[] = ["emergenza"];

/** Mesi di spese proposti per il fondo di emergenza. */
export const EMERGENCY_MONTH_CHOICES = [3, 6, 12] as const;
export const DEFAULT_EMERGENCY_MONTHS = 6;

/** Massimo di obiettivi per persona: oltre, la lista smette di essere un piano. */
export const MAX_GOALS = 20;
/** Massimo di fonti (conti e titoli) per obiettivo. */
export const MAX_GOAL_SOURCES = 12;
/** Obiettivi mostrati nella Panoramica: i più vicini alla meta. */
export const OVERVIEW_GOALS = 3;
/** Giorni prima della data di un obiettivo non ancora raggiunto in cui parte il promemoria. */
export const GOAL_DEADLINE_LEAD_DAYS = 30;
/** Orizzonte massimo delle simulazioni (mesi): oltre, una data non dice più niente. */
export const GOAL_HORIZON_MONTHS = 600;
