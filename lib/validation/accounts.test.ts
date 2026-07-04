import { describe, expect, it } from "vitest";
import { createAccountSchema, parseAmount, updateAccountSchema } from "./accounts";

describe("parseAmount", () => {
  it("accetta il punto come separatore decimale", () => {
    expect(parseAmount("1234.56")).toBe(1234.56);
  });

  it("accetta la virgola come separatore decimale", () => {
    expect(parseAmount("1234,56")).toBe(1234.56);
  });

  it("accetta valori negativi", () => {
    expect(parseAmount("-50")).toBe(-50);
  });

  it("ritorna null per stringa vuota", () => {
    expect(parseAmount("")).toBeNull();
  });

  it("ritorna null per input non numerico", () => {
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("createAccountSchema", () => {
  it("accetta un input valido", () => {
    const result = createAccountSchema.safeParse({
      name: "Conto corrente",
      institution: "Banca Nazionale",
      type: "Conto corrente",
      balance: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta un nome vuoto", () => {
    const result = createAccountSchema.safeParse({
      name: "",
      type: "Conto corrente",
      balance: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un tipo vuoto", () => {
    const result = createAccountSchema.safeParse({
      name: "Conto corrente",
      type: "",
      balance: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accetta l'assenza di institution (opzionale)", () => {
    const result = createAccountSchema.safeParse({
      name: "Contanti",
      type: "Contanti",
      balance: 50,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateAccountSchema", () => {
  it("accetta un aggiornamento parziale con un solo campo", () => {
    const result = updateAccountSchema.safeParse({ balance: 500 });
    expect(result.success).toBe(true);
  });

  it("rifiuta un oggetto vuoto", () => {
    const result = updateAccountSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rifiuta un nome vuoto se presente", () => {
    const result = updateAccountSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
