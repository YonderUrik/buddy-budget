import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Space_Grotesk, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${hankenGrotesk.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full bg-background text-foreground font-sans">
        <Script src={UMAMI_SCRIPT_SRC} data-website-id={UMAMI_WEBSITE_ID} strategy="afterInteractive" />
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
        <Analytics />
        <PwaInstallTracker />
      </body>
    </html>
  );
}
