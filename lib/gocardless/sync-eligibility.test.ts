import { describe, expect, it } from "vitest";
import { computeSyncEligibility, MAX_SYNCS_PER_DAY, MIN_SYNC_GAP_MS, SYNC_WINDOW_MS } from "./sync-eligibility";

const HOUR = 60 * 60 * 1000;
const now = new Date(1_800_000_000_000);

function hoursAgo(hours: number): Date {
  return new Date(now.getTime() - hours * HOUR);
}

describe("computeSyncEligibility", () => {
  it("nessuno storico: sempre eleggibile, 4 slot residui", () => {
    expect(computeSyncEligibility([], now)).toEqual({
      eligible: true,
      syncsUsedToday: 0,
      syncsRemainingToday: 4,
      nextEligibleAt: null,
    });
  });

  it("ultimo sync troppo recente (< 4h): non eleggibile, prossimo = ultimo + 4h", () => {
    const last = hoursAgo(3);
    const result = computeSyncEligibility([last], now);
    expect(result.eligible).toBe(false);
    expect(result.nextEligibleAt).toEqual(new Date(last.getTime() + MIN_SYNC_GAP_MS));
  });

  it("ultimo sync esattamente a 4h: eleggibile (bordo incluso)", () => {
    expect(computeSyncEligibility([hoursAgo(4)], now).eligible).toBe(true);
  });

  it("ultimo sync abbastanza vecchio (> 4h): eleggibile, un solo slot usato", () => {
    const result = computeSyncEligibility([hoursAgo(5)], now);
    expect(result.eligible).toBe(true);
    expect(result.syncsRemainingToday).toBe(3);
  });

  it("timestamp esattamente a 24h è fuori dalla finestra (bordo escluso)", () => {
    const result = computeSyncEligibility([hoursAgo(24)], now);
    expect(result.syncsUsedToday).toBe(0);
    expect(result.syncsRemainingToday).toBe(MAX_SYNCS_PER_DAY);
  });

  it("4 sync in finestra, ultimo abbastanza vecchio per il gap: blocca per tetto giornaliero", () => {
    const timestamps = [hoursAgo(23), hoursAgo(18), hoursAgo(10), hoursAgo(5)];
    const result = computeSyncEligibility(timestamps, now);
    expect(result.eligible).toBe(false);
    expect(result.syncsUsedToday).toBe(4);
    expect(result.syncsRemainingToday).toBe(0);
    expect(result.nextEligibleAt).toEqual(new Date(hoursAgo(23).getTime() + SYNC_WINDOW_MS));
  });

  it("4 sync recenti e ravvicinati: il tetto giornaliero domina sul gap minimo", () => {
    const timestamps = [hoursAgo(3), hoursAgo(2), hoursAgo(1), hoursAgo(0.5)];
    const result = computeSyncEligibility(timestamps, now);
    expect(result.eligible).toBe(false);
    expect(result.nextEligibleAt).toEqual(new Date(hoursAgo(3).getTime() + SYNC_WINDOW_MS));
  });
});
