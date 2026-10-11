/** Gruppi mostrati nel passo «Categorie» dell'onboarding, nell'ordine delle colonne di Categorie. */

import { EXPENSE_GROUP_KEYS, EXPENSE_GROUPS, type CategoryType } from "@/lib/categories/groups";

export interface SetupGroup {
  type: CategoryType;
  label: string;
  /** Classe Tailwind del pallino del gruppo. */
  dotClassName: string;
}

export const SETUP_GROUPS: SetupGroup[] = [
  ...EXPENSE_GROUP_KEYS.map((type) => ({ type, label: EXPENSE_GROUPS[type].label, dotClassName: EXPENSE_GROUPS[type].dotClassName })),
  { type: "entrata", label: "Entrate", dotClassName: "bg-pos" },
];
