/** What the «Dall'ultima visita» toast says when a returning user opens the app: counts only, no amounts or names. */

/** Something that happened while the user was away (between the end of the previous visit and the start of this one). */
export type WelcomeHappened =
  /** Movements added while away (bank sync, imports finished in the background). */
  | { kind: "movements"; count: number }
  /** Price alerts that went off while away. */
  | { kind: "price_alerts"; count: number }
  /** Subscriptions whose price went up while away. */
  | { kind: "price_rises"; count: number };

/** Something that is waiting for the user now, whenever it arrived. */
export type WelcomeWaiting =
  /** Movements still in the fallback category («Da decidere» in Liquidità). */
  | { kind: "to_decide"; count: number }
  /** Recurring charges found and not yet confirmed or discarded. */
  | { kind: "subscriptions"; count: number }
  /** File imports stopped on rows to check; `jobId` opens the most recent one. */
  | { kind: "import_review"; count: number; jobId: string };

export type WelcomeHappenedKind = WelcomeHappened["kind"];
export type WelcomeWaitingKind = WelcomeWaiting["kind"];
export type WelcomeItemKind = WelcomeHappenedKind | WelcomeWaitingKind;

export interface WelcomeSummary {
  /** End of the previous visit (ISO): what happened is counted from here. */
  since: string;
  happened: WelcomeHappened[];
  waiting: WelcomeWaiting[];
}

/** Response of `GET /api/welcome`: null when there is nothing to say (first visit, already shown this visit, nothing new). */
export interface WelcomeResponse {
  summary: WelcomeSummary | null;
}
