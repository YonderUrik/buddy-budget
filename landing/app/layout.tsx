import type { Metadata } from "next";

/** URL pubblico della landing: base per canonical e Open Graph. */
export const LANDING_URL = "https://buddybudget.io";

export const metadata: Metadata = {
  metadataBase: new URL(LANDING_URL),
  title: "BuddyBudget",
  description: "Gestione finanziaria personale: patrimonio, spese, investimenti e debiti in un unico posto.",
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
