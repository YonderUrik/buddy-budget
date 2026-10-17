import { z } from "zod";

export const PUSH_PLATFORMS = ["ios", "android"] as const;

/** APNs tokens are 64+ hex characters, FCM tokens ~150-250 URL-safe characters: anything else is not a device token. */
const pushToken = z.string().trim().min(32).max(4096).regex(/^[A-Za-z0-9:_\-.]+$/, "Token non valido");

/** Body of `POST /api/user/push-devices`: the native app registers the token of this phone. */
export const registerPushDeviceSchema = z.object({ platform: z.enum(PUSH_PLATFORMS), token: pushToken }).strict();

/** Body of `DELETE /api/user/push-devices`: the app forgets this phone (sign-out, push turned off). */
export const removePushDeviceSchema = z.object({ token: pushToken }).strict();
