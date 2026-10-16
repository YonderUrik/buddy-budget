/**
 * Cifra le righe ancora in chiaro delle colonne `encryptedText` (vedi `lib/crypto/field-encryption.ts`).
 * Idempotente e riprendibile: tocca solo i valori senza prefisso `enc:v1:`, a blocchi, e aggiorna una riga solo se il
 * valore non è cambiato nel frattempo. Non modifica `updated_at`. Di default è una prova (conta e basta):
 *
 *   pnpm db:encrypt-fields            # quante righe sono ancora in chiaro
 *   pnpm db:encrypt-fields --execute  # le cifra
 *
 * Richiede DATABASE_URL e DATA_ENCRYPTION_KEY (la stessa dell'app: con un'altra chiave i dati non si rileggerebbero).
 */
import postgres from "postgres";
import { dataEncryptionKey, encryptField, ENCRYPTED_PREFIX } from "../crypto/field-encryption";
import { resolveDbSsl } from "./ssl";

/** Colonne cifrate: tenerle allineate alle `encryptedText(...)` dello schema (lo controlla `encrypt-fields.test.ts`). */
export const ENCRYPTED_COLUMNS: readonly { table: string; column: string }[] = [
  { table: "transactions", column: "description" },
  { table: "transactions", column: "raw_description" },
  { table: "transactions", column: "note" },
  { table: "debt_events", column: "note" },
  { table: "investment_transactions", column: "note" },
  { table: "investment_tax_carryforwards", column: "note" },
  { table: "gocardless_token", column: "access_token" },
  { table: "goals", column: "name" },
  { table: "import_format_profiles", column: "metadata" },
];

const BATCH_SIZE = 500;

/**
 * Conta (prova) o cifra (execute) i valori in chiaro di una colonna. `onlyIds` limita il lavoro a quelle righe (test).
 * Restituisce quante righe erano in chiaro e quante sono state cifrate.
 */
export async function encryptColumn(
  sql: postgres.Sql,
  target: { table: string; column: string },
  key: Buffer,
  options: { execute: boolean; onlyIds?: readonly string[]; onProgress?: (done: number, pending: number) => void },
): Promise<{ pending: number; encrypted: number }> {
  const { table, column } = target;
  const pattern = `${ENCRYPTED_PREFIX}%`;
  const scope = options.onlyIds ? sql`and id::text in ${sql(options.onlyIds as string[])}` : sql``;
  const [{ pending }] = await sql<{ pending: number }[]>`
    select count(*)::int as pending from ${sql(table)} where ${sql(column)} is not null and ${sql(column)} not like ${pattern} ${scope}`;
  if (!options.execute || pending === 0) return { pending, encrypted: 0 };
  let encrypted = 0;
  for (;;) {
    const rows = await sql<{ id: string; value: string }[]>`
      select id::text as id, ${sql(column)} as value from ${sql(table)}
      where ${sql(column)} is not null and ${sql(column)} not like ${pattern} ${scope}
      limit ${BATCH_SIZE}`;
    if (rows.length === 0) break;
    await sql.begin(async (tx) => {
      for (const row of rows) {
        // Aggiorna solo se nessuno ha cambiato il valore nel frattempo (l'app può scrivere mentre lo script gira).
        await tx`update ${sql(table)} set ${sql(column)} = ${encryptField(row.value, key)}
          where id::text = ${row.id} and ${sql(column)} = ${row.value}`;
      }
    });
    encrypted += rows.length;
    options.onProgress?.(encrypted, pending);
  }
  return { pending, encrypted };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non è definita");
  const key = dataEncryptionKey();
  if (!key) throw new Error("DATA_ENCRYPTION_KEY non è impostata: niente da cifrare");
  const ssl = resolveDbSsl(url, process.env.NODE_ENV);
  const sql = postgres(url, { max: 1, ...(ssl ? { ssl } : {}) });
  try {
    for (const target of ENCRYPTED_COLUMNS) {
      const label = `${target.table}.${target.column}`;
      const { pending, encrypted } = await encryptColumn(sql, target, key, { execute, onProgress: (done, total) => console.log(`${label}: ${done}/${total}`) });
      console.log(execute ? `${label}: ${encrypted} cifrate su ${pending} in chiaro` : `${label}: ${pending} in chiaro`);
    }
    if (!execute) console.log("Prova: nessuna riga modificata. Rilancia con --execute per cifrare.");
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("encrypt-fields.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
