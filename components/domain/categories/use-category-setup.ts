"use client";

/** Stato del passo «Categorie» dell'onboarding: la proposta e le modifiche dell'utente (spegni, rinomina, aggiungi). */

import { useLocalization } from "@/lib/localization/provider";
import { localizedCategoryProposal } from "@/lib/localization/categories";
import * as React from "react";
import {
  CUSTOM_CATEGORY_ICON,
  FALLBACK_SETUP_NAME,
  isCustomized,
  validateCategorySetup,
  type CategoryProposalItem,
  type CategorySetupItem,
} from "@/lib/categories/setup";
import type { CategoryType } from "@/lib/categories/groups";

export interface UseCategorySetupResult {
  items: CategoryProposalItem[];
  /** True se l'utente ha cambiato qualcosa rispetto alla proposta. */
  customized: boolean;
  /** Problema da correggere (nome vuoto o doppio), in parole dell'utente; null se va bene. */
  problem: string | null;
  toggle: (index: number, enabled: boolean) => void;
  /** Rinomina; restituisce il motivo se il nome non va (vuoto, doppio, troppo lungo) e in quel caso non cambia nulla. */
  rename: (index: number, name: string) => string | null;
  /** Aggiunge una categoria accesa nel gruppo; come `rename`, restituisce il motivo se il nome non va. */
  add: (type: CategoryType, name: string) => string | null;
  reset: () => void;
  /** Scelte da inviare all'onboarding: `undefined` se l'utente non ha cambiato nulla. */
  payload: CategorySetupItem[] | undefined;
}

/** Tiene la proposta di categorie e le modifiche fatte nel foglio «Personalizza». */
export function useCategorySetup(): UseCategorySetupResult {
  const { productCountry, language } = useLocalization();
  const profileKey = `${productCountry}:${language}`;
  const initial = React.useMemo(() => localizedCategoryProposal({ productCountry, language }), [productCountry, language]);
  const [draft, setDraft] = React.useState<{ profileKey: string; items: CategoryProposalItem[] } | null>(null);
  const items = draft?.profileKey === profileKey ? draft.items : initial;
  const setItems = (next: React.SetStateAction<CategoryProposalItem[]>) => setDraft({ profileKey, items: typeof next === "function" ? next(items) : next });

  const setup = React.useMemo(() => items.map(({ key, name, type, enabled }) => ({ key, name, type, enabled })), [items]);
  const customized = React.useMemo(() => isCustomized(setup), [setup]);
  const problem = React.useMemo(() => validateCategorySetup(setup, [FALLBACK_SETUP_NAME]), [setup]);

  const update = (index: number, patch: Partial<CategoryProposalItem>) =>
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));

  /** Motivo per cui le scelte, con questa modifica, non andrebbero; null se vanno. */
  const check = (next: CategoryProposalItem[]) =>
    validateCategorySetup(next.map(({ key, name, type, enabled }) => ({ key, name, type, enabled })), [FALLBACK_SETUP_NAME]);

  return {
    items,
    customized,
    problem,
    toggle: (index, enabled) => update(index, { enabled }),
    rename: (index, name) => {
      const next = items.map((item, position) => (position === index ? { ...item, name, enabled: true } : item));
      const reason = check(next);
      if (!reason) setItems(next);
      return reason;
    },
    add: (type, name) => {
      const added: CategoryProposalItem = { key: null, name, type, enabled: true, icon: CUSTOM_CATEGORY_ICON, color: "slate", description: null, optional: false };
      const next = [...items, added];
      const reason = check(next);
      if (!reason) setItems(next);
      return reason;
    },
    reset: () => setItems(initial),
    payload: customized && !problem ? setup : undefined,
  };
}
