import { BrandLink, LoginHorizon, NewFeatureNote, UpcomingFeatures } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";

/** Layout delle pagine di autenticazione/onboarding: scena con patrimonio di esempio e grafico a tutta larghezza, form a sinistra. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoginHorizon
      header={<BrandLink name={BRAND_NAME} className="text-xl" showBackLink />}
      aside={
        <>
          <NewFeatureNote />
          <UpcomingFeatures className="[@media(max-height:820px)]:hidden" />
          <p className="text-xs text-text-3">Collegamento bancario tramite Open Banking (PSD2), in sola lettura.</p>
        </>
      }
    >
      {children}
    </LoginHorizon>
  );
}
