import { AuthSheet, BrandLink } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";
const SHEET_NOTE = "Banca in sola lettura · Server in Germania";

/** Layout delle pagine di autenticazione/onboarding: un foglio di calcolo con il form nella colonna B e le schede in basso. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSheet header={<BrandLink name={BRAND_NAME} className="text-xl" showBackLink />} note={SHEET_NOTE}>
      {children}
    </AuthSheet>
  );
}
