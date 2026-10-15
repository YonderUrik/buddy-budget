import { describe, expect, it } from "vitest";
import { computeConnectionHealth, consentExpiryFrom, needsRenewal } from "./connection-health";

const NOW = new Date("2026-10-01T10:00:00Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe("computeConnectionHealth", () => {
  it("è ok con consenso lontano o senza data", () => {
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: inDays(40) }, NOW)).toEqual({ state: "ok", daysLeft: 40 });
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: null }, NOW).state).toBe("ok");
  });

  it("segnala 'in scadenza' dagli ultimi 7 giorni, arrotondando per eccesso", () => {
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: inDays(7) }, NOW)).toEqual({ state: "expiring", daysLeft: 7 });
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: inDays(8) }, NOW).state).toBe("ok");
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: new Date(NOW.getTime() + 3_600_000) }, NOW)).toEqual({ state: "expiring", daysLeft: 1 });
  });

  it("considera scaduta la connessione oltre la data anche se lo stato salvato è ancora 'linked'", () => {
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: inDays(-1) }, NOW).state).toBe("expired");
    expect(computeConnectionHealth({ status: "linked", consentExpiresAt: NOW.toISOString() }, NOW).state).toBe("expired");
  });

  it("rispetta gli stati salvati expired, error e pending", () => {
    expect(computeConnectionHealth({ status: "expired", consentExpiresAt: inDays(50) }, NOW).state).toBe("expired");
    expect(computeConnectionHealth({ status: "error", consentExpiresAt: null }, NOW).state).toBe("error");
    expect(computeConnectionHealth({ status: "pending", consentExpiresAt: null }, NOW).state).toBe("pending");
  });
});

describe("needsRenewal / consentExpiryFrom", () => {
  it("propone il rinnovo solo per expiring, expired ed error", () => {
    expect(["ok", "pending"].map((s) => needsRenewal(s as "ok"))).toEqual([false, false]);
    expect(["expiring", "expired", "error"].map((s) => needsRenewal(s as "ok"))).toEqual([true, true, true]);
  });

  it("calcola la fine del consenso a 90 giorni", () => {
    expect(consentExpiryFrom(NOW).toISOString()).toBe("2026-12-30T10:00:00.000Z");
  });
});
