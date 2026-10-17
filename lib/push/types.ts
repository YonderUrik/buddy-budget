/** What a phone shows: no amounts (the lock screen is visible to anyone), and the app page a tap opens. */
export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app, e.g. `/debiti`. */
  path: string;
}

export type PushPlatform = "ios" | "android";

/** Outcome of one send to one device. `invalid_token`: the provider says the device no longer exists. */
export type PushSendOutcome = "sent" | "failed" | "invalid_token";
