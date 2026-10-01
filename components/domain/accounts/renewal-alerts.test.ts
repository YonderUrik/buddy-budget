import { describe, expect, it } from "vitest";
import { buildRenewalAlerts, describeRenewalAlert, type RenewalSource } from "./renewal-alerts";

const NOW = new Date("2026-10-01T10:00:00Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

function source(overrides: Partial<RenewalSource>): RenewalSource {
  return { connectionId: "c1", institutionName: "Banca Uno", status: "linked", consentExpiresAt: inDays(60), ...overrides };
}

describe("buildRenewalAlerts", () => {
  it("non genera avvisi per connessioni sane o in attesa", () => {
    expect(buildRenewalAlerts([source({}), source({ connectionId: "c2", status: "pending" })], NOW)).toEqual([]);
  });

  it("raggruppa per connessione e mette prima scadute/errori, poi in scadenza", () => {
    const alerts = buildRenewalAlerts(
      [
        source({ connectionId: "soon", institutionName: "Banca A", consentExpiresAt: inDays(3) }),
        source({ connectionId: "soon", institutionName: "Banca A", consentExpiresAt: inDays(3) }),
        source({ connectionId: "dead", institutionName: "Banca B", status: "expired" }),
      ],
      NOW
    );
    expect(alerts.map((a) => [a.connectionId, a.state])).toEqual([
      ["dead", "expired"],
      ["soon", "expiring"],
    ]);
  });
});

describe("describeRenewalAlert", () => {
  it("scrive frasi in italiano per scadenza vicina, domani, scaduta, errore", () => {
    const base = { connectionId: "c", institutionName: "Banca Uno" };
    expect(describeRenewalAlert({ ...base, state: "expiring", daysLeft: 5 })).toBe("Il collegamento con Banca Uno scade tra 5 giorni.");
    expect(describeRenewalAlert({ ...base, state: "expiring", daysLeft: 1 })).toBe("Il collegamento con Banca Uno scade domani.");
    expect(describeRenewalAlert({ ...base, state: "expired", daysLeft: null })).toContain("è scaduto");
    expect(describeRenewalAlert({ ...base, state: "error", daysLeft: null })).toContain("non è andato a buon fine");
  });
});
