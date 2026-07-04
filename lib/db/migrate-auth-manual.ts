/**
 * Script di migrazione manuale: applica lo schema auth al database Neon.
 * Eseguire con: tsx --env-file=.env.local lib/db/migrate-auth-manual.ts
 *
 * Questo script sostituisce `drizzle-kit push` per ambienti non-TTY (CI, subagent).
 * Operazioni:
 * 1. Rileva i FK constraint esistenti e li rimuove
 * 2. Elimina la tabella `users` (vecchio schema data-model-base)
 * 3. Crea le 4 tabelle auth_* (auth_user, auth_session, auth_account, auth_verification)
 * 4. Modifica user_id da uuid a text nelle tabelle di dominio
 * 5. Ricrea i FK constraint verso auth_user.id
 * 6. Ricrea l'indice transactions_user_date_idx
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL non è definita.");
}

const sql = postgres(connectionString, { ssl: "require" });

async function run() {
  console.log("=== Migrazione auth schema ===\n");

  // Step 1: Rileva e rimuovi FK constraints esistenti verso `users`
  console.log("1. Ricerca FK constraints che referenziano 'users'...");
  const fkConstraints = await sql`
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.table_constraints AS ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'users'
      AND tc.constraint_type = 'FOREIGN KEY'
  `;

  if (fkConstraints.length > 0) {
    console.log(`   Trovati ${fkConstraints.length} FK constraints da rimuovere:`);
    for (const fk of fkConstraints) {
      console.log(`   - DROP CONSTRAINT ${fk.constraint_name} ON ${fk.table_name}`);
      await sql`ALTER TABLE ${sql(fk.table_name)} DROP CONSTRAINT IF EXISTS ${sql(fk.constraint_name)}`;
    }
  } else {
    console.log("   Nessun FK constraint verso 'users' trovato.");
  }

  // Step 2: Elimina la tabella users se esiste
  console.log("\n2. Eliminazione tabella 'users'...");
  const usersExists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'users' AND table_schema = 'public'
  `;
  if (usersExists.length > 0) {
    await sql`DROP TABLE users CASCADE`;
    console.log("   Tabella 'users' eliminata.");
  } else {
    console.log("   Tabella 'users' non trovata, skip.");
  }

  // Step 3: Crea le tabelle auth_*
  console.log("\n3. Creazione tabelle auth_*...");

  await sql`
    CREATE TABLE IF NOT EXISTS auth_user (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      email_verified boolean NOT NULL DEFAULT false,
      image text,
      currency text NOT NULL DEFAULT 'EUR',
      onboarding_completed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   auth_user creata.");

  await sql`
    CREATE TABLE IF NOT EXISTS auth_session (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      ip_address text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   auth_session creata.");

  await sql`
    CREATE TABLE IF NOT EXISTS auth_account (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      access_token text,
      refresh_token text,
      id_token text,
      expires_at timestamptz,
      password text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   auth_account creata.");

  await sql`
    CREATE TABLE IF NOT EXISTS auth_verification (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("   auth_verification creata.");

  // Step 4: Rimuovi i FK constraint verso auth_user (se esistono già da run precedente)
  // poi modifica user_id da uuid a text nelle tabelle di dominio
  console.log("\n4. Modifica user_id (uuid → text) nelle tabelle di dominio...");

  const domainTables = ["categories", "accounts", "transactions", "budgets"];

  for (const table of domainTables) {
    // Controlla se la tabella esiste
    const tableExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = ${table} AND table_schema = 'public'
    `;
    if (tableExists.length === 0) {
      console.log(`   Tabella ${table} non trovata, skip.`);
      continue;
    }

    // Controlla il tipo attuale di user_id
    const colInfo = await sql`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = 'user_id' AND table_schema = 'public'
    `;

    if (colInfo.length === 0) {
      console.log(`   ${table}.user_id non trovata, skip.`);
      continue;
    }

    const currentType = colInfo[0].udt_name;
    console.log(`   ${table}.user_id tipo attuale: ${currentType}`);

    // Rimuovi FK constraints esistenti su user_id per questa tabella
    const existingFks = await sql`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = ${table}
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
    `;
    for (const fk of existingFks) {
      console.log(`   Rimozione FK ${fk.constraint_name} da ${table}...`);
      await sql`ALTER TABLE ${sql(table)} DROP CONSTRAINT IF EXISTS ${sql(fk.constraint_name)}`;
    }

    // Altera il tipo se non è già text
    if (currentType !== "text") {
      console.log(`   ALTER TABLE ${table} ALTER COLUMN user_id TYPE text...`);
      await sql`ALTER TABLE ${sql(table)} ALTER COLUMN user_id TYPE text USING user_id::text`;
    } else {
      console.log(`   ${table}.user_id è già text, skip.`);
    }
  }

  // Step 4b: Svuota le tabelle di dominio (dev DB — nessun dato reale da preservare)
  // I vecchi UUID non hanno corrispondenza in auth_user, quindi sarebbero FK violation.
  console.log("\n4b. Pulizia dati orfani nelle tabelle di dominio...");
  // Ordine: prima le dipendenti (transactions/budgets), poi categories/accounts
  const truncateOrder = ["budgets", "transactions", "accounts", "categories"];
  for (const table of truncateOrder) {
    const tableExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = ${table} AND table_schema = 'public'
    `;
    if (tableExists.length > 0) {
      const countResult = await sql`SELECT count(*) as cnt FROM ${sql(table)}`;
      const cnt = countResult[0].cnt;
      if (Number(cnt) > 0) {
        console.log(`   TRUNCATE ${table} (${cnt} righe da rimuovere)...`);
        await sql`TRUNCATE TABLE ${sql(table)} CASCADE`;
      } else {
        console.log(`   ${table} già vuota.`);
      }
    }
  }

  // Step 5: Ricrea i FK constraints verso auth_user
  console.log("\n5. Ricreazione FK constraints verso auth_user...");

  const fkMappings = [
    { table: "categories", constraint: "categories_user_id_auth_user_id_fk" },
    { table: "accounts", constraint: "accounts_user_id_auth_user_id_fk" },
    { table: "transactions", constraint: "transactions_user_id_auth_user_id_fk" },
    { table: "budgets", constraint: "budgets_user_id_auth_user_id_fk" },
  ];

  for (const { table, constraint } of fkMappings) {
    const tableExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = ${table} AND table_schema = 'public'
    `;
    if (tableExists.length === 0) {
      console.log(`   Tabella ${table} non trovata, skip.`);
      continue;
    }

    // Verifica se il constraint esiste già
    const constraintExists = await sql`
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = ${constraint} AND table_name = ${table}
    `;
    if (constraintExists.length > 0) {
      console.log(`   ${constraint} già presente, skip.`);
      continue;
    }

    console.log(`   ADD CONSTRAINT ${constraint}...`);
    await sql`
      ALTER TABLE ${sql(table)}
      ADD CONSTRAINT ${sql(constraint)}
      FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
    `;
  }

  // Step 6: Ricrea l'indice
  console.log("\n6. Ricreazione indice transactions_user_date_idx...");
  const transactionsExists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'transactions' AND table_schema = 'public'
  `;
  if (transactionsExists.length > 0) {
    await sql`DROP INDEX IF EXISTS transactions_user_date_idx`;
    await sql`CREATE INDEX transactions_user_date_idx ON transactions(user_id, date)`;
    console.log("   Indice transactions_user_date_idx ricreato.");
  }

  // Step 7: Verifica finale
  console.log("\n7. Verifica tabelle presenti...");
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const tableNames = tables.map((t: { table_name: string }) => t.table_name);
  console.log("   Tabelle trovate:", tableNames.join(", "));

  const authTables = ["auth_user", "auth_session", "auth_account", "auth_verification"];
  const allPresent = authTables.every((t) => tableNames.includes(t));
  if (allPresent) {
    console.log("\n✓ Tutti i 4 auth_* table presenti.");
  } else {
    const missing = authTables.filter((t) => !tableNames.includes(t));
    console.error("\n✗ Tabelle mancanti:", missing.join(", "));
    process.exit(1);
  }

  await sql.end();
  console.log("\n=== Migrazione completata con successo ===");
}

run().catch((err) => {
  console.error("Errore durante la migrazione:", err);
  process.exit(1);
});
