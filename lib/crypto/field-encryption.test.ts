import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { dataEncryptionKey, decryptField, encryptField, ENCRYPTED_PREFIX, isEncryptedField, openFromDb, sealForDb } from "./field-encryption";

const KEY = randomBytes(32);
const original = process.env.DATA_ENCRYPTION_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = original;
});

describe("field encryption", () => {
  it("cifra e decifra, con un IV diverso ogni volta", () => {
    const a = encryptField("Pagamento POS Esselunga", KEY);
    const b = encryptField("Pagamento POS Esselunga", KEY);
    expect(a.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Esselunga");
    expect(decryptField(a, KEY)).toBe("Pagamento POS Esselunga");
  });

  it("lascia passare i valori in chiaro già nel database", () => {
    expect(decryptField("vecchio testo", KEY)).toBe("vecchio testo");
    expect(decryptField("vecchio testo", null)).toBe("vecchio testo");
  });

  it("non cifra due volte", () => {
    const once = encryptField("x", KEY);
    expect(encryptField(once, KEY)).toBe(once);
  });

  it("si ferma se manca la chiave o è sbagliata", () => {
    const sealed = encryptField("nota", KEY);
    expect(() => decryptField(sealed, null)).toThrow();
    expect(() => decryptField(sealed, randomBytes(32))).toThrow();
  });

  it("senza chiave scrive in chiaro come prima", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(sealForDb("nota")).toBe("nota");
  });

  it("con la chiave scrive cifrato e rilegge il testo", () => {
    process.env.DATA_ENCRYPTION_KEY = KEY.toString("base64");
    const stored = sealForDb("Bonifico a Mario");
    expect(isEncryptedField(stored)).toBe(true);
    expect(openFromDb(stored)).toBe("Bonifico a Mario");
  });

  it("rifiuta una chiave della lunghezza sbagliata", () => {
    expect(() => dataEncryptionKey({ DATA_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toThrow();
  });

  it("conserva testo con accenti ed emoji", () => {
    const text = "Caffè ☕ e brioche — €2,50";
    expect(decryptField(encryptField(text, KEY), KEY)).toBe(text);
  });
});
