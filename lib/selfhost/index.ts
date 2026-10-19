import { isLocalMode } from "./local-mode";
export { isLocalMode, isLocalRequest, validateLocalMode, LOCAL_ENTRY_PATH, LOCAL_OWNER_ID, LOCAL_OWNER_EMAIL } from "./local-mode";
export interface LoginCapabilities {
  googleEnabled: boolean;
  emailDelivery: boolean;
}

/** Espone solo disponibilità pubbliche: mai credenziali o altri dettagli dell’istanza. */
export function loginCapabilities(env: Record<string, string | undefined> = process.env): LoginCapabilities {
  return {
    googleEnabled: !isLocalMode(env) && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    emailDelivery: Boolean(env.RESEND_API_KEY && env.RESEND_FROM),
  };
}

/** Stato di configurazione, distinto dalla salute dei servizi e dal consenso personale. */
export function instanceCapabilities(env: Record<string, string | undefined> = process.env) {
  return {
    ...loginCapabilities(env),
    localMode: isLocalMode(env),
    aiCategories: Boolean(env.OPENROUTER_API_KEY),
    aiCsv: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL && env.PERSONAL_CSV_ENCRYPTION_KEY),
    bankSync: Boolean(env.GOCARDLESS_SECRET_ID && env.GOCARDLESS_SECRET_KEY),
    notifications: Boolean(env.RESEND_API_KEY && env.RESEND_FROM && env.NOTIFICATIONS_MODE === "execute" && (!isLocalMode(env) || env.SELFHOST_OWNER_EMAIL)),
    logos: Boolean(env.LOGODEV_PUBLISHABLE_KEY),
  };
}

export type InstanceCapabilities = ReturnType<typeof instanceCapabilities>;
