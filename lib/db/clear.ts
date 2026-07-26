import { client } from "./client";

async function main() {
  console.log("Recupero delle tabelle del database...");
  const rows = await client.unsafe(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name != '__drizzle_migrations'"
  );

  if (rows.length === 0) {
    console.log("Il database è già vuoto o non sono presenti tabelle da svuotare.");
    await client.end();
    return;
  }

  const tableNames = rows.map((row) => `"${row.table_name}"`).join(", ");
  console.log(`Svuotamento delle tabelle: ${tableNames}`);

  // Esegue il truncate a cascata su tutte le tabelle trovate
  await client.unsafe(`truncate table ${tableNames} cascade`);
  console.log("Database svuotato con successo.");
  await client.end();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Errore durante lo svuotamento del database:", error);
    process.exit(1);
  });
