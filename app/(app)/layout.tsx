import { AppShell } from "@/components/layout";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout per tutte le pagine dell'app autenticate: monta AppShell con sidebar (e il suo riepilogo finanziario) e il pannello globale dei sync. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell sidebarExtra={<SidebarInsightsSlot />}>{children}</AppShell>
      <SyncProgressIndicator />
    </>
  );
}
