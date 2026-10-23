import type { MetadataRoute } from "next";
import { LEGAL_PATHS } from "@/content/legal";
import { PAGE_PAIRS } from "@/content/locales";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

export const dynamic = "force-static";

/** Absolute URL of a path (the home without the trailing slash). */
const url = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

/** hreflang of a page that exists in both languages, as in its `<head>` (`languageAlternates`). */
function languages(path: string): MetadataRoute.Sitemap[number]["alternates"] {
  const pair = PAGE_PAIRS.find((p) => p.it === path || p.en === path);
  return pair ? { languages: { it: url(pair.it), en: url(pair.en), "x-default": url(pair.en) } } : undefined;
}

/**
 * Sitemap of the landing. No `lastmod`: the build date on every page told Google that all pages changed at every
 * deploy, so Google learns to ignore the field (and gains nothing to schedule crawls); a real date per page would
 * need the content's own history, which the image build does not have.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = { url: SITE_URL, changeFrequency: "monthly", priority: 1, alternates: languages("/") };
  const content: MetadataRoute.Sitemap = CONTENT_DRAFT
    ? []
    : Object.values(CONTENT_PATHS).map((path) => ({ url: url(path), changeFrequency: "monthly" as const, priority: 0.7, alternates: languages(path) }));
  const english: MetadataRoute.Sitemap = PAGE_PAIRS.filter((p) => p.it === "/" || !CONTENT_DRAFT).map((p) => ({
    url: url(p.en),
    changeFrequency: "monthly" as const,
    priority: p.it === "/" ? 0.9 : 0.6,
    alternates: languages(p.en),
  }));
  return [home, ...content, ...english, ...Object.values(LEGAL_PATHS).map((path) => ({ url: url(path), changeFrequency: "yearly" as const, priority: 0.3 }))];
}
