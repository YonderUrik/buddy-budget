import type { PushDevice } from "@/lib/db/schema/push-devices";
import type { NotificationEmailKind, PushNotificationOutcome } from "@/lib/observability";
import { sendApns } from "./apns";
import type { PushConfig } from "./config";
import { sendFcm } from "./fcm";
import type { PushMessage, PushPlatform, PushSendOutcome } from "./types";

/** Effects of a send, replaceable in tests. */
export interface PushSendDeps {
  config: PushConfig;
  sendFcm: typeof sendFcm;
  sendApns: typeof sendApns;
  deleteTokens(tokens: string[]): Promise<void>;
  record(kind: NotificationEmailKind, platform: PushPlatform, outcome: PushNotificationOutcome): void;
}

export interface PushSendResult {
  /** Devices that accepted the notification. */
  sent: number;
  failed: number;
  /** Devices removed because the provider said they no longer exist. */
  removed: number;
  /** Devices skipped because their platform has no credentials on this server. */
  unconfigured: number;
}

/**
 * Sends one message to all the devices of a user, each with its platform's provider. Never throws: a provider error
 * counts as `failed`, a dead token is deleted so the next run does not try it again.
 */
export async function sendPushToDevices(devices: Pick<PushDevice, "platform" | "token">[], kind: NotificationEmailKind, message: PushMessage, deps: PushSendDeps): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, removed: 0, unconfigured: 0 };
  const dead: string[] = [];
  await Promise.all(
    devices.map(async (device) => {
      const platform: PushPlatform = device.platform === "ios" ? "ios" : "android";
      let outcome: PushSendOutcome | "not_configured";
      try {
        if (platform === "ios") outcome = deps.config.apns ? await deps.sendApns(deps.config.apns, device.token, message) : "not_configured";
        else outcome = deps.config.fcm ? await deps.sendFcm(deps.config.fcm, device.token, message) : "not_configured";
      } catch {
        outcome = "failed";
      }
      deps.record(kind, platform, outcome);
      if (outcome === "sent") result.sent += 1;
      else if (outcome === "invalid_token") dead.push(device.token);
      else if (outcome === "not_configured") result.unconfigured += 1;
      else result.failed += 1;
    })
  );
  if (dead.length > 0) {
    await deps.deleteTokens(dead).catch(() => undefined);
    result.removed = dead.length;
  }
  return result;
}
