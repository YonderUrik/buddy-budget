import { z } from "zod";
import { PENSION_IMPORT_MAX_ROWS } from "@/lib/pension/limits";

/** Lunghezza massima del nome di un fondo. */
export const PENSION_NAME_MAX_LENGTH = 80;
/** Importo massimo accettato per contributi e controvalore. */
const PENSION_MAX_AMOUNT = 1e8;
/** Anno minimo plausibile per l'adesione a una forma pensionistica. */
const PENSION_MIN_YEAR = 1950;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
const amount = z.number().finite("Importo non valido").min(0, "L'importo non può essere negativo").max(PENSION_MAX_AMOUNT, "Importo troppo alto");
const name = z.string().trim().min(1, "Il nome è obbligatorio").max(PENSION_NAME_MAX_LENGTH);

/** Data valida non nel futuro (tolleranza di un giorno per i fusi) e non anteriore al 1950. */
export function isPlausiblePensionDate(value: string, todayKey: string): boolean {
  const day = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) return false;
  if (Number(value.slice(0, 4)) < PENSION_MIN_YEAR) return false;
  const limit = new Date(`${todayKey}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 1);
  return day <= limit;
}

export const createPensionFundSchema = z.object({ name, adhesionDate: dateKey });
export type CreatePensionFundInput = z.input<typeof createPensionFundSchema>;

export const updatePensionFundSchema = z
  .object({ name: name.optional(), adhesionDate: dateKey.optional() })
  .refine((v) => v.name !== undefined || v.adhesionDate !== undefined, { message: "Niente da aggiornare" });
export type UpdatePensionFundInput = z.input<typeof updatePensionFundSchema>;

export const createPensionSnapshotSchema = z.object({ date: dateKey, netContributions: amount, value: amount });
export type CreatePensionSnapshotInput = z.input<typeof createPensionSnapshotSchema>;

/** Import di fotografie da file: righe già lette dal client (il file non arriva mai al server). */
export const importPensionSnapshotsSchema = z.object({
  format: z.enum(["csv", "xlsx", "incollato"]),
  rows: z
    .array(z.object({ line: z.number().int().min(1), date: dateKey, netContributions: amount, value: amount }))
    .min(1, "Nessuna riga da importare")
    .max(PENSION_IMPORT_MAX_ROWS, `Al massimo ${PENSION_IMPORT_MAX_ROWS} righe per import`),
});
export type ImportPensionSnapshotsInput = z.input<typeof importPensionSnapshotsSchema>;
