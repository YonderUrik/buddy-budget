import { describe, expect, it } from "vitest";
import { formatCurrency, formatRelativeTime, formatShortDate, getCurrencySymbol } from "./format";

describe("formatCurrency", () => {
  it("formatta un valore positivo nella valuta indicata", () => {
    expect(formatCurrency(1234.5, "EUR")).toBe("1234,50 €");
  });

  it("rispetta maximumFractionDigits quando specificato", () => {
    expect(formatCurrency(1234.5, "EUR", { maximumFractionDigits: 0 })).toBe("1235 €");
  });

  it("supporta valute diverse da EUR", () => {
    expect(formatCurrency(10, "USD")).toBe("10,00 USD");
  });
});

describe("getCurrencySymbol", () => {
  it("restituisce € per EUR con locale it-IT", () => {
    expect(getCurrencySymbol("EUR", "it-IT")).toBe("€");
  });

  it("restituisce $ per USD con locale en-US", () => {
    expect(getCurrencySymbol("USD", "en-US")).toBe("$");
  });

  it("usa it-IT come default locale", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");

  it("restituisce 'adesso' per meno di un minuto fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 30_000), now)).toBe("adesso");
  });

  it("restituisce i minuti per meno di un'ora fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 min fa");
  });

  it("restituisce le ore per meno di un giorno fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60_000), now)).toBe("3 h fa");
  });

  it("restituisce i giorni per meno di 7 giorni fa", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 24 * 60 * 60_000), now)).toBe("2 giorni fa");
  });

  it("restituisce una data assoluta breve oltre i 7 giorni", () => {
    const past = new Date(now.getTime() - 10 * 24 * 60 * 60_000);
    const expected = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(past);
    expect(formatRelativeTime(past, now)).toBe(expected);
  });
});

describe("formatShortDate", () => {
  it("formatta una data calendario in forma breve", () => {
    expect(formatShortDate("2026-09-26")).toBe("26 set");
    expect(formatShortDate("2026-01-01")).toBe("1 gen");
  });

  it("restituisce l'input invariato se non è una data valida", () => {
    expect(formatShortDate("boh")).toBe("boh");
  });
});
