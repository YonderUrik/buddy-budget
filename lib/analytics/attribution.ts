/**
 * Where a visitor came from (`?utm_source=instagram&utm_campaign=lancio…`), kept for the signup events. Only slugs
 * pass: free text from a URL never reaches Umami, so props stay categorical.
 */

/** Campaign of an arrival, as slugs; a missing key means the link did not carry it. */
export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

const ATTRIBUTION_QUERY: Record<keyof Attribution, string> = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
};

/** localStorage key: the signup goes through an email link that may open in another tab, so session storage is not enough. */
export const ATTRIBUTION_STORAGE_KEY = "bb-attribution";

const MAX_SLUG_LENGTH = 40;
const SLUG_PATTERN = /^[a-z0-9_-]+$/;

/** Lower-cased slug, or `undefined` when the value is empty, too long or has other characters. */
function toSlug(value: string | null | undefined): string | undefined {
  const slug = value?.trim().toLowerCase();
  return slug && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug) ? slug : undefined;
}

/** Campaign parameters of a query string, as an {@link Attribution} (empty when the link had none). */
export function attributionFromSearch(params: Pick<URLSearchParams, "get">): Attribution {
  const attribution: Attribution = {};
  for (const [key, query] of Object.entries(ATTRIBUTION_QUERY) as [keyof Attribution, string][]) {
    const slug = toSlug(params.get(query));
    if (slug) attribution[key] = slug;
  }
  return attribution;
}

/** Remembers the arrival's campaign (the last one wins); no-op when the link carried none. Never throws: storage can be blocked. */
export function saveAttribution(attribution: Attribution): void {
  if (!Object.keys(attribution).length) return;
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Blocked storage: the events of this visit still carry it.
  }
}

/** The saved campaign, or an empty one. */
export function loadAttribution(): Attribution {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const attribution: Attribution = {};
    for (const key of Object.keys(ATTRIBUTION_QUERY) as (keyof Attribution)[]) {
      const slug = typeof saved[key] === "string" ? toSlug(saved[key]) : undefined;
      if (slug) attribution[key] = slug;
    }
    return attribution;
  } catch {
    return {};
  }
}
