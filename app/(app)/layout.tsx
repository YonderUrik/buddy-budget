import { headers } from "next/headers";
import { PrivacyBoundary, PrivacyProvider } from "@/components/privacy-provider";
import { DemoBannerContainer, StartProgressWatcher } from "@/components/domain/start";
import { PublicDemoBanner, PublicDemoFooter } from "@/components/domain/public-demo";
import { BackHistoryRecorder } from "@/components/domain/shared";
import { PersonalImportIsland } from "@/components/domain/personal-import";
import { SyncProgressIndicator } from "@/components/domain/sync";
import { WelcomeToast } from "@/components/domain/welcome";
import { QuickReportProvider } from "@/components/domain/support";
// Direct file import: the auth barrel also carries the login preview, which the app layout must not load.
import { RememberReturningUser } from "@/components/domain/auth/remember-returning-user";
import { PlanProvider } from "@/components/domain/billing";
import { auth } from "@/lib/auth";
import { OPEN_PLAN, PRO_AREAS } from "@/lib/billing";
import { planForUser } from "@/lib/billing/plan-for-user";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout of every signed-in app page: AppShell with the sidebar (and its financial summary), the global sync panel, the «Scrivici» sheet, the «‹» history, the "hide amounts" preference, the remembered account for «Rientra in BuddyBudget», the plan (Free sections locked) and the «Dall'ultima visita» toast with its visit heartbeat. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isPublicDemo = isPublicDemoUserId(session?.user.id);
  const plan = session ? planForUser(session.user) : OPEN_PLAN;
  // Free plan: the Pro sections keep their place in the navigation with a lock, and the sidebar summary (Pro data) is off.
  const lockedHrefs = plan.tier === "free" ? PRO_AREAS.map((area) => area.path) : undefined;
  return (
    <PrivacyProvider initialHidden={session?.user.hideAmounts === true}>
      <PlanProvider plan={plan}>
      <QuickReportProvider>
      <BackHistoryRecorder />
      <AttentionShell sidebarExtra={plan.tier === "free" ? undefined : <SidebarInsightsSlot />} lockedHrefs={lockedHrefs}>
        <PrivacyBoundary>
          {isPublicDemo ? (
            <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
              <PublicDemoBanner />
            </div>
          ) : (
            <>
              <DemoBannerContainer />
              <StartProgressWatcher />
              <WelcomeToast />
            </>
          )}
          {children}
          {isPublicDemo ? <PublicDemoFooter /> : null}
        </PrivacyBoundary>
      </AttentionShell>
      <SyncProgressIndicator>
        <PersonalImportIsland />
      </SyncProgressIndicator>
      </QuickReportProvider>
      </PlanProvider>
      {/* The shared demo account is never remembered as "your" account on the sign-in page. */}
      {session && !isPublicDemo && <RememberReturningUser email={session.user.email} />}
    </PrivacyProvider>
  );
}
