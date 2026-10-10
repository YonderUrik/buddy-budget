import { headers } from "next/headers";
import { PrivacyBoundary, PrivacyProvider } from "@/components/privacy-provider";
import { DemoBannerContainer } from "@/components/domain/start";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { auth } from "@/lib/auth";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout per tutte le pagine dell'app autenticate: monta AppShell con sidebar (e il suo riepilogo finanziario), il pannello globale dei sync e la preferenza "nascondi importi". */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <PrivacyProvider initialHidden={session?.user.hideAmounts === true}>
      <AttentionShell sidebarExtra={<SidebarInsightsSlot />}>
        <PrivacyBoundary>
          <DemoBannerContainer />
          {children}
        </PrivacyBoundary>
      </AttentionShell>
      <SyncProgressIndicator />
    </PrivacyProvider>
  );
}
