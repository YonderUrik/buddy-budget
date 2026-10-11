import { describe, expect, it } from "vitest";
import { DEFAULT_CAPACITY_LIMITS, decideCapacity, parseCapacityLimits, usedSlots } from "./capacity";

const limits = DEFAULT_CAPACITY_LIMITS;
const freshUser = { linkedInstitutionIds: [], recentAttempts: 0 };

describe("parseCapacityLimits", () => {
  it("usa i default senza variabili", () => {
    expect(parseCapacityLimits({})).toEqual({ perUser: 1, attemptsPerUser: 3, global: 40, provider: 50 });
  });

  it("legge i valori validi e scarta quelli non validi", () => {
    expect(
      parseCapacityLimits({ GOCARDLESS_MAX_CONNECTIONS: "30", GOCARDLESS_MAX_CONNECTIONS_PER_USER: "2", GOCARDLESS_MAX_ATTEMPTS_PER_USER: "abc", GOCARDLESS_PROVIDER_LIMIT: "-1" })
    ).toEqual({ perUser: 2, attemptsPerUser: 3, global: 30, provider: 50 });
  });

  it("non lascia il limite del piano sotto il tetto globale", () => {
    expect(parseCapacityLimits({ GOCARDLESS_MAX_CONNECTIONS: "60" }).provider).toBe(60);
  });

  it("accetta 0 per spegnere i collegamenti nuovi", () => {
    expect(parseCapacityLimits({ GOCARDLESS_MAX_CONNECTIONS: "0" }).global).toBe(0);
  });
});

describe("usedSlots", () => {
  it("prende il maggiore tra connessioni vive e consensi recenti", () => {
    expect(usedSlots({ live: 12, recent: 30 })).toBe(30);
    expect(usedSlots({ live: 35, recent: 4 })).toBe(35);
  });
});

describe("decideCapacity", () => {
  it("consente la prima banca", () => {
    expect(decideCapacity(freshUser, { live: 0, recent: 0 }, limits, "INST_A")).toEqual({ allowed: true, kind: "new" });
  });

  it("blocca una seconda banca per lo stesso utente", () => {
    const user = { linkedInstitutionIds: ["INST_A"], recentAttempts: 1 };
    expect(decideCapacity(user, { live: 5, recent: 5 }, limits, "INST_B")).toEqual({ allowed: false, kind: "new", reason: "user_limit" });
    expect(decideCapacity(user, { live: 5, recent: 5 }, limits)).toMatchObject({ allowed: false, reason: "user_limit" });
  });

  it("consente il rinnovo della banca già collegata", () => {
    const user = { linkedInstitutionIds: ["INST_A"], recentAttempts: 1 };
    expect(decideCapacity(user, { live: 5, recent: 5 }, limits, "INST_A")).toEqual({ allowed: true, kind: "renewal" });
  });

  it("chi ha già più banche (prima del limite) può rinnovarle ma non aggiungerne", () => {
    const user = { linkedInstitutionIds: ["INST_A", "INST_B"], recentAttempts: 0 };
    expect(decideCapacity(user, { live: 5, recent: 5 }, limits, "INST_B")).toMatchObject({ allowed: true, kind: "renewal" });
    expect(decideCapacity(user, { live: 5, recent: 5 }, limits, "INST_C")).toMatchObject({ allowed: false, reason: "user_limit" });
  });

  it("al tetto globale blocca le banche nuove ma non i rinnovi", () => {
    expect(decideCapacity(freshUser, { live: 40, recent: 10 }, limits, "INST_A")).toMatchObject({ allowed: false, reason: "global_limit" });
    expect(decideCapacity(freshUser, { live: 10, recent: 40 }, limits, "INST_A")).toMatchObject({ allowed: false, reason: "global_limit" });
    const user = { linkedInstitutionIds: ["INST_A"], recentAttempts: 1 };
    expect(decideCapacity(user, { live: 45, recent: 45 }, limits, "INST_A")).toMatchObject({ allowed: true, kind: "renewal" });
  });

  it("al limite del piano blocca anche i rinnovi", () => {
    const user = { linkedInstitutionIds: ["INST_A"], recentAttempts: 1 };
    expect(decideCapacity(user, { live: 50, recent: 0 }, limits, "INST_A")).toMatchObject({ allowed: false, reason: "provider_limit" });
  });

  it("limita i consensi avviati da un utente nel mese, anche per i rinnovi", () => {
    expect(decideCapacity({ linkedInstitutionIds: [], recentAttempts: 3 }, { live: 0, recent: 3 }, limits, "INST_A")).toMatchObject({ allowed: false, reason: "user_attempts" });
    expect(decideCapacity({ linkedInstitutionIds: ["INST_A"], recentAttempts: 3 }, { live: 1, recent: 3 }, limits, "INST_A")).toMatchObject({ allowed: false, reason: "user_attempts" });
  });
});
