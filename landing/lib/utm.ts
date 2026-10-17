/** Campaign parameters carried from the landing to the app, so a signup can be traced back to its campaign. */
export const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

/** sessionStorage key: the parameters survive moving between landing pages before the click on a button. */
export const UTM_STORAGE_KEY = "bb-utm";

const MAX_VALUE_LENGTH = 60;

/** Campaign parameters of a query string; values are trimmed and capped, empty ones dropped. */
export function pickUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const picked: Record<string, string> = {};
  for (const key of UTM_PARAMS) {
    const value = params.get(key)?.trim().slice(0, MAX_VALUE_LENGTH);
    if (value) picked[key] = value;
  }
  return picked;
}

/**
 * Same address with the visitor's campaign parameters in place of the landing's defaults (`utm_source=landing`):
 * parameters the visitor did not bring are left as they are.
 */
export function withUtm(href: string, utm: Record<string, string>): string {
  const url = new URL(href);
  for (const [key, value] of Object.entries(utm)) url.searchParams.set(key, value);
  return url.toString();
}
