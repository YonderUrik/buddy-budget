import "server-only";

/**
 * lib/push — barrel file (server only)
 *
 * Push notifications to the native app: devices, FCM (Android) and APNs (iOS) senders, credentials from env.
 */

import { recordPushNotification } from "@/lib/observability";
import { sendApns } from "./apns";
import { pushConfigFromEnv } from "./config";
import { sendFcm } from "./fcm";
import type { PushSendDeps } from "./send";
import { deletePushTokens } from "./store";

export { pushConfigFromEnv } from "./config";
export type { PushConfig, FcmConfig, ApnsConfig } from "./config";
export { sendPushToDevices } from "./send";
export type { PushSendDeps, PushSendResult } from "./send";
export { listPushDevices, registerPushDevice, removePushDevice, deletePushTokens, purgeStalePushDevices, PUSH_DEVICE_STALE_DAYS } from "./store";
export type { PushMessage, PushPlatform, PushSendOutcome } from "./types";

/** Real senders and credentials read from the environment at call time. */
export function defaultPushDeps(): PushSendDeps {
  return { config: pushConfigFromEnv(), sendFcm, sendApns, deleteTokens: deletePushTokens, record: recordPushNotification };
}

/** True when at least one platform has credentials: the settings show the phone switch only then. */
export function isPushConfigured(): boolean {
  const config = pushConfigFromEnv();
  return config.fcm !== null || config.apns !== null;
}
