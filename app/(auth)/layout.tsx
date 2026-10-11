import { AuthSheet, BrandLink } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";
const SHEET_NOTE = "Banca in sola lettura · Server in Germania";
/** Nell'onboarding resta solo il form: le schede «Cosa c'è dentro» e «Novità» servono a chi non è ancora entrato. */
const TABS_HIDDEN_ON = ["/onboarding"] as const;

/** Layout delle pagine di autenticazione/onboarding: un foglio di calcolo con il form nella colonna B e le schede in basso (non nell'onboarding). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSheet header={<BrandLink name={BRAND_NAME} className="text-xl" showBackLink />} note={SHEET_NOTE} tabsHiddenOn={TABS_HIDDEN_ON}>
      {children}
    </AuthSheet>
  );
}
