/** I gruppi in cui è organizzata la pagina Impostazioni: id, titolo, riga di spiegazione e sezioni che contiene. */

import { Bell, Palette, ShieldCheck, TriangleAlert, UserRound, type LucideIcon } from "lucide-react";

export const SETTINGS_GROUP_IDS = ["account", "aspetto", "notifiche", "privacy", "pericolo"] as const;
export type SettingsGroupId = (typeof SETTINGS_GROUP_IDS)[number];

export interface SettingsGroupInfo {
  id: SettingsGroupId;
  label: string;
  /** Cosa si trova dentro, in italiano semplice (sotto il nome nell'elenco mobile). */
  summary: string;
  icon: LucideIcon;
  /** Gruppo da trattare come delicato (colore d'allerta). */
  danger?: boolean;
}

export const SETTINGS_GROUPS: readonly SettingsGroupInfo[] = [
  { id: "account", label: "Account", summary: "Il tuo profilo e i dispositivi collegati", icon: UserRound },
  { id: "aspetto", label: "Aspetto e uso", summary: "Valuta, tema, pagina iniziale e barra laterale", icon: Palette },
  { id: "notifiche", label: "Notifiche e AI", summary: "Email di riepilogo e avvisi, assistente per le categorie e dove l'app usa l'AI", icon: Bell },
  { id: "privacy", label: "Privacy e dati", summary: "Statistiche anonime, esportazione e informative", icon: ShieldCheck },
  { id: "pericolo", label: "Zona pericolosa", summary: "Azzera i dati, disattiva o elimina l'account", icon: TriangleAlert, danger: true },
];

/** Il gruppo indicato da `?sezione=`, o `null` se manca o non esiste. */
export function parseSettingsGroup(value: string | null | undefined): SettingsGroupId | null {
  return SETTINGS_GROUP_IDS.find((id) => id === value) ?? null;
}
