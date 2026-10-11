"use client";

import { BOTTOM_NAV_DEFAULT, BOTTOM_NAV_KEY, SIDEBAR_MODULE_DEFAULT, sidebarModuleKey, type SidebarModuleId } from "@/lib/sidebar/modules";
import { usePersistedFlag } from "./use-persisted-flag";

/** Se un modulo della barra laterale è visibile. Vale per questo dispositivo. */
export function useSidebarModule(id: SidebarModuleId): [boolean, (value: boolean) => void] {
  return usePersistedFlag(sidebarModuleKey(id), SIDEBAR_MODULE_DEFAULT);
}

/** Se su mobile si usa la barra in basso invece del menu a scomparsa. Vale per questo dispositivo. */
export function useBottomNav(): [boolean, (value: boolean) => void] {
  return usePersistedFlag(BOTTOM_NAV_KEY, BOTTOM_NAV_DEFAULT);
}
