/** Platform of the native shell (Capacitor, `mobile/`). */
export type NativePlatform = "ios" | "android";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

/**
 * Platform of the native app when the page runs inside it (`mobile/`), else null (browser, server).
 * Read from `window.Capacitor`, which the shell injects before the page scripts, so the check costs no import: the
 * plugins themselves are loaded with dynamic `import()` only inside the app.
 */
export function nativePlatform(): NativePlatform | null {
  if (typeof window === "undefined") return null;
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  const platform = capacitor.getPlatform?.();
  return platform === "ios" || platform === "android" ? platform : null;
}

/** User-Agent suffix the shell appends (`appendUserAgent` in `mobile/capacitor.config.ts`): lets the server tell the app apart. */
export const NATIVE_USER_AGENT_MARKER = "BuddyBudgetApp";

/** True when a request comes from the native app (User-Agent marker). Only for presentation choices, never for security. */
export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.includes(NATIVE_USER_AGENT_MARKER));
}
