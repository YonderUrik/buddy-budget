import { DEFAULT_CATEGORIES, OPTIONAL_DEFAULT_CATEGORIES } from "@/lib/categories/defaults";
import { LANGUAGES, PRODUCT_COUNTRIES } from "./config";
import { buildCategoryProposal } from "@/lib/categories/setup";
import { translate } from "./messages";
import type { LocaleProfile } from "./config";
/** Country-specific defaults, shared by onboarding and existing category labels. */
export function localizedCategoryProposal(profile: LocaleProfile) {
  return buildCategoryProposal().map(category => {
    let description = category.description;
    // Italian tax examples (F24, 730) only under the Italian rules.
    if (profile.productCountry !== "IT") {
      if (category.key === "tasse") description = "Imposte e tributi";
      if (category.key === "rimborsi") description = "Resi, rimborsi fiscali, soldi restituiti";
    }
    return { ...category, name: translate(profile.language, category.name), description: translate(profile.language, description) };
  });
}

const categoryDefaults = [...DEFAULT_CATEGORIES, ...OPTIONAL_DEFAULT_CATEGORIES];
const descriptionsByKey = new Map(categoryDefaults.map(category => [category.key, new Set(
  LANGUAGES.flatMap(language => PRODUCT_COUNTRIES.map(productCountry =>
    localizedCategoryProposal({ language, productCountry }).find(entry => entry.key === category.key)?.description
  ))
)]));
/** Recognise only known labels of an explicitly identified default, never arbitrary user text. */
export function isDefaultCategoryName(key: string | null | undefined, name: string) {
  const original = categoryDefaults.find(category => category.key === key);
  return !!original && LANGUAGES.some(language => translate(language, original.name) === name);
}

/** Presentation only: IDs, stored names, assignments and financial data stay unchanged. */
export function localizeCategory<T extends { name: string; defaultKey?: string | null; description?: string | null; isFallback?: boolean }>(category: T, profile: LocaleProfile): T {
  const key = category.isFallback ? "da-categorizzare" : category.defaultKey;
  const original = categoryDefaults.find(entry => entry.key === key);
  if (!original) return category;
  const proposal = localizedCategoryProposal(profile).find(entry => entry.key === key);
  const defaultDescription = category.description != null && descriptionsByKey.get(original.key)?.has(category.description);
  return {
    ...category,
    name: category.isFallback || isDefaultCategoryName(key, category.name) ? translate(profile.language, original.name) : category.name,
    ...(defaultDescription && proposal ? { description: proposal.description } : {}),
  };
}
