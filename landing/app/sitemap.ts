import type { MetadataRoute } from "next";
import { LEGAL_DRAFT, LEGAL_PATHS } from "@/content/legal";
import { SITE_URL } from "@/content/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = { url: SITE_URL, changeFrequency: "monthly", priority: 1 };
  if (LEGAL_DRAFT) return [home];
  return [home, ...Object.values(LEGAL_PATHS).map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "yearly" as const, priority: 0.3 }))];
}
