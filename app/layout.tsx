import { getLocaleProfile } from "@/lib/localization/server";
import { LocalizationProvider } from "@/lib/localization/provider";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Space_Grotesk, Geist_Mono, Sofia_Sans_Extra_Condensed } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion";
import Script from "next/script";
import "./globals.css";
import { PwaInstallTracker } from "@/components/analytics";

/** Website ID del sito "BuddyBudget" nell'istanza Umami self-hosted (non segreto: finisce comunque nell'HTML). */
const UMAMI_WEBSITE_ID = "051f9e59-8ac4-4dc2-8d9e-825421b3af8c";
/**
 * Script Umami servito dallo stesso dominio via IngressRoute Traefik (repo infra, namespace app).
 * Il tracker invia gli eventi alla sua stessa cartella (/stats/api/send), instradata anch'essa a Umami.
 */
const UMAMI_SCRIPT_SRC = "/stats/script.js";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

/** Display face of the landing (tall, condensed, light): only for the big titles of the sign-in pages (`font-display`). */
const sofiaCondensed = Sofia_Sans_Extra_Condensed({
  variable: "--font-sofia-condensed",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BuddyBudget",
  description: "Gestione finanziaria personale — patrimonio, spese, investimenti.",
  // L'app sta su app.buddybudget.io e non va indicizzata (la landing è su buddybudget.io).
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BuddyBudget",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Valore letterale richiesto dal contratto Metadata di Next.js (colore chrome browser/status
  // bar) — tenere allineato a --background di :root e .dark in globals.css.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getLocaleProfile();
  return (
    <html
      lang={profile.language}
      className={`${hankenGrotesk.variable} ${spaceGrotesk.variable} ${sofiaCondensed.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full bg-background text-foreground font-sans">
        <Script src={UMAMI_SCRIPT_SRC} data-website-id={UMAMI_WEBSITE_ID} strategy="afterInteractive" />
        <LocalizationProvider profile={profile}><QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <MotionProvider>
              {children}
              <Toaster />
            </MotionProvider>
          </ThemeProvider>
        </QueryProvider></LocalizationProvider>
        <PwaInstallTracker />
      </body>
    </html>
  );
}
