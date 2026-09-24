import { AppShell } from "@/components/layout";
import { SyncProgressIndicator } from "@/components/domain/sync";

/** Layout per tutte le pagine dell'app autenticate: monta AppShell con sidebar e il pannello globale dei sync. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <SyncProgressIndicator />
    </>
  );
}
