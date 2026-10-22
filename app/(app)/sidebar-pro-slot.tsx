"use client";

import { ProMenuCard } from "@/components/domain/billing";
import { useSidebarSlot } from "@/components/layout";

/** The invitation to Pro in the sidebar slot (Free accounts), bound to the slot's state (collapsed, drawer). */
export function SidebarProSlot() {
  const { collapsed, onNavigate } = useSidebarSlot();
  return <ProMenuCard place="sidebar" collapsed={collapsed} onNavigate={onNavigate} />;
}
