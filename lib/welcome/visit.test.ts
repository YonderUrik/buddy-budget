import { describe, expect, it } from "vitest";
import { VISIT_GAP_MS, hasWelcomeContent, isWelcomeShown, nextVisitState, type VisitState } from "./visit";

const empty: VisitState = { appSeenAt: null, visitStartedAt: null, visitSinceAt: null, welcomeShownAt: null };
const at = (iso: string) => new Date(iso);

describe("nextVisitState", () => {
  it("starts the first visit without a previous one to count from", () => {
    const { state, newVisit } = nextVisitState(empty, at("2026-10-19T08:00:00Z"));
    expect(newVisit).toBe(true);
    expect(state.visitStartedAt).toEqual(at("2026-10-19T08:00:00Z"));
    expect(state.visitSinceAt).toBeNull();
  });

  it("keeps the visit going within the gap and only moves the heartbeat", () => {
    const first = nextVisitState(empty, at("2026-10-19T08:00:00Z")).state;
    const { state, newVisit } = nextVisitState(first, at("2026-10-19T08:20:00Z"));
    expect(newVisit).toBe(false);
    expect(state.appSeenAt).toEqual(at("2026-10-19T08:20:00Z"));
    expect(state.visitStartedAt).toEqual(at("2026-10-19T08:00:00Z"));
  });

  it("after a pause, counts from the last heartbeat of the previous visit", () => {
    const seen = { ...empty, appSeenAt: at("2026-10-18T18:40:00Z"), visitStartedAt: at("2026-10-18T18:00:00Z") };
    const now = new Date(at("2026-10-18T18:40:00Z").getTime() + VISIT_GAP_MS + 1);
    const { state, newVisit } = nextVisitState(seen, now);
    expect(newVisit).toBe(true);
    expect(state.visitSinceAt).toEqual(at("2026-10-18T18:40:00Z"));
    expect(state.visitStartedAt).toEqual(now);
  });

  it("ignores heartbeats closer than a minute", () => {
    const seen = { ...empty, appSeenAt: at("2026-10-19T08:00:00Z"), visitStartedAt: at("2026-10-19T08:00:00Z") };
    expect(nextVisitState(seen, at("2026-10-19T08:00:30Z")).state).toBe(seen);
  });
});

describe("isWelcomeShown", () => {
  it("counts only a showing during the current visit", () => {
    const visitStartedAt = at("2026-10-19T08:00:00Z");
    expect(isWelcomeShown({ visitStartedAt, welcomeShownAt: at("2026-10-19T08:05:00Z") })).toBe(true);
    expect(isWelcomeShown({ visitStartedAt, welcomeShownAt: at("2026-10-18T20:00:00Z") })).toBe(false);
    expect(isWelcomeShown({ visitStartedAt, welcomeShownAt: null })).toBe(false);
  });
});

describe("hasWelcomeContent", () => {
  it("speaks only when something happened while away, not for the backlog alone", () => {
    expect(hasWelcomeContent({ happened: [{ kind: "movements", count: 3 }] })).toBe(true);
    expect(hasWelcomeContent({ happened: [] })).toBe(false);
  });
});
