import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { BrandSprite } from "@/components/brand";
import { SmoothScroll } from "@/components/smooth-scroll";
import { APP_URL, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/content/site";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
// Lo script passa dal proxy `/stats` dell'app (già esistente, evita i blocchi dei tracker); `data-domains` limita il conteggio al dominio vero.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC ?? `${APP_URL}/stats/script.js`;
const UMAMI_DOMAINS = new URL(SITE_URL).hostname;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, url: SITE_URL, locale: "it_IT", type: "website" },
  twitter: { card: "summary", title: SITE_TITLE, description: SITE_DESCRIPTION },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0E1B3D" };

/** Imposta tema salvato e `js-motion` prima del primo paint: gli stati iniziali nascosti esistono solo se le animazioni possono partire. */
const BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}
if(window.matchMedia("(prefers-reduced-motion: no-preference)").matches)document.documentElement.classList.add("js-motion")`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        <Script id="boot" strategy="beforeInteractive">
          {BOOT_SCRIPT}
        </Script>
        <BrandSprite />
        <SmoothScroll />
        {children}
        {UMAMI_ID ? <Script src={UMAMI_SRC} data-website-id={UMAMI_ID} data-domains={UMAMI_DOMAINS} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
