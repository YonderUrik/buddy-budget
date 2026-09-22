import { describe, expect, it } from "vitest";
import { categoryEnumMigrationSteps } from "./migrate-category-groups";

describe("categoryEnumMigrationSteps", () => {
  it("dal vecchio enum rinomina due valori e ne aggiunge due prima di 'entrata'", () => {
    expect(categoryEnumMigrationSteps(["fissa", "variabile", "entrata"])).toEqual([
      "ALTER TYPE category_type RENAME VALUE 'fissa' TO 'dovuta'",
      "ALTER TYPE category_type RENAME VALUE 'variabile' TO 'voluta'",
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'",
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'",
    ]);
  });

  it("è un no-op sull'enum già migrato", () => {
    expect(categoryEnumMigrationSteps(["dovuta", "voluta", "futuro", "saltuaria", "entrata"])).toEqual([]);
  });

  it("riprende da una migrazione interrotta a metà", () => {
    expect(categoryEnumMigrationSteps(["dovuta", "voluta", "entrata"])).toEqual([
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'",
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'",
    ]);
  });
});
