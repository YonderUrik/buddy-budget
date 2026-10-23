import type { MetadataRoute } from "next";

/**
 * The app (app.buddybudget.io) stays out of the index: public content lives on the landing (buddybudget.io).
 * `/login` stays crawlable so Google reads its `noindex` and drops it: the landing links it from every page, and a
 * blocked but linked URL can still end up indexed without content.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/login", disallow: "/" } };
}
