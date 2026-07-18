import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL non è definita. Copia .env.local.example in .env.local.");
}

export const client = postgres(connectionString, { ssl: process.env.NODE_ENV === "production" ? "require" : false });
export const db = drizzle(client, { schema });
