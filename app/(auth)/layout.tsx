import { LanguagePicker } from "@/components/domain/auth/language-picker";
import { AuthFootLinks, AuthFrame, BrandLink } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";
/** Nell'onboarding resta solo il form: l'anteprima serve a chi non è ancora entrato. */
const ASIDE_HIDDEN_ON = ["/onboarding"] as const;

/** Layout delle pagine di autenticazione/onboarding: pannello del form a sinistra, anteprima della Panoramica a destra (non nell'onboarding). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame
      brand={
        <>
          <BrandLink name={BRAND_NAME} className="text-lg" />
          <LanguagePicker />
        </>
      }
      foot={<AuthFootLinks />}
      asideHiddenOn={ASIDE_HIDDEN_ON}
    >
      {children}
    </AuthFrame>
  );
}
