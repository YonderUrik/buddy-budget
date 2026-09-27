"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Registra in Umami l'installazione della PWA (evento `appinstalled` del browser). Non renderizza nulla. */
export function PwaInstallTracker() {
  useEffect(() => {
    const onInstalled = () => track("pwa_installed");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);
  return null;
}
