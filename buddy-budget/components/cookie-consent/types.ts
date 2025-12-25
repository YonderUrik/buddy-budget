export type CookieCategory = "essential" | "analytics" | "marketing" | "embeds";

export interface CookieConsentContextValue {
  acceptedCategory: (category: CookieCategory) => boolean;
  acceptedService: (service: string, category: CookieCategory) => boolean;
  showPreferences: () => void;
  acceptedCategories: CookieCategory[];
}
