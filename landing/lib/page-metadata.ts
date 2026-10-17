import type { Metadata } from "next";
import { OG_ALT_EN } from "@/content/en/home";
import { OG_IMAGE, SITE_NAME } from "@/content/site";
import { LOCALES, OG_LOCALE, type Locale } from "@/lib/i18n";

/**
 * Completes a page's metadata with its own Open Graph and Twitter card. Next.js replaces `openGraph` as a whole, so a
 * page that only sets `title` and `alternates` would share the home's `og:title` and `og:url` from the root layout:
 * link previews (WhatsApp, Reddit, Telegram) and assistants reading the meta tags would then see the home instead of
 * the page. The Open Graph address is the page's canonical one.
 */
export function pageMetadata(locale: Locale, meta: Metadata & { title: string; description: string }): Metadata {
  const canonical = meta.alternates?.canonical;
  if (typeof canonical !== "string") throw new Error(`Page without a canonical address: ${meta.title}`);
  const image = { ...OG_IMAGE, alt: locale === "en" ? OG_ALT_EN : OG_IMAGE.alt };
  return {
    ...meta,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: "website",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images: [OG_IMAGE.url] },
  };
}
