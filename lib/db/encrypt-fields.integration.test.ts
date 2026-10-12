import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { client, db } from "./client";
import { accounts } from "./schema/accounts";
import { authUser } from "./schema/auth";
import { categories } from "./schema/categories";
import { transactions } from "./schema/transactions";
import { encryptColumn } from "./encrypt-fields";
import { isEncryptedField } from "../crypto/field-encryption";

const KEY = randomBytes(32);
const userId = randomUUID();

/** Valore così com'è nel database, senza passare dalla colonna cifrata. */
async function raw(id: string): Promise<{ description: string; note: string | null }> {
  const [row] = await client<{ description: string; note: string | null }[]>`select description, note from transactions where id = ${id}`;
  return row;
}

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(authUser).where(eq(authUser.id, userId));
});

describe("campi cifrati nel database", () => {
  it("righe vecchie in chiaro e nuove cifrate convivono, e la cifratura dei vecchi dati non cambia nulla per l'app", async () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", "");
    await db.insert(authUser).values({ id: userId, name: "Cifratura", email: `${userId}@example.test` });
    const [category] = await db.insert(categories).values({ userId, name: "Spesa", type: "voluta" }).returning();
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "corrente", balance: "0" }).returning();
    const base = { userId, accountId: account.id, categoryId: category.id, amount: "-12.50", date: "2026-10-01" };

    // Prima della chiave: si scrive in chiaro come oggi.
    const [legacy] = await db.insert(transactions).values({ ...base, description: "Esselunga Torino", note: "spesa sabato" }).returning();
    expect((await raw(legacy.id)).description).toBe("Esselunga Torino");

    // Con la chiave: la riga vecchia si legge uguale, la nuova è cifrata nel database ma l'app la legge in chiaro.
    vi.stubEnv("DATA_ENCRYPTION_KEY", KEY.toString("base64"));
    const [fresh] = await db.insert(transactions).values({ ...base, description: "Bonifico a Mario Rossi", note: null }).returning();
    expect(fresh.description).toBe("Bonifico a Mario Rossi");
    expect(isEncryptedField((await raw(fresh.id)).description)).toBe(true);
    const both = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(both.map((t) => t.description).sort()).toEqual(["Bonifico a Mario Rossi", "Esselunga Torino"]);

    // Prova: conta senza toccare.
    const ids = [legacy.id, fresh.id];
    const dry = await encryptColumn(client, { table: "transactions", column: "description" }, KEY, { execute: false, onlyIds: ids });
    expect(dry).toEqual({ pending: 1, encrypted: 0 });
    expect((await raw(legacy.id)).description).toBe("Esselunga Torino");

    // Cifratura dei dati vecchi: idempotente, e l'app continua a leggere gli stessi testi.
    await encryptColumn(client, { table: "transactions", column: "description" }, KEY, { execute: true, onlyIds: ids });
    await encryptColumn(client, { table: "transactions", column: "note" }, KEY, { execute: true, onlyIds: ids });
    const again = await encryptColumn(client, { table: "transactions", column: "description" }, KEY, { execute: true, onlyIds: ids });
    expect(again).toEqual({ pending: 0, encrypted: 0 });
    expect(isEncryptedField((await raw(legacy.id)).description)).toBe(true);
    expect(isEncryptedField((await raw(legacy.id)).note!)).toBe(true);
    expect((await raw(fresh.id)).note).toBeNull();
    const [reread] = await db.select().from(transactions).where(eq(transactions.id, legacy.id));
    expect(reread).toMatchObject({ description: "Esselunga Torino", note: "spesa sabato", updatedAt: legacy.updatedAt });
  });
});
