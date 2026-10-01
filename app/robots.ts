import type { MetadataRoute } from "next";

/** L'app (app.buddybudget.io) non va indicizzata: i contenuti pubblici stanno sulla landing (buddybudget.io). */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
