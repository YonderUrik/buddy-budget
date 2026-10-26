import { headers } from "next/headers";
import { PrivacyBoundary, PrivacyProvider } from "@/components/privacy-provider";
import { DemoBannerContainer, StartProgressWatcher } from "@/components/domain/start";
import { PublicDemoBanner, PublicDemoFooter } from "@/components/domain/public-demo";
import { BackHistoryRecorder } from "@/components/domain/shared";
import { PersonalImportIsland } from "@/components/domain/personal-import";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { WelcomeToast } from "@/components/domain/welcome";
import { QuickReportProvider } from "@/components/domain/support";
import { QuickAddProvider } from "@/components/domain/quick-add";
import { SearchProvider } from "@/components/domain/search";
// Direct file import: the auth barrel also carries the login preview, which the app layout must not load.
import { RememberReturningUser } from "@/components/domain/auth/remember-returning-user";
import { auth } from "@/lib/auth";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout of every signed-in app page: AppShell with the sidebar (and its financial summary), the global sync panel, the «Scrivici» sheet, the «‹» history, the "hide amounts" preference, the remembered account for «Rientra in BuddyBudget» and the «Dall'ultima visita» toast with its visit heartbeat. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isPublicDemo = isPublicDemoUserId(session?.user.id);
  return (
    <PrivacyProvider initialHidden={session?.user.hideAmounts === true}>
      <QuickReportProvider>
      <BackHistoryRecorder />
      <QuickAddProvider>
      <SearchProvider>
      <AttentionShell sidebarExtra={<SidebarInsightsSlot />}>
        <PrivacyBoundary>
          {isPublicDemo ? (
            <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
              <PublicDemoBanner />
            </div>
          ) : (
            <>
              <DemoBannerContainer />
              <StartProgressWatcher />
            </>
          )}
          {children}
          {isPublicDemo ? <PublicDemoFooter /> : null}
        </PrivacyBoundary>
      </AttentionShell>
      {/* Outside the shell: the section transition remounts the page at every section change, the toast must not. */}
      {!isPublicDemo && <WelcomeToast />}
      </SearchProvider>
      </QuickAddProvider>
      <SyncProgressIndicator>
        <PersonalImportIsland />
      </SyncProgressIndicator>
      </QuickReportProvider>
      {/* The shared demo account is never remembered as "your" account on the sign-in page. */}
      {session && !isPublicDemo && <RememberReturningUser email={session.user.email} />}
    </PrivacyProvider>
  );
}
