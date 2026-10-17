/** Listener handle returned by Capacitor plugins. */
interface PluginListenerHandle {
  remove: () => Promise<void>;
}

/** The subset of the Capacitor `App` plugin the web app uses (no npm dependency: the native shell injects it). */
export interface NativeAppPlugin {
  addListener(event: "appUrlOpen", listener: (event: { url: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "backButton", listener: (event: { canGoBack: boolean }) => void): Promise<PluginListenerHandle>;
  exitApp(): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { App?: NativeAppPlugin };
}

/**
 * The Capacitor runtime when the page runs inside the native app (`mobile/`), else null.
 * Read from `window.Capacitor`, which the shell injects before the page scripts: the web bundle carries no Capacitor code.
 */
export function nativeShell(): { platform: string; app: NativeAppPlugin | null } | null {
  if (typeof window === "undefined") return null;
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  return { platform: capacitor.getPlatform?.() ?? "unknown", app: capacitor.Plugins?.App ?? null };
}
