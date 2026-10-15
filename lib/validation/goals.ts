import { z } from "zod";
import { GOAL_KINDS, MAX_GOAL_SOURCES } from "@/lib/goals/constants";

const name = z.string().trim().min(1, "Dai un nome all'obiettivo").max(80, "Il nome è troppo lungo");
const money = z.number().finite().min(0, "L'importo non può essere negativo").max(100_000_000, "L'importo è troppo alto");
/** Mese dell'obiettivo: si salva sempre il primo giorno. */
const targetMonth = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Data non valida")
  .transform((v) => `${v.slice(0, 7)}-01`);

/** Una parte di un conto o di un titolo: esattamente uno dei due id. */
export const goalSourceInputSchema = z
  .object({
    accountId: z.uuid().nullable().optional(),
    instrumentId: z.uuid().nullable().optional(),
    amount: money.refine((v) => v > 0, "Indica quanto assegnare"),
  })
  .refine((s) => Boolean(s.accountId) !== Boolean(s.instrumentId), "Scegli un conto o un titolo");

const sources = z.array(goalSourceInputSchema).max(MAX_GOAL_SOURCES, `Al massimo ${MAX_GOAL_SOURCES} fonti per obiettivo`);

/** Nuovo obiettivo: tipo, nome, cifra, data facoltativa, quota mensile, fonti e posizione in lista (in fondo se manca). */
export const createGoalSchema = z.object({
  name,
  kind: z.enum(GOAL_KINDS),
  targetAmount: money.refine((v) => v > 0, "Indica quanto vuoi mettere da parte"),
  targetDate: targetMonth.nullable().optional(),
  monthlyAmount: money.default(0),
  priority: z.number().int().min(0).max(100).optional(),
  sources: sources.default([]),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/** Modifica parziale; `sources`, se presente, sostituisce tutte le parti assegnate. `achieved` segna o riapre. */
export const updateGoalSchema = z
  .object({
    name,
    kind: z.enum(GOAL_KINDS),
    targetAmount: money.refine((v) => v > 0, "Indica quanto vuoi mettere da parte"),
    targetDate: targetMonth.nullable(),
    monthlyAmount: money,
    sources,
    achieved: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Niente da aggiornare");
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

/** Nuovo ordine di priorità: tutti gli id degli obiettivi dell'utente, dal primo all'ultimo. */
export const reorderGoalsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });
