/** Oltre questo orizzonte (100 anni) l'obiettivo conta come irraggiungibile. */
export const MAX_MONTHS = 1200;

export interface TargetInput {
  /** Cifra da raggiungere. */
  target: number;
  /** Quanto c'è già. */
  start: number;
  /** Versamento a fine mese. */
  monthly: number;
  /** Rendimento annuo in percentuale, capitalizzato ogni mese (0 se i soldi restano sul conto). */
  annualRatePct: number;
}

/** Tasso mensile equivalente a un rendimento annuo in percentuale. */
function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

/** Valore dopo `months` mesi: capitale iniziale rivalutato più i versamenti a fine mese rivalutati (montante di una rendita posticipata). */
export function valueAfter({ start, monthly, annualRatePct }: Omit<TargetInput, "target">, months: number): number {
  const i = monthlyRate(annualRatePct);
  if (i === 0) return start + monthly * months;
  const growth = Math.pow(1 + i, months);
  return start * growth + (monthly * (growth - 1)) / i;
}

/**
 * Mesi che servono per arrivare a `target` (0 se c'è già; `Infinity` se non ci si arriva entro `MAX_MONTHS`, per esempio
 * senza versamenti e senza rendimento). Si arrotonda al mese intero successivo, perché il versamento è a fine mese.
 */
export function monthsToTarget(input: TargetInput): number {
  const { target, start, monthly, annualRatePct } = input;
  if (target <= start) return 0;
  const i = monthlyRate(annualRatePct);
  let months: number;
  if (i === 0) {
    if (monthly <= 0) return Infinity;
    months = (target - start) / monthly;
  } else {
    // start·(1+i)^n + monthly·((1+i)^n − 1)/i = target  ⇒  (1+i)^n = (target + monthly/i) / (start + monthly/i)
    const denominator = start + monthly / i;
    if (denominator <= 0) return Infinity;
    const ratio = (target + monthly / i) / denominator;
    if (ratio <= 1) return Infinity;
    months = Math.log(ratio) / Math.log(1 + i);
  }
  // tolleranza sugli arrotondamenti binari: 23,9999999 mesi sono 24, non 25
  const rounded = Math.ceil(months - 1e-9);
  return rounded > MAX_MONTHS ? Infinity : rounded;
}

/** Versamento mensile che serve per arrivare a `target` in `months` mesi (0 se c'è già abbastanza). */
export function monthlyForTarget({ target, start, annualRatePct }: Omit<TargetInput, "monthly">, months: number): number {
  if (months <= 0) return Math.max(0, target - start);
  const i = monthlyRate(annualRatePct);
  if (i === 0) return Math.max(0, (target - start) / months);
  const growth = Math.pow(1 + i, months);
  return Math.max(0, ((target - start * growth) * i) / (growth - 1));
}

export interface TargetPlan {
  /** Mesi per arrivarci (`Infinity` se non ci si arriva). */
  months: number;
  /** Totale dei versamenti fatti nel periodo. */
  contributed: number;
  /** Quanto è arrivato dal rendimento. */
  growth: number;
  /** Valore alla fine del periodo (almeno l'obiettivo, perché l'ultimo mese è intero). */
  finalValue: number;
}

/** Il piano completo: quando si arriva e da dove vengono i soldi (quello che c'era, i versamenti, il rendimento). */
export function planTarget(input: TargetInput): TargetPlan {
  const months = monthsToTarget(input);
  if (!Number.isFinite(months)) return { months, contributed: 0, growth: 0, finalValue: input.start };
  const finalValue = valueAfter(input, months);
  const contributed = input.monthly * months;
  return { months, contributed, growth: Math.max(0, finalValue - input.start - contributed), finalValue };
}
