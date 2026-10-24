import type { Metadata } from "next";
import { OG_ALT_EN } from "@/content/en/home";
import { OG_IMAGE, SITE_NAME } from "@/content/site";
import { LOCALES, OG_LOCALE, type Locale } from "@/lib/i18n";

/** Lengths search results show without cutting: a title under 30 characters says nothing, over 60 it is truncated. */
export const TITLE_LENGTH = { min: 30, max: 60 } as const;
/** A description under 110 characters wastes the snippet, over 160 it is cut (and the engine may write its own). */
export const DESCRIPTION_LENGTH = { min: 110, max: 160 } as const;

/**
 * Completes a page's metadata with its own Open Graph and Twitter card. Next.js replaces `openGraph` as a whole, so a
 * page that only sets `title` and `alternates` would share the home's `og:title` and `og:url` from the root layout:
 * link previews (WhatsApp, Reddit, Telegram) and assistants reading the meta tags would then see the home instead of
 * the page. The Open Graph address is the page's canonical one. A title or description outside the lengths above stops
 * the build: it is rewritten by hand, never cut silently.
 */
export function pageMetadata(locale: Locale, meta: Metadata & { title: string; description: string }): Metadata {
  const canonical = meta.alternates?.canonical;
  if (typeof canonical !== "string") throw new Error(`Page without a canonical address: ${meta.title}`);
  const t = [...meta.title].length;
  if (t < TITLE_LENGTH.min || t > TITLE_LENGTH.max) throw new Error(`Title of ${canonical} is ${t} characters, not ${TITLE_LENGTH.min}-${TITLE_LENGTH.max}: ${meta.title}`);
  const d = [...meta.description].length;
  if (d < DESCRIPTION_LENGTH.min || d > DESCRIPTION_LENGTH.max) throw new Error(`Description of ${canonical} is ${d} characters, not ${DESCRIPTION_LENGTH.min}-${DESCRIPTION_LENGTH.max}`);
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
