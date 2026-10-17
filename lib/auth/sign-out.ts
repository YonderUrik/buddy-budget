import { authClient } from "./client";
import { forgetPushOnThisDevice } from "@/lib/native";

/**
 * Signs out from this device. In the phone app it first removes this phone's push token from the account, so the
 * next person who signs in on it does not receive the previous account's notifications. Same result as
 * `authClient.signOut()`.
 */
export async function signOutThisDevice(): Promise<Awaited<ReturnType<typeof authClient.signOut>>> {
  await forgetPushOnThisDevice().catch(() => undefined);
  return authClient.signOut();
}
