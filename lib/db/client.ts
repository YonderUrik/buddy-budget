import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDbSsl } from "./ssl";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL non è definita. Copia .env.local.example in .env.local.");
}

const ssl = resolveDbSsl(connectionString, process.env.NODE_ENV);
// La chiave va omessa quando è undefined: postgres.js controlla `'ssl' in options` e un valore esplicito vincerebbe sull'URL.
export const client = postgres(connectionString, ssl ? { ssl } : {});
export const db = drizzle(client, { schema });
