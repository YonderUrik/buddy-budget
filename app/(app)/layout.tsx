import { headers } from "next/headers";
import { PrivacyBoundary, PrivacyProvider } from "@/components/privacy-provider";
import { DemoBannerContainer } from "@/components/domain/start";
import { PublicDemoBanner, PublicDemoFooter } from "@/components/domain/public-demo";
import { BackHistoryRecorder } from "@/components/domain/shared";
import { PersonalImportIsland } from "@/components/domain/personal-import";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { QuickReportProvider } from "@/components/domain/support";
// Direct file import: the auth barrel also carries the login preview, which the app layout must not load.
import { RememberReturningUser } from "@/components/domain/auth/remember-returning-user";
import { BiometricLockScreen, NativeSessionTasks } from "@/components/domain/native";
import { auth } from "@/lib/auth";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout of every authenticated app page: mounts AppShell with the sidebar (and its financial summary), the global sync panel, the «Scrivici» sheet, the «‹» history, the "hide amounts" preference, the remembered account for «Rientra in BuddyBudget» and, in the phone app, the push token refresh and the Face ID lock. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isPublicDemo = isPublicDemoUserId(session?.user.id);
  return (
    <PrivacyProvider initialHidden={session?.user.hideAmounts === true}>
      <QuickReportProvider>
      <BackHistoryRecorder />
      <AttentionShell sidebarExtra={<SidebarInsightsSlot />}>
        <PrivacyBoundary>
          {isPublicDemo ? (
            <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
              <PublicDemoBanner />
            </div>
          ) : (
            <DemoBannerContainer />
          )}
          {children}
          {isPublicDemo ? <PublicDemoFooter /> : null}
        </PrivacyBoundary>
      </AttentionShell>
      <SyncProgressIndicator>
        <PersonalImportIsland />
      </SyncProgressIndicator>
      </QuickReportProvider>
      {/* The shared demo account is never remembered as "your" account on the sign-in page, nor registers phones for push. */}
      {session && !isPublicDemo && <RememberReturningUser email={session.user.email} />}
      {session && !isPublicDemo && <NativeSessionTasks />}
      <BiometricLockScreen />
    </PrivacyProvider>
  );
}
