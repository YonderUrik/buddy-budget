import type { Language, ProductCountry } from "@/lib/localization/config";
import type { FlagCode } from "./flag";

/** Flag shown next to each interface language (English uses the British flag, matching the en-GB formats). */
export const LANGUAGE_FLAGS: Record<Language, FlagCode> = { it: "IT", en: "GB", de: "DE" };

/** Flag shown next to each product country. */
export const COUNTRY_FLAGS: Record<ProductCountry, FlagCode> = { IT: "IT", DE: "DE", OTHER: "WORLD" };
