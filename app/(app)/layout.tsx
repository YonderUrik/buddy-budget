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
import { auth } from "@/lib/auth";
import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { AttentionShell } from "./attention-shell";
import { SidebarInsightsSlot } from "./sidebar-insights-slot";

/** Layout per tutte le pagine dell'app autenticate: monta AppShell con sidebar (e il suo riepilogo finanziario), il pannello globale dei sync, il foglio «Scrivici», la cronologia del link «‹», la preferenza "nascondi importi" e il ricordo dell'account per «Rientra in BuddyBudget». */
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
      {/* The shared demo account is never remembered as "your" account on the sign-in page. */}
      {session && !isPublicDemo && <RememberReturningUser email={session.user.email} />}
    </PrivacyProvider>
  );
}
