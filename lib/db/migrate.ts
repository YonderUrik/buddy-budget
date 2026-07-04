import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./client";

async function main() {
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });

  const tables = await client.unsafe(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  console.log(
    "Tabelle presenti:",
    tables.map((row) => row.table_name)
  );

  await client.end();
}

main()
  .then(() => {
    console.log("Migration completate.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
