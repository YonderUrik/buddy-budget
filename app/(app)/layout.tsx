import { headers } from "next/headers";
import { PrivacyBoundary, PrivacyProvider } from "@/components/privacy-provider";
import { DemoBannerContainer } from "@/components/domain/start";
import { BackHistoryRecorder } from "@/components/domain/shared";
import { PersonalImportIsland } from "@/components/domain/personal-import";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { QuickReportProvider } from "@/components/domain/support";
import { auth } from "@/lib/auth";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout per tutte le pagine dell'app autenticate: monta AppShell con sidebar (e il suo riepilogo finanziario), il pannello globale dei sync, il foglio «Scrivici», la cronologia del link «‹» e la preferenza "nascondi importi". */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <PrivacyProvider initialHidden={session?.user.hideAmounts === true}>
      <QuickReportProvider>
      <BackHistoryRecorder />
      <AttentionShell sidebarExtra={<SidebarInsightsSlot />}>
        <PrivacyBoundary>
          <DemoBannerContainer />
          {children}
        </PrivacyBoundary>
      </AttentionShell>
      <SyncProgressIndicator>
        <PersonalImportIsland />
      </SyncProgressIndicator>
      </QuickReportProvider>
    </PrivacyProvider>
  );
}
