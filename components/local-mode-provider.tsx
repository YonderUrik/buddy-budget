"use client";

import { createContext, useContext, type ReactNode } from "react";

const LocalModeContext = createContext({ enabled: false, emailAvailable: true });

/** Share the runtime access mode without exposing environment values to the browser. */
export function LocalModeProvider({ enabled, emailAvailable, children }: { enabled: boolean; emailAvailable: boolean; children: ReactNode }) {
  return <LocalModeContext.Provider value={{ enabled, emailAvailable }}>{children}</LocalModeContext.Provider>;
}

/** True when this installation opens a personal account automatically. */
export function useLocalMode(): boolean {
  return useContext(LocalModeContext).enabled;
}

/** Whether the optional notification choices have a usable delivery address. */
export function useEmailAvailable(): boolean {
  return useContext(LocalModeContext).emailAvailable;
}
