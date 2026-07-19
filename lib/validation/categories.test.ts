import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS, createCategorySchema, updateCategorySchema } from "./categories";

describe("CATEGORY_ICONS", () => {
  it("ha 28 icone", () => {
    expect(CATEGORY_ICONS).toHaveLength(28);
  });

  it("non ha duplicati", () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });
});

describe("createCategorySchema", () => {
  it("accetta nome/tipo validi senza icona/colore (opzionali)", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile" });
    expect(result.success).toBe(true);
  });

  it("accetta icona/colore validi", () => {
    const result = createCategorySchema.safeParse({
      name: "Palestra",
      type: "variabile",
      icon: "dumbbell",
      color: "teal",
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta nome vuoto", () => {
    const result = createCategorySchema.safeParse({ name: "  ", type: "variabile" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un tipo non valido", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "annuale" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'icona fuori enum", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile", icon: "bitcoin" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un colore fuori enum", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile", color: "pink" });
    expect(result.success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("rifiuta un body vuoto", () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accetta un solo campo (rename)", () => {
    const result = updateCategorySchema.safeParse({ name: "Nuovo nome" });
    expect(result.success).toBe(true);
  });
});

describe("CATEGORY_COLORS", () => {
  it("ha 8 colori (stessa palette dei conti)", () => {
    expect(CATEGORY_COLORS).toHaveLength(8);
  });
});
