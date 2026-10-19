/** What the «Dall'ultima visita» summary on Panoramica shows. Amounts are in the user's currency, prices in the instrument's. */

/** Something that happened while the user was away (between the end of the previous visit and the start of this one). */
export type WelcomeHappened =
  /** Movements added while away (bank sync, imports finished in the background). `income`/`expenses` are net of excluded parts, both positive. */
  | { kind: "movements"; count: number; income: number; expenses: number }
  /** Price alerts that went off while away; `first` is the most recent one. */
  | { kind: "price_alerts"; count: number; first: { name: string; direction: "sopra" | "sotto"; price: number; currency: string } }
  /** Subscriptions whose price went up while away; `first` is the most recent rise. */
  | { kind: "price_rises"; count: number; first: { name: string; from: number; to: number } };

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

/** Response of `GET /api/welcome`: null when there is nothing to show (first visit, closed for this visit, nothing new). */
export interface WelcomeResponse {
  summary: WelcomeSummary | null;
  currency: string;
}
