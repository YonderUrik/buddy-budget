import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import { ENCRYPTED_COLUMNS } from "./encrypt-fields";

/** Tutte le colonne dichiarate con `encryptedText` nello schema. */
function encryptedColumnsInSchema(): string[] {
  const found: string[] = [];
  for (const value of Object.values(schema)) {
    if (!value || typeof value !== "object" || !(Symbol.for("drizzle:IsDrizzleTable") in value)) continue;
    const config = getTableConfig(value as PgTable);
    for (const column of config.columns) {
      if (column.columnType === "PgCustomColumn" && column.getSQLType() === "text") found.push(`${config.name}.${column.name}`);
    }
  }
  return found.sort();
}

describe("encrypt-fields", () => {
  it("elenca tutte e sole le colonne cifrate dello schema", () => {
    expect(ENCRYPTED_COLUMNS.map((c) => `${c.table}.${c.column}`).sort()).toEqual(encryptedColumnsInSchema());
  });
});
