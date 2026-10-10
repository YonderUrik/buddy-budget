import { describe, expect, it } from "vitest";
import { addMonthsIso, detectSubscriptions, monthlyEquivalent, nextChargeDate, subscriptionKey, type SubscriptionTxInput } from "./subscriptions";

const TODAY = "2026-10-10";
let seq = 0;
const tx = (date: string, amount: number, description: string, categoryId: string | null = "cat"): SubscriptionTxInput => ({ id: `t${seq++}`, date, amount, description, categoryId });

/** `count` addebiti mensili che finiscono nel mese di `endMonth` (YYYY-MM), nel giorno `day`. */
function monthly(description: string, amounts: number[], endMonth: string, day: number) {
  return amounts.map((amount, i) => tx(addMonthsIso(`${endMonth}-01`, -(amounts.length - 1 - i), day), amount, description));
}

describe("subscriptionKey", () => {
  it("ignora codici, numeri e rumore bancario", () => {
    expect(subscriptionKey("PAGAMENTO POS NETFLIX.COM 4471AB")).toBe(subscriptionKey("Pagamento POS Netflix.com 9921CD"));
  });
});

describe("detectSubscriptions", () => {
  it("riconosce uno streaming mensile a importo costante", () => {
    const [netflix] = detectSubscriptions(monthly("Netflix", Array(8).fill(13.99), "2026-10", 8), TODAY);
    expect(netflix).toMatchObject({ cadence: "mensile", amount: 13.99, lastDate: "2026-10-08", nextDate: "2026-11-08", state: "attivo", priceChange: null });
    expect(netflix.charges).toHaveLength(8);
    expect(netflix.reasons).toContainEqual({ kind: "day", day: 8 });
  });

  it("tollera lo slittamento di qualche giorno (weekend)", () => {
    const rows = [tx("2026-07-17", 10.99, "Spotify"), tx("2026-08-19", 10.99, "Spotify"), tx("2026-09-16", 10.99, "Spotify"), tx("2026-10-19", 10.99, "Spotify")];
    expect(detectSubscriptions(rows, "2026-10-20")[0]?.cadence).toBe("mensile");
  });

  it("segnala un aumento di prezzo netto", () => {
    const rows = monthly("Spotify", [9.99, 9.99, 9.99, 9.99, 11.99, 11.99], "2026-10", 3);
    const [spotify] = detectSubscriptions(rows, TODAY);
    expect(spotify.amount).toBe(11.99);
    expect(spotify.priceChange).toEqual({ from: 9.99, to: 11.99, since: "2026-09-03" });
  });

  it("riconosce la palestra con addebito il 1° e saltato un mese", () => {
    const rows = [...monthly("Fitness Club SDD", [39, 39, 39], "2026-07", 1), tx("2026-09-01", 39, "Fitness Club SDD"), tx("2026-10-01", 39, "Fitness Club SDD")];
    const [gym] = detectSubscriptions(rows, TODAY);
    expect(gym.cadence).toBe("mensile");
    expect(gym.reasons).toContainEqual({ kind: "cadence", cadence: "mensile", skipped: true });
  });

  it("riconosce un'assicurazione annuale con due addebiti", () => {
    const rows = [tx("2025-11-15", 412.5, "Assicurazione Auto"), tx("2026-11-14", 420, "Assicurazione Auto")];
    expect(detectSubscriptions(rows, "2026-11-20")[0]).toMatchObject({ cadence: "annuale", nextDate: "2027-11-15", amount: 420 });
  });

  it("riconosce un abbonamento trimestrale", () => {
    const rows = [tx("2026-01-10", 29.9, "Rivista"), tx("2026-04-10", 29.9, "Rivista"), tx("2026-07-11", 29.9, "Rivista")];
    expect(detectSubscriptions(rows, TODAY)[0]).toMatchObject({ cadence: "trimestrale", nextDate: "2026-10-10", state: "attivo" });
  });

  it("segna come fermo un abbonamento non più addebitato", () => {
    const rows = monthly("Giornale Online", Array(6).fill(7.99), "2026-03", 12);
    const [old] = detectSubscriptions(rows, TODAY);
    expect(old.state).toBe("fermo");
    expect(old.overdueDays).toBeGreaterThan(100);
  });

  it("non propone una serie ferma da oltre un anno", () => {
    expect(detectSubscriptions(monthly("Vecchio servizio", Array(6).fill(5), "2025-01", 5), TODAY)).toEqual([]);
  });

  it("scarta la bolletta a consumo: ricorrente ma importo variabile", () => {
    const rows = monthly("Energia Piu SDD", [68, 135, 92, 118, 74, 101], "2026-10", 12);
    expect(detectSubscriptions(rows, TODAY)).toEqual([]);
  });

  it("scarta la spesa al supermercato: frequente, importi e giorni diversi", () => {
    const days = ["2026-09-02", "2026-09-05", "2026-09-09", "2026-09-12", "2026-09-17", "2026-09-19", "2026-09-26", "2026-10-01", "2026-10-04", "2026-10-08"];
    const amounts = [23.4, 41.7, 18.2, 67.9, 30.1, 12.5, 55, 28.3, 44.8, 36.6];
    const rows = days.map((d, i) => tx(d, amounts[i], "Pagamento POS Supermercato Centro 0412"));
    expect(detectSubscriptions(rows, TODAY)).toEqual([]);
  });

  it("scarta il ristorante frequentato più volte al mese con conti diversi", () => {
    const visits = [["2026-06-04", 34], ["2026-06-12", 61.5], ["2026-06-25", 27.4], ["2026-07-03", 48], ["2026-07-15", 22.9], ["2026-07-29", 71], ["2026-08-06", 39.8], ["2026-08-18", 28.4], ["2026-09-02", 55], ["2026-09-14", 31.2], ["2026-09-27", 66.5]] as const;
    expect(detectSubscriptions(visits.map(([d, a]) => tx(d, a, "Trattoria Da Mario")), TODAY)).toEqual([]);
  });

  it("scarta il caffè di ogni mattina allo stesso prezzo", () => {
    const rows = Array.from({ length: 20 }, (_, i) => tx(`2026-09-${String(i + 1).padStart(2, "0")}`, 1.3, "Bar Centrale"));
    expect(detectSubscriptions(rows, TODAY)).toEqual([]);
  });

  it("scarta due soli addebiti mensili (troppo pochi)", () => {
    expect(detectSubscriptions(monthly("Prova gratuita", [9.9, 9.9], "2026-10", 4), TODAY)).toEqual([]);
  });

  it("separa più abbonamenti sullo stesso esercente e ignora gli acquisti sparsi", () => {
    const apple = [
      ...monthly("Apple.com/bill", Array(5).fill(2.99), "2026-10", 6),
      ...monthly("Apple.com/bill", Array(5).fill(0.99), "2026-10", 21),
      tx("2026-08-30", 129, "Apple.com/bill"),
      tx("2026-09-12", 17.99, "Apple.com/bill"),
    ];
    const found = detectSubscriptions(apple, TODAY).map((s) => s.amount).sort((a, b) => a - b);
    expect(found).toEqual([0.99, 2.99]);
  });

  it("ordina per prossimo addebito", () => {
    const rows = [...monthly("B", Array(4).fill(5), "2026-10", 25), ...monthly("A", Array(4).fill(6), "2026-10", 12)];
    expect(detectSubscriptions(rows, TODAY).map((s) => s.name)).toEqual(["A", "B"]);
  });
});

describe("date e costo mensile", () => {
  it("mantiene il giorno tipico e rispetta la fine del mese", () => {
    expect(nextChargeDate("2026-01-31", "mensile", 31)).toBe("2026-02-28");
    expect(nextChargeDate("2026-02-28", "mensile", 31)).toBe("2026-03-31");
    expect(nextChargeDate("2026-10-03", "settimanale")).toBe("2026-10-10");
  });
  it("riporta ogni cadenza al mese", () => {
    expect(monthlyEquivalent(120, "annuale")).toBe(10);
    expect(monthlyEquivalent(30, "trimestrale")).toBe(10);
    expect(monthlyEquivalent(10, "mensile")).toBe(10);
    expect(monthlyEquivalent(3, "settimanale")).toBe(13);
  });
});
