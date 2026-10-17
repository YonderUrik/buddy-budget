/**
 * Scelta delle categorie nell'onboarding: proposta (categorie di default accese + facoltative spente) e piano che porta
 * le categorie appena create alla registrazione a quelle confermate dall'utente. Modulo puro, senza DB né React.
 */
import type { Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { DEFAULT_CATEGORIES, OPTIONAL_DEFAULT_CATEGORIES, type DefaultCategory } from "./defaults";
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import type { CategoryType } from "./groups";

/** Lunghezza massima del nome di una categoria scelto nell'onboarding. */
export const CATEGORY_NAME_MAX_LENGTH = 40;
/** Icona delle categorie aggiunte a mano nell'onboarding (si cambia dopo in Categorie). */
export const CUSTOM_CATEGORY_ICON: CategoryIcon = "package";

/** Una riga della proposta così come la vede e la modifica l'utente. `key` null = aggiunta dall'utente. */
export interface CategorySetupItem {
  key: string | null;
  name: string;
  type: CategoryType;
  enabled: boolean;
}

/** Nome della categoria di fallback, che nessuna scelta può riusare. */
export const FALLBACK_SETUP_NAME = DEFAULT_CATEGORIES.find((category) => category.isFallback)?.name ?? "Da categorizzare";

/** Riga della proposta con l'aspetto, per l'interfaccia del passo. */
export interface CategoryProposalItem extends CategorySetupItem {
  icon: CategoryIcon;
  color: CategoryColor;
  description: string | null;
  /** True per le facoltative: proposte spente, si accendono con un tocco. */
  optional: boolean;
}

const toProposal = (category: DefaultCategory, optional: boolean): CategoryProposalItem => ({
  key: category.key,
  name: category.name,
  type: category.type,
  icon: category.icon,
  color: category.color,
  description: category.description ?? null,
  enabled: !optional,
  optional,
});

/** Proposta iniziale del passo: le categorie di default (senza la fallback) accese e le facoltative spente. */
export function buildCategoryProposal(): CategoryProposalItem[] {
  return [
    ...DEFAULT_CATEGORIES.filter((category) => !category.isFallback).map((category) => toProposal(category, false)),
    ...OPTIONAL_DEFAULT_CATEGORIES.map((category) => toProposal(category, true)),
  ];
}

/** True se l'utente ha cambiato qualcosa rispetto alla proposta (per l'evento di prodotto e per non inviare nulla). */
export function isCustomized(items: CategorySetupItem[]): boolean {
  const proposal = buildCategoryProposal();
  if (items.length !== proposal.length) return true;
  return proposal.some((original, index) => {
    const item = items[index];
    return item.key !== original.key || item.enabled !== original.enabled || item.name.trim() !== original.name;
  });
}

/** Conteggi categorici delle scelte, da usare nell'evento Umami e nei log (mai i nomi). */
export function summarizeCategorySetup(items: CategorySetupItem[]) {
  const defaults = new Map(buildCategoryProposal().map((item) => [item.key, item]));
  let removed = 0;
  let renamed = 0;
  let optionalAdded = 0;
  let custom = 0;
  for (const item of items) {
    const original = item.key ? defaults.get(item.key) : undefined;
    if (!original) {
      if (item.enabled) custom += 1;
      continue;
    }
    if (!original.optional && !item.enabled) removed += 1;
    if (original.optional && item.enabled) optionalAdded += 1;
    if (item.enabled && item.name.trim() !== original.name) renamed += 1;
  }
  return { active: items.filter((item) => item.enabled).length, removed, renamed, optionalAdded, custom };
}

/** Why the choices are not valid, in the user's words and `language`; null if they are fine. */
export function validateCategorySetup(items: CategorySetupItem[], reservedNames: string[] = [], language: Language = "it"): string | null {
  const t = (source: string, values?: Record<string, string>) => translate(language, source, values);
  const seen = new Set(reservedNames.map((name) => name.trim().toLocaleLowerCase("it")));
  for (const item of items.filter((entry) => entry.enabled)) {
    const name = item.name.trim();
    if (!name) return t("Ogni categoria accesa deve avere un nome.");
    if (name.length > CATEGORY_NAME_MAX_LENGTH) return t("«{0}…» è troppo lungo.", { 0: name.slice(0, 20) });
    const normalized = name.toLocaleLowerCase("it");
    if (seen.has(normalized)) return t("«{0}» c'è già.", { 0: name });
    seen.add(normalized);
  }
  return null;
}

/** Riga esistente minima per il piano. */
export interface ExistingSetupCategory {
  id: string;
  name: string;
  isFallback: boolean;
}

export interface CategorySetupCreate {
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
  description: string | null;
}

export interface CategorySetupPlan {
  deletions: string[];
  renames: { id: string; name: string }[];
  creates: CategorySetupCreate[];
}

/**
 * Decide come portare le categorie appena create alla registrazione (nomi di default) alle scelte dell'utente.
 * Le categorie di default si riconoscono dal nome con cui sono state create; una default che l'utente non ha più fra
 * le scelte, o ha spento, si elimina. Le facoltative accese e quelle aggiunte si creano (le aggiunte con un colore non
 * ancora usato). La fallback non si tocca mai. Le scelte vanno validate prima con `validateCategorySetup`.
 */
export function planCategorySetup(existing: ExistingSetupCategory[], items: CategorySetupItem[]): CategorySetupPlan {
  const plan: CategorySetupPlan = { deletions: [], renames: [], creates: [] };
  const itemByKey = new Map(items.filter((item) => item.key).map((item) => [item.key as string, item]));
  const usedColors = new Set<string>();

  for (const category of DEFAULT_CATEGORIES.filter((entry) => !entry.isFallback)) {
    const row = existing.find((entry) => !entry.isFallback && entry.name === category.name);
    if (!row) continue;
    const item = itemByKey.get(category.key);
    if (!item?.enabled) {
      plan.deletions.push(row.id);
      continue;
    }
    usedColors.add(category.color);
    const name = item.name.trim();
    if (name !== row.name) plan.renames.push({ id: row.id, name });
  }

  for (const category of OPTIONAL_DEFAULT_CATEGORIES) {
    const item = itemByKey.get(category.key);
    if (!item?.enabled) continue;
    usedColors.add(category.color);
    plan.creates.push({
      name: item.name.trim(),
      type: category.type,
      icon: category.icon,
      color: category.color,
      description: category.description ?? null,
    });
  }

  const freeColors = SWATCH_BASE_COLORS.filter((color) => !usedColors.has(color));
  let colorIndex = 0;
  for (const item of items.filter((entry) => entry.key === null && entry.enabled)) {
    const color = freeColors[colorIndex % Math.max(freeColors.length, 1)] ?? "slate";
    colorIndex += 1;
    plan.creates.push({ name: item.name.trim(), type: item.type, icon: CUSTOM_CATEGORY_ICON, color, description: null });
  }
  return plan;
}
