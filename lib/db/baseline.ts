/** Cartella delle migration Drizzle (stesso valore di `out` in drizzle.config.ts). */
export const MIGRATIONS_FOLDER = "./lib/db/migrations";

/**
 * Decide se registrare la baseline come già applicata. Il migrator Drizzle applica solo le migration
 * con `when` maggiore del `created_at` più alto registrato, quindi basta una riga col `when` della baseline.
 */
export function planBaselineMark(existingCreatedAts: number[], baselineWhen: number): "insert" | "already-marked" {
  return existingCreatedAts.includes(baselineWhen) ? "already-marked" : "insert";
}
