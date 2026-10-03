import { z } from "zod";
import { WITHDRAWAL_RULES } from "@/lib/calc/monte-carlo";

/** Limiti delle ipotesi: servono a impedire valori privi di senso (rendimento del 90%, 400 anni di pensione). */
export const ASSUMPTION_LIMITS = {
  withdrawalRate: { min: 0.01, max: 0.1 },
  expectedReturn: { min: -0.02, max: 0.12 },
  volatility: { min: 0, max: 0.6 },
  inflation: { min: -0.02, max: 0.15 },
  retirementYears: { min: 5, max: 70 },
  amount: { min: 0, max: 1e8 },
  ter: { min: 0, max: 0.05 },
} as const;

const L = ASSUMPTION_LIMITS;
const ratio = (l: { min: number; max: number }) => z.number().finite().min(l.min).max(l.max);
const money = z.number().finite().min(L.amount.min).max(L.amount.max);

/** Ipotesi della sezione Analitiche. Le quote sono frazioni (0,04 = 4%); `null` = ricavare dai dati dell'utente. */
export const assumptionsSchema = z.object({
  /** Tasso di prelievo sicuro con cui si calcola il numero FIRE. */
  withdrawalRate: ratio(L.withdrawalRate),
  /** Spesa annua in pensione; null = ultimi 12 mesi di uscite. */
  annualSpending: money.nullable(),
  /** Risparmio annuo; null = media degli ultimi 12 mesi. */
  annualSavings: money.nullable(),
  /** Rendimento reale annuo atteso del portafoglio, al netto dell'inflazione. */
  expectedReturn: ratio(L.expectedReturn),
  /** Volatilità annua attesa del portafoglio. */
  volatility: ratio(L.volatility),
  inflation: ratio(L.inflation),
  /** Anni di pensione da coprire. */
  retirementYears: z.number().int().min(L.retirementYears.min).max(L.retirementYears.max),
  rule: z.enum(WITHDRAWAL_RULES as [string, ...string[]]),
  /** Conta nel patrimonio FIRE anche la previdenza complementare. */
  includePensionFunds: z.boolean(),
  /** Porta il numero FIRE al lordo delle imposte sulle plusvalenze latenti. */
  includeLatentTax: z.boolean(),
  /** Pensione pubblica attesa (importo annuo reale e anni dal pensionamento FIRE); null = non considerarla. */
  publicPension: z.object({ annual: money, startsAfterYears: z.number().int().min(0).max(60) }).nullable(),
  /** TER annuo per strumento (id strumento → frazione): Buddy Budget non lo conosce da sé. */
  terByInstrument: z.record(z.string().max(64), ratio(L.ter)),
});

export type AnalyticsAssumptions = Omit<z.infer<typeof assumptionsSchema>, "rule"> & { rule: (typeof WITHDRAWAL_RULES)[number] };

/** Valori di partenza prudenti, spiegati nella schermata: la sezione funziona anche se l'utente non tocca nulla. */
export const DEFAULT_ASSUMPTIONS: AnalyticsAssumptions = {
  withdrawalRate: 0.035,
  annualSpending: null,
  annualSavings: null,
  expectedReturn: 0.04,
  volatility: 0.12,
  inflation: 0.02,
  retirementYears: 40,
  rule: "fissa",
  includePensionFunds: false,
  includeLatentTax: true,
  publicPension: null,
  terByInstrument: {},
};

/** Aggiornamento parziale: solo i campi inviati, ciascuno validato come nello schema completo. */
export const updateAssumptionsSchema = assumptionsSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Niente da aggiornare" });
export type UpdateAssumptionsInput = z.input<typeof updateAssumptionsSchema>;

/** Ipotesi salvate unite ai default; un campo salvato non più valido torna al suo default (mai un errore per l'utente). */
export function resolveAssumptions(stored: unknown): AnalyticsAssumptions {
  const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { ...DEFAULT_ASSUMPTIONS };
  for (const [key, schema] of Object.entries(assumptionsSchema.shape)) {
    if (!(key in raw)) continue;
    const parsed = schema.safeParse(raw[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result as AnalyticsAssumptions;
}

/** Quanti campi sono diversi tra due set di ipotesi (per l'evento di prodotto). */
export function countChangedFields(a: AnalyticsAssumptions, b: AnalyticsAssumptions): number {
  return (Object.keys(a) as (keyof AnalyticsAssumptions)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length;
}

/** Risposta di `GET /api/analytics/assumptions`. */
export interface AssumptionsResponse {
  assumptions: AnalyticsAssumptions;
  walkthroughSeen: boolean;
}
