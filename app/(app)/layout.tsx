import { headers } from "next/headers";
import { PrivacyBoundary, PrivacyProvider } from "@/components/privacy-provider";
import { DemoBannerContainer } from "@/components/domain/start";
import { BackHistoryRecorder } from "@/components/domain/shared";
import { PersonalImportIsland } from "@/components/domain/personal-import";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { QuickReportProvider } from "@/components/domain/support";
// Direct file import: the auth barrel also carries the login preview, which the app layout must not load.
import { RememberReturningUser } from "@/components/domain/auth/remember-returning-user";
import { BiometricLockScreen, NativeSessionTasks } from "@/components/domain/native";
import { auth } from "@/lib/auth";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout of every authenticated app page: mounts AppShell with the sidebar (and its financial summary), the global sync panel, the «Scrivici» sheet, the «‹» history, the "hide amounts" preference, the remembered account for «Rientra in BuddyBudget» and, in the phone app, the push token refresh and the Face ID lock. */
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
      {session && <RememberReturningUser email={session.user.email} />}
      {session && <NativeSessionTasks />}
      <BiometricLockScreen />
    </PrivacyProvider>
  );
}
