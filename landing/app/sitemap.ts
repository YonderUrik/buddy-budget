import type { MetadataRoute } from "next";
import { LEGAL_PATHS } from "@/content/legal";
import { PAGE_PAIRS } from "@/content/locales";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";
import { pageModified } from "@/lib/page-dates";

export const dynamic = "force-static";

/** Absolute URL of a path (the home without the trailing slash). */
const url = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

/** hreflang of a page that exists in both languages, as in its `<head>` (`languageAlternates`). */
function languages(path: string): MetadataRoute.Sitemap[number]["alternates"] {
  const pair = PAGE_PAIRS.find((p) => p.it === path || p.en === path);
  return pair ? { languages: { it: url(pair.it), en: url(pair.en), "x-default": url(pair.en) } } : undefined;
}

/** `lastModified` of a page: the last commit that changed its own content (`scripts/page-dates.mjs`), never the build date. */
function modified(path: string): Pick<MetadataRoute.Sitemap[number], "lastModified"> {
  const date = pageModified(path);
  return date ? { lastModified: date } : {};
}

/**
 * Sitemap of the landing. `lastmod` is the date of the last commit that touched the page's own texts and components
 * (not the build date, which told Google that every page changed at every deploy, see #494); without git history the
 * field is left out. After a release, `.github/workflows/indexnow.yml` sends the pages changed recently to IndexNow.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = { url: SITE_URL, ...modified("/"), changeFrequency: "monthly", priority: 1, alternates: languages("/") };
  const content: MetadataRoute.Sitemap = CONTENT_DRAFT
    ? []
    : Object.values(CONTENT_PATHS).map((path) => ({ url: url(path), ...modified(path), changeFrequency: "monthly" as const, priority: 0.7, alternates: languages(path) }));
  const english: MetadataRoute.Sitemap = PAGE_PAIRS.filter((p) => p.it === "/" || !CONTENT_DRAFT).map((p) => ({
    url: url(p.en),
    ...modified(p.en),
    changeFrequency: "monthly" as const,
    priority: p.it === "/" ? 0.9 : 0.6,
    alternates: languages(p.en),
  }));
  const legal: MetadataRoute.Sitemap = Object.values(LEGAL_PATHS).map((path) => ({ url: url(path), ...modified(path), changeFrequency: "yearly" as const, priority: 0.3 }));
  return [home, ...content, ...english, ...legal];
}
