import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { client } from "./client";
import { MIGRATIONS_FOLDER, planBaselineMark } from "./baseline";

interface Journal {
  entries: { idx: number; when: number; tag: string }[];
}

/**
 * Registra la baseline (prima migration del journal) come già applicata su un DB esistente,
 * il cui schema è stato verificato uguale alla baseline. Rilanciabile. Su un DB vuoto si rifiuta:
 * lì va usato `pnpm db:migrate`.
 */
async function main() {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")) as Journal;
  const baseline = journal.entries[0];
  const migrationSql = readFileSync(path.join(MIGRATIONS_FOLDER, `${baseline.tag}.sql`)).toString();
  // Stesso hash che calcola il migrator Drizzle (sha256 del file), per coerenza della tabella.
  const hash = createHash("sha256").update(migrationSql).digest("hex");

  const [{ exists }] = await client<{ exists: boolean }[]>`select to_regclass('public.transactions') is not null as exists`;
  if (!exists) {
    throw new Error("Il DB non contiene lo schema applicativo: usa `pnpm db:migrate`, non la baseline.");
  }

  await client`create schema if not exists drizzle`;
  await client`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  const rows = await client<{ created_at: string }[]>`select created_at from drizzle.__drizzle_migrations`;

  if (planBaselineMark(rows.map((row) => Number(row.created_at)), baseline.when) === "already-marked") {
    console.log(`Baseline ${baseline.tag} già registrata: nulla da fare.`);
    return;
  }
  await client`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${baseline.when})`;
  console.log(`Baseline ${baseline.tag} registrata come già applicata.`);
}

main()
  .then(() => client.end())
  .catch(async (error) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
