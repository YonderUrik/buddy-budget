import { describe, expect, it } from "vitest";
import { NOTIFICATION_DEFAULTS } from "@/lib/notifications";
import { inboxPreview } from "./notification-choices.data";

describe("inboxPreview", () => {
  it("con le preferenze di default la casella è vuota (opt-in)", () => {
    expect(inboxPreview(NOTIFICATION_DEFAULTS)).toEqual([]);
  });

  it("segue la frequenza del riepilogo e l'ordine riepilogo, budget, scadenze, obiettivi", () => {
    const items = inboxPreview({ digestEnabled: true, digestFrequency: "settimanale", budgetAlertsEnabled: true, deadlineAlertsEnabled: true, goalAlertsEnabled: true, emailEnabled: true, pushEnabled: false });
    expect(items.map((i) => i.kind)).toEqual(["digest", "budget", "deadlines", "goals"]);
    expect(items[0]).toMatchObject({ title: "Riepilogo della settimana", when: "Ogni lunedì" });
    expect(items[1].when).toBe("All'80% e al 100% di un budget");
    expect(items[2].when).toBe("3 giorni prima di una rata");
  });
});
