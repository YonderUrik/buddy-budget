"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { NATIVE_APP_LINK_PATHS, nativeShell, resolveDeepLink } from "@/lib/native";

/**
 * Connects the web app to the native shell (Capacitor, `mobile/`); renders nothing and does nothing in a browser.
 * Links that open the app (magic link, return from the bank) are loaded in the WebView, where the session cookie lives;
 * the Android back button goes back in the history and closes the app on the first screen.
 */
export function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    const shell = nativeShell();
    if (!shell?.app) return;
    const { app, platform } = shell;

    const urlOpen = app.addListener("appUrlOpen", ({ url }) => {
      const path = resolveDeepLink(url, window.location.origin);
      if (!path) return;
      const isSignIn = NATIVE_APP_LINK_PATHS.some((prefix) => path.startsWith(prefix));
      track("native_link_opened", { kind: isSignIn ? "accesso" : "pagina", platform });
      // API routes (magic link, bank callback) answer with a redirect and a cookie: they need a real navigation.
      if (path.startsWith("/api/")) window.location.assign(path);
      else router.push(path);
    });
    const back = app.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void app.exitApp();
    });

    return () => {
      void urlOpen.then((handle) => handle.remove());
      void back.then((handle) => handle.remove());
    };
  }, [router]);

  return null;
}
