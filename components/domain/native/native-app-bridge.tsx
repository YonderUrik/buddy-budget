"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { track } from "@/lib/analytics";
import { NATIVE_APP_LINK_PATHS, closeExternalPage, closeTopLayer, nativePlatform, resolveDeepLink, safeAppPath } from "@/lib/native";

/** Elements drawn on the navy brand colour right under the status bar (phone top bar): status bar content goes light. */
const ON_DARK_SELECTOR = '[data-status-bar="on-dark"]';

/** Opens an app path from a link or a notification: API routes need a real navigation (they set cookies and redirect). */
function openPath(path: string, push: (path: string) => void) {
  if (path.startsWith("/api/")) window.location.assign(path);
  else push(path);
}

/**
 * Connects the web app to the native shell (Capacitor, `mobile/`); renders nothing and does nothing in a browser.
 * - Links that open the app (magic link, return from the bank) are loaded in the WebView, where the session lives.
 * - A tap on a push notification opens the page it is about.
 * - The Android back button closes the open sheet first, then goes back, and closes the app on the first screen.
 * - Status bar content follows the theme (light on the navy top bar), and the splash screen hides once the page is drawn.
 */
export function NativeAppBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    let disposed = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const keep = (handle: { remove: () => Promise<void> }) => (disposed ? void handle.remove() : handles.push(handle));

    void (async () => {
      const [{ App }, { PushNotifications }, { SplashScreen }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/push-notifications"),
        import("@capacitor/splash-screen"),
      ]);
      if (disposed) return;
      void SplashScreen.hide();

      keep(
        await App.addListener("appUrlOpen", ({ url }) => {
          const path = resolveDeepLink(url, window.location.origin);
          if (!path) return;
          // The bank page was opened in the in-app browser: coming back to the app closes it.
          void closeExternalPage();
          const isSignIn = NATIVE_APP_LINK_PATHS.some((prefix) => path.startsWith(prefix));
          track("native_link_opened", { kind: isSignIn ? "accesso" : "pagina", platform });
          openPath(path, router.push);
        })
      );
      keep(
        await App.addListener("backButton", ({ canGoBack }) => {
          if (closeTopLayer()) return;
          if (canGoBack) window.history.back();
          else void App.exitApp();
        })
      );
      keep(
        await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const data = notification.data as { path?: unknown } | undefined;
          const path = safeAppPath(typeof data?.path === "string" ? data.path : null);
          track("native_notification_opened", { platform });
          if (path) openPath(path, router.push);
        })
      );
    })();

    return () => {
      disposed = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, [router]);

  useEffect(() => {
    if (!nativePlatform()) return;
    // After the page has drawn the new route, so the top bar (if any) is in the DOM.
    const frame = window.requestAnimationFrame(() => {
      void import("@capacitor/core").then(({ SystemBars, SystemBarsStyle }) => {
        const onDark = document.querySelector(ON_DARK_SELECTOR) !== null && window.matchMedia("(max-width: 767px)").matches;
        void SystemBars.setStyle({ style: onDark || resolvedTheme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, resolvedTheme]);

  return null;
}
