import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/content/site";
import { SCHEMA_LANGUAGE, type Locale } from "@/lib/i18n";
import { pageModified } from "@/lib/page-dates";

/** Inserisce dati strutturati schema.org; il `<` è escluso dal JSON per evitare la chiusura anticipata dello script. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export interface PageJsonLdInput {
  locale: Locale;
  path: string;
  /** The page's `<title>`: `name` and `headline` must match it. */
  title: string;
  description: string;
  /** `Article` for guides; everything else is a `WebPage` (a list of pages too, with `hasPart`). */
  type?: "WebPage" | "Article";
  /** Absolute or root-relative image; the Open Graph image when left out. */
  image?: string;
  /** Extra schema.org fields (`hasPart`, `author`…). */
  extra?: Record<string, unknown>;
}

/**
 * Structured data of one page, built from the same values as its metadata: name and headline equal to the title,
 * canonical address, language, image, the site it belongs to and `dateModified` from the page's last content change
 * (`lib/page-dates.ts`, left out when unknown).
 */
export function pageJsonLd({ locale, path, title, description, type = "WebPage", image, extra }: PageJsonLdInput): Record<string, unknown> {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const modified = pageModified(path);
  const img = image ?? OG_IMAGE.url;
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    mainEntityOfPage: url,
    name: title,
    headline: title,
    description,
    inLanguage: SCHEMA_LANGUAGE[locale],
    image: img.startsWith("/") ? `${SITE_URL}${img}` : img,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization`, "@type": "Organization", name: SITE_NAME },
    ...(modified ? { dateModified: modified } : {}),
    ...extra,
  };
}
