import { describe, expect, it } from "vitest";
import type { SubscriptionItem } from "@/lib/subscriptions/view";
import { fromDate, itemHint, onDate, reasonSentence, whenPhrase } from "./subscriptions-format";

const base: SubscriptionItem = {
  key: "k", id: null, name: "Netflix", origin: "rilevato", decision: "confermato", activity: "attivo", cadence: "mensile", amount: 13.99, monthly: 13.99,
  lastDate: "2026-09-08", nextDate: "2026-10-08", overdueDays: 0, priceChange: null, charges: [], reasons: [], confidence: 1, categoryId: null,
};

describe("testi degli abbonamenti", () => {
  it("dice quando arriva l'addebito", () => {
    expect(whenPhrase("2026-10-10", "2026-10-10")).toBe("oggi");
    expect(whenPhrase("2026-10-10", "2026-10-11")).toBe("domani");
    expect(whenPhrase("2026-10-10", "2026-10-15")).toBe("tra 5 giorni");
    expect(whenPhrase("2026-10-10", "2026-11-20")).toBe("il 20 nov");
    expect(whenPhrase("2026-10-10", "2027-10-02")).toContain("2027");
  });

  it("elide l'articolo davanti a 8 e 11", () => {
    expect(onDate("2026-11-08")).toBe("l'8 nov");
    expect(onDate("2026-11-11")).toBe("l'11 nov");
    expect(fromDate("2026-09-08")).toBe("dall'8 set");
    expect(fromDate("2026-09-03")).toBe("dal 3 set");
  });

  it("riassume la riga per stato", () => {
    expect(itemHint({ ...base, nextDate: "2026-10-15" }, "2026-10-10")).toBe("ogni mese · prossimo tra 5 giorni");
    expect(itemHint({ ...base, nextDate: "2026-10-08" }, "2026-10-10")).toContain("atteso");
    expect(itemHint({ ...base, activity: "fermo" }, "2026-10-10")).toBe("Ultimo addebito l'8 set, atteso l'8 ott");
    expect(itemHint({ ...base, decision: "terminato" }, "2026-10-10")).toBe("ogni mese · ultimo addebito l'8 set");
  });

  it("scrive i motivi del rilevamento", () => {
    expect(reasonSentence({ kind: "count", count: 6 }, "EUR")).toBe("6 addebiti dello stesso esercente");
    expect(reasonSentence({ kind: "cadence", cadence: "annuale", skipped: false }, "EUR")).toBe("Tornano ogni anno");
    expect(reasonSentence({ kind: "price-change", from: 9.99, to: 11.99, since: "2026-09-03" }, "EUR")).toContain("dal 3 set 2026");
  });
});
