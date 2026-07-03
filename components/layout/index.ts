/**
 * components/layout — barrel file
 *
 * Punto di ingresso unico per tutti i componenti di layout dell'applicazione.
 * Importa da qui invece che dai singoli file per isolare i refactor interni.
 *
 * Esempio:
 *   import { AppShell, AppSidebar, useSidebar } from "@/components/layout";
 */

export { AppShell } from "@/components/layout/app-shell";
export { AppSidebar, NAV_ITEMS } from "@/components/layout/sidebar";
export type { NavItem } from "@/components/layout/sidebar";
export { MobileTopbar } from "@/components/layout/mobile-topbar";
export { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
