import { authMethods } from "@/lib/instance/config";
import { isLocalMode } from "./local-mode";
export type { LocalRequestRejection } from "./local-mode";
export { isLocalMode, isLocalRequest, localRequestRejection, validateLocalMode, LOCAL_ENTRY_PATH, LOCAL_MODE_PROVIDER_ID, LOCAL_OWNER_ID, LOCAL_OWNER_EMAIL } from "./local-mode";
export interface LoginCapabilities {
  googleEnabled: boolean;
  emailDelivery: boolean;
}

/** Expose public availability only, without credentials or private instance details. */
export function loginCapabilities(env: Record<string, string | undefined> = process.env): LoginCapabilities {
  const methods = authMethods(env);
  return { googleEnabled: methods.google, emailDelivery: methods.emailDelivery };
}

/** Configuration status, separate from provider health and each user's consent. */
export function instanceCapabilities(env: Record<string, string | undefined> = process.env) {
  return {
    ...loginCapabilities(env),
    localMode: isLocalMode(env),
    aiCategories: Boolean(env.OPENROUTER_API_KEY),
    aiCsv: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL && env.PERSONAL_CSV_ENCRYPTION_KEY),
    bankSync: Boolean(env.GOCARDLESS_SECRET_ID && env.GOCARDLESS_SECRET_KEY),
    notifications: Boolean(loginCapabilities(env).emailDelivery && env.NOTIFICATIONS_MODE === "execute" && (!isLocalMode(env) || env.SELFHOST_OWNER_EMAIL)),
    logos: Boolean(env.LOGODEV_PUBLISHABLE_KEY),
  };
}

export type InstanceCapabilities = ReturnType<typeof instanceCapabilities>;
