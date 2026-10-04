import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/geist";
import "./globals.css";
import { BrandSprite } from "@/components/brand";
import { APP_URL, FAQ, OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/content/site";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
// Lo script passa dal proxy `/stats` dell'app (già esistente, evita i blocchi dei tracker); `data-domains` limita il conteggio al dominio vero.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC ?? `${APP_URL}/stats/script.js`;
const UMAMI_DOMAINS = new URL(SITE_URL).hostname;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, url: SITE_URL, siteName: SITE_NAME, locale: "it_IT", type: "website", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE.url] },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

/** Dati strutturati della home: organizzazione, sito, applicazione web e FAQ (le stesse domande della sezione visibile). */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icons/icon-512.png` },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, inLanguage: "it-IT", publisher: { "@id": `${SITE_URL}/#organization` } },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web, iOS, Android (PWA)",
      inLanguage: "it-IT",
      description: SITE_DESCRIPTION,
      image: `${SITE_URL}${OG_IMAGE.url}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
    },
  ],
};

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
        <BrandSprite />
        {children}
        {UMAMI_ID ? <Script src={UMAMI_SRC} data-website-id={UMAMI_ID} data-domains={UMAMI_DOMAINS} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
