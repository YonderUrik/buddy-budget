/**
 * Migrazione one-shot e idempotente dell'enum Postgres `category_type` da fissa/variabile/entrata a
 * dovuta/voluta/futuro/saltuaria/entrata (vedi docs/superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md).
 * Legge i valori correnti da pg_enum ed esegue solo i passi mancanti; `ADD VALUE` gira fuori da transazioni.
 * Esecuzione: `pnpm db:migrate-category-groups`.
 */
import { client } from "./client";

/** Passi SQL necessari a partire dai valori enum attuali (vuoto se la migrazione è già stata applicata). */
export function categoryEnumMigrationSteps(labels: string[]): string[] {
  const has = new Set(labels);
  const steps: string[] = [];
  if (has.has("fissa") && !has.has("dovuta")) {
    steps.push(`ALTER TYPE category_type RENAME VALUE 'fissa' TO 'dovuta'`);
  }
  if (has.has("variabile") && !has.has("voluta")) {
    steps.push(`ALTER TYPE category_type RENAME VALUE 'variabile' TO 'voluta'`);
  }
  if (!has.has("futuro")) {
    steps.push(`ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'`);
  }
  if (!has.has("saltuaria")) {
    steps.push(`ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'`);
  }
  return steps;
}

async function main() {
  const rows = await client.unsafe(
    `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_type' order by e.enumsortorder`
  );
  const labels = rows.map((row) => String(row.enumlabel));
  console.log("Valori attuali:", labels);

  const steps = categoryEnumMigrationSteps(labels);
  if (steps.length === 0) console.log("Nessun passo da eseguire: enum già migrato.");
  for (const step of steps) {
    console.log("→", step);
    await client.unsafe(step);
  }

  const after = await client.unsafe(
    `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_type' order by e.enumsortorder`
  );
  console.log("Valori finali:", after.map((row) => String(row.enumlabel)));
  await client.end();
}

if (process.argv[1]?.includes("migrate-category-groups")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
