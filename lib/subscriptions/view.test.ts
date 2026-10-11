import { describe, expect, it } from "vitest";
import { detectSubscriptions, type SubscriptionTxInput } from "@/lib/calc/subscriptions";
import { buildSubscriptionsView, recentPriceRises, upcomingCharges, type StoredSubscriptionRow } from "./view";

const TODAY = "2026-10-10";
const series = (description: string, amounts: number[], day: number): SubscriptionTxInput[] =>
  amounts.map((amount, i) => ({ id: `${description}${i}`, date: `2026-${String(10 - (amounts.length - 1 - i)).padStart(2, "0")}-${String(day).padStart(2, "0")}`, amount, description, categoryId: null }));
const row = (over: Partial<StoredSubscriptionRow>): StoredSubscriptionRow => ({ id: "r1", key: "x", status: "confermato", origin: "rilevato", name: null, amount: null, cadence: null, nextDate: null, categoryId: null, ...over });

describe("buildSubscriptionsView", () => {
  const detected = detectSubscriptions([...series("Netflix", [13.99, 13.99, 13.99, 13.99], 8), ...series("Spotify", [9.99, 9.99, 9.99, 11.99, 11.99], 3)], TODAY);

  it("senza scelte tutto è da confermare e fuori dai totali", () => {
    const view = buildSubscriptionsView(detected, [], TODAY);
    expect(view.items.every((i) => i.decision === "da-confermare")).toBe(true);
    expect(view.totals).toMatchObject({ count: 0, monthly: 0, pendingCount: 2, pendingMonthly: 25.98 });
  });

  it("conta solo i confermati; esclusi e terminati restano fuori", () => {
    const view = buildSubscriptionsView(detected, [row({ id: "a", key: "netflix", status: "confermato" }), row({ id: "b", key: "spotify", status: "escluso" })], TODAY);
    expect(view.totals).toMatchObject({ count: 1, monthly: 13.99, yearly: 167.88, pendingCount: 0 });
    expect(view.items.find((i) => i.key === "spotify")?.decision).toBe("escluso");
  });

  it("il nome scelto dall'utente vince su quello letto dalle transazioni", () => {
    const view = buildSubscriptionsView(detected, [row({ key: "netflix", name: "Netflix famiglia" })], TODAY);
    expect(view.items.find((i) => i.key === "netflix")?.name).toBe("Netflix famiglia");
  });

  it("un abbonamento manuale senza addebiti avanza la data e conta nei totali", () => {
    const view = buildSubscriptionsView([], [row({ key: "club", origin: "manuale", name: "Club del libro", amount: 12, cadence: "mensile", nextDate: "2026-07-20" })], TODAY);
    expect(view.items[0]).toMatchObject({ nextDate: "2026-10-20", activity: "attivo", monthly: 12 });
    expect(view.totals).toMatchObject({ count: 1, monthly: 12 });
  });

  it("segnala i prossimi addebiti e gli aumenti recenti", () => {
    const view = buildSubscriptionsView(detected, [row({ key: "netflix" }), row({ id: "s", key: "spotify" })], TODAY);
    expect(upcomingCharges(view.items, TODAY).map((i) => i.key)).toEqual(["spotify", "netflix"]);
    expect(recentPriceRises(view.items, TODAY).map((i) => i.key)).toEqual(["spotify"]);
  });
});
