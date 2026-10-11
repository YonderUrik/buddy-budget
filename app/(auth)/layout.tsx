import { AuthSheet, BrandLink } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";
const SHEET_NOTE = "Banca in sola lettura · Server in Germania";
/** Nell'onboarding resta solo il form: l'esempio animato serve a chi non è ancora entrato. */
const ASIDE_HIDDEN_ON = ["/onboarding"] as const;

/** Layout delle pagine di autenticazione/onboarding: un foglio di calcolo con il form nella colonna B e l'esempio animato a destra (non nell'onboarding). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSheet header={<BrandLink name={BRAND_NAME} className="text-xl" showBackLink />} note={SHEET_NOTE} asideHiddenOn={ASIDE_HIDDEN_ON}>
      {children}
    </AuthSheet>
  );
}
