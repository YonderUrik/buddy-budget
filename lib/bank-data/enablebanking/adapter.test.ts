import { describe, expect, it } from "vitest";
import {
  consentDaysFor,
  enableBankingInstitutionId,
  normalizeEnableBankingTransactions,
  parseEnableBankingInstitutionId,
  pickBalance,
  transactionsDateFrom,
} from "./adapter";
import type { EnableBankingTransaction } from "./client";

function tx(overrides: Partial<EnableBankingTransaction>): EnableBankingTransaction {
  return {
    transaction_amount: { amount: "10.00", currency: "EUR" },
    credit_debit_indicator: "DBIT",
    status: "BOOK",
    booking_date: "2026-10-01",
    ...overrides,
  };
}

describe("normalizeEnableBankingTransactions", () => {
  it("mette il segno dall'indicatore, tiene solo i contabilizzati e prefissa l'id", () => {
    const records = normalizeEnableBankingTransactions([
      tx({ entry_reference: "a", creditor: { name: " Esselunga " }, debtor: { name: "Io" }, remittance_information: ["PAGAMENTO POS", " ESSELUNGA "] }),
      tx({ transaction_id: "b", credit_debit_indicator: "CRDT", transaction_amount: { amount: "1500.00", currency: "EUR" }, debtor: { name: "Datore" } }),
      tx({ entry_reference: "c", status: "PDNG" }),
      tx({ entry_reference: "d", status: undefined, booking_date: null, value_date: "2026-10-02T00:00:00Z", merchant_category_code: "5411" }),
    ]);

    expect(records).toEqual([
      { externalId: "eb:a", amount: "-10.00", bookingDate: "2026-10-01", rawDescription: "PAGAMENTO POS ESSELUNGA", counterpartyName: "Esselunga", merchantCategoryCode: undefined },
      { externalId: "eb:b", amount: "1500.00", bookingDate: "2026-10-01", rawDescription: null, counterpartyName: "Datore", merchantCategoryCode: undefined },
      { externalId: "eb:d", amount: "-10.00", bookingDate: "2026-10-02", rawDescription: null, counterpartyName: undefined, merchantCategoryCode: "5411" },
    ]);
  });

  it("senza id della banca usa un'impronta stabile che distingue i movimenti identici", () => {
    const coffee = tx({ remittance_information: ["Bar"], transaction_amount: { amount: "1.20", currency: "EUR" } });
    const first = normalizeEnableBankingTransactions([coffee, coffee]);
    const again = normalizeEnableBankingTransactions([coffee, coffee]);

    expect(first[0].externalId).toMatch(/^eb:h:[0-9a-f]{32}$/);
    expect(first[0].externalId).not.toBe(first[1].externalId);
    expect(again.map((r) => r.externalId)).toEqual(first.map((r) => r.externalId));
  });
});

describe("helper Enable Banking", () => {
  it("id della banca andata e ritorno", () => {
    const id = enableBankingInstitutionId({ country: "IT", name: "Intesa Sanpaolo" });
    expect(id).toBe("IT:Intesa Sanpaolo");
    expect(parseEnableBankingInstitutionId(id)).toEqual({ country: "IT", name: "Intesa Sanpaolo" });
    expect(parseEnableBankingInstitutionId("INTESA_SANPAOLO_BCITITMM")).toBeNull();
  });

  it("durata del consenso: il massimo della banca, mai oltre 180 giorni, 90 se non si sa", () => {
    expect(consentDaysFor({ maximum_consent_validity: 180 * 86_400 })).toBe(180);
    expect(consentDaysFor({ maximum_consent_validity: 365 * 86_400 })).toBe(180);
    expect(consentDaysFor({ maximum_consent_validity: 90 * 86_400 + 100 })).toBe(90);
    expect(consentDaysFor(undefined)).toBe(90);
  });

  it("saldo: disponibile prima del contabile, altrimenti il primo", () => {
    const clbd = { balance_type: "CLBD", balance_amount: { amount: "1", currency: "EUR" } };
    const itav = { balance_type: "ITAV", balance_amount: { amount: "2", currency: "EUR" } };
    const other = { balance_type: "XYZ", balance_amount: { amount: "3", currency: "EUR" } };
    expect(pickBalance([clbd, itav])).toBe(itav);
    expect(pickBalance([other, clbd])).toBe(clbd);
    expect(pickBalance([other])).toBe(other);
    expect(pickBalance([])).toBeUndefined();
  });

  it("i movimenti si rileggono 30 giorni prima dell'ultimo sync", () => {
    expect(transactionsDateFrom(null)).toBeNull();
    expect(transactionsDateFrom(new Date("2026-10-10T08:00:00Z"))).toBe("2026-09-10");
  });
});
