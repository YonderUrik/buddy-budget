import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL non è definita. Copia .env.local.example in .env.local.");
}

// La cifratura della connessione la decide l'URL (`?sslmode=require` per Neon/CNPG, assente per il Postgres
// locale): un `ssl` esplicito qui vincerebbe sull'URL e impedirebbe di usare un Postgres locale senza TLS
// anche con NODE_ENV=production (es. il container Docker in prova).
export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
