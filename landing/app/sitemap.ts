import type { MetadataRoute } from "next";
import { LEGAL_DRAFT, LEGAL_PATHS } from "@/content/legal";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = { url: SITE_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 1 };
  const content: MetadataRoute.Sitemap = CONTENT_DRAFT ? [] : Object.values(CONTENT_PATHS).map((path) => ({ url: `${SITE_URL}${path}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 }));
  if (LEGAL_DRAFT) return [home, ...content];
  return [home, ...content, ...Object.values(LEGAL_PATHS).map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "yearly" as const, priority: 0.3 }))];
}
