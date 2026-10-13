import { buildCategoryProposal } from "@/lib/categories/setup";
import { translate } from "./messages";
import type { LocaleProfile } from "./config";
/** Localise suggestions before they become user-owned data; never rename existing categories on a language switch. */
export function localizedCategoryProposal(profile: LocaleProfile) {
  return buildCategoryProposal().map(category => {
    let description = category.description;
    if (profile.productCountry === "DE") {
      if (category.key === "tasse") description = "Imposte e tributi";
      if (category.key === "rimborsi") description = "Resi, rimborsi fiscali, soldi restituiti";
    }
    return { ...category, name: translate(profile.language, category.name), description: translate(profile.language, description) };
  });
}
