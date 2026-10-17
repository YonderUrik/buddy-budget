import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/sofia-sans-extra-condensed";
import "@/app/globals.css";
import { BrandSprite } from "@/components/brand";
import { RiseObserver } from "@/components/rise-observer";
import { APP_URL, OG_IMAGE, SITE_NAME, SITE_URL } from "@/content/site";
import { HTML_LANG, LOCALES, OG_LOCALE, SCHEMA_LANGUAGE, type Locale } from "@/lib/i18n";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { LANG_HINT_STORAGE_KEY } from "@/lib/lang-hint";
import { SCREEN_LANGUAGE_SCRIPT } from "@/lib/screen-variants";
import { UtmPassthrough } from "@/components/utm-passthrough";

const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
// The script goes through the app's `/stats` proxy (avoids tracker blocks); `data-domains` limits counting to the real domain.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC ?? `${APP_URL}/stats/script.js`;
const UMAMI_DOMAINS = new URL(SITE_URL).hostname;

export const ROOT_VIEWPORT: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export interface RootMetaText {
  title: string;
  description: string;
  ogAlt: string;
}

/** Metadata shared by every page of one language: title, description, Open Graph in that language, icons. */
export function rootMetadata(locale: Locale, text: RootMetaText): Metadata {
  const image = { ...OG_IMAGE, alt: text.ogAlt };
  return {
    metadataBase: new URL(SITE_URL),
    title: text.title,
    description: text.description,
    openGraph: {
      title: text.title,
      description: text.description,
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: "website",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: text.title, description: text.description, images: [OG_IMAGE.url] },
    // Google wants a square icon with a side multiple of 48 px (ico/png/svg) and rereads the favicon only after a new crawl.
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
        { url: "/icons/icon-96.png", type: "image/png", sizes: "96x96" },
        { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

/**
 * Structured data of every page: organisation and site. `SoftwareApplication`/`WebApplication` are left out on
 * purpose: Google accepts them only with real `aggregateRating` or `review`, which we do not have. The FAQ is only on
 * the homes, where the questions are visible.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icons/icon-512.png` },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, inLanguage: LOCALES.map((l) => SCHEMA_LANGUAGE[l]), publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
};

/** Sets the saved theme and `js-motion` before the first paint: hidden initial states exist only if animations can run. */
const BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}
if(window.matchMedia("(prefers-reduced-motion: no-preference)").matches)document.documentElement.classList.add("js-motion")`;

/**
 * Italian pages only: before the first paint, marks `<html data-lang-hint>` when the browser's preferred language is
 * not Italian and the bar was never closed, so the «also in English» bar shows without moving the page after load.
 */
const LANG_HINT_SCRIPT = `try{var l=(navigator.languages&&navigator.languages[0])||navigator.language||"";if(l&&!/^it\\b/i.test(l)&&localStorage.getItem("${LANG_HINT_STORAGE_KEY}")!=="1")document.documentElement.dataset.langHint="en"}catch(e){}`;

/**
 * The `<html>` of one language, shared by the two root layouts (`app/(it)/layout.tsx`, `app/en/layout.tsx`): `lang`,
 * the boot script, structured data, the brand sprite and Umami. English pages also carry `data-screens="en"`, which
 * switches the app screenshots to their English captures; Italian pages pick them from `?lang=` or the browser
 * (`SCREEN_LANGUAGE_SCRIPT`).
 */
export function RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html lang={HTML_LANG[locale]} data-screens={locale === "en" ? "en" : undefined} suppressHydrationWarning>
      <body>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- rendered only by the root layouts (and the global 404) */}
        <Script id="boot" strategy="beforeInteractive">
          {locale === "it" ? `${BOOT_SCRIPT}\n${SCREEN_LANGUAGE_SCRIPT}\n${LANG_HINT_SCRIPT}` : BOOT_SCRIPT}
        </Script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
        <BrandSprite />
        {children}
        <RiseObserver />
        <UtmPassthrough appUrl={APP_URL} />
        {UMAMI_ID ? <Script src={UMAMI_SRC} data-website-id={UMAMI_ID} data-domains={UMAMI_DOMAINS} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
