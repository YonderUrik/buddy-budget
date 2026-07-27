import { describe, expect, it } from "vitest";
import { createTransactionSchema, updateTransactionSchema } from "./transactions";

describe("createTransactionSchema", () => {
  it("accetta un input valido", () => {
    const result = createTransactionSchema.safeParse({
      accountId: crypto.randomUUID(),
      description: "Spesa alimentare",
      categoryId: crypto.randomUUID(),
      amount: 42.5,
      date: "2026-02-10",
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta un importo non positivo", () => {
    const result = createTransactionSchema.safeParse({
      accountId: crypto.randomUUID(),
      description: "Spesa",
      categoryId: crypto.randomUUID(),
      amount: 0,
      date: "2026-02-10",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta una data malformata", () => {
    const result = createTransactionSchema.safeParse({
      accountId: crypto.randomUUID(),
      description: "Spesa",
      categoryId: crypto.randomUUID(),
      amount: 10,
      date: "10-02-2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  it("accetta un aggiornamento parziale con un solo campo", () => {
    const result = updateTransactionSchema.safeParse({ categoryId: crypto.randomUUID() });
    expect(result.success).toBe(true);
  });

  it("rifiuta un oggetto vuoto", () => {
    const result = updateTransactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accetta excludedAmount come numero non negativo", () => {
    const result = updateTransactionSchema.safeParse({ excludedAmount: 12.3 });
    expect(result.success).toBe(true);
  });

  it("accetta una nota valida", () => {
    const result = updateTransactionSchema.safeParse({ note: "Regalo compleanno di Marco" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Regalo compleanno di Marco");
    }
  });

  it("normalizza una nota vuota (dopo trim) a null", () => {
    const result = updateTransactionSchema.safeParse({ note: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("accetta esplicitamente null per cancellare la nota", () => {
    const result = updateTransactionSchema.safeParse({ note: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("rifiuta una nota oltre 500 caratteri", () => {
    const result = updateTransactionSchema.safeParse({ note: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
});
