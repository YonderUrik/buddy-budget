"use client";

/**
 * Contesto dello slot extra della sidebar: chi riempie lo slot (`AppShell sidebarExtra`) sa se la sidebar è compressa
 * e può chiudere il drawer mobile quando si segue un link. Il layout resta ignaro di cosa contiene lo slot.
 */

import * as React from "react";

export interface SidebarSlotState {
  /** Sidebar in modalità solo icone. */
  collapsed: boolean;
  /** Da chiamare quando si naviga da un link dello slot (chiude il drawer mobile). */
  onNavigate?: () => void;
}

const SidebarSlotContext = React.createContext<SidebarSlotState>({ collapsed: false });

export function SidebarSlotProvider({ value, children }: { value: SidebarSlotState; children: React.ReactNode }) {
  return <SidebarSlotContext.Provider value={value}>{children}</SidebarSlotContext.Provider>;
}

/** Stato della sidebar per il contenuto dello slot extra. */
export function useSidebarSlot(): SidebarSlotState {
  return React.useContext(SidebarSlotContext);
}
