import { HomeIcon, PlaneIcon, ShieldCheckIcon, ShoppingBagIcon, SparklesIcon, TargetIcon, type LucideIcon } from "lucide-react";
import type { GoalKind } from "@/lib/goals/constants";

/** Come si presenta un tipo di obiettivo: nome, icona, colore (token) e nome proposto nel form. */
export interface GoalKindInfo {
  label: string;
  /** Una riga sotto il nome nel primo passo del form. */
  hint: string;
  icon: LucideIcon;
  color: string;
  /** Nome proposto quando si sceglie il tipo (l'utente lo può cambiare). */
  defaultName: string;
}

export const GOAL_KIND_INFO: Record<GoalKind, GoalKindInfo> = {
  emergenza: { label: "Fondo di emergenza", hint: "Qualche mese di spese da parte per gli imprevisti", icon: ShieldCheckIcon, color: "var(--swatch-teal)", defaultName: "Fondo di emergenza" },
  viaggio: { label: "Viaggio", hint: "Una vacanza o un viaggio da pagare senza debiti", icon: PlaneIcon, color: "var(--swatch-amber)", defaultName: "Viaggio" },
  casa: { label: "Casa", hint: "L'anticipo di una casa o dei lavori", icon: HomeIcon, color: "var(--swatch-violet)", defaultName: "Anticipo casa" },
  acquisto: { label: "Un acquisto", hint: "Un'auto, un computer, un matrimonio", icon: ShoppingBagIcon, color: "var(--swatch-blue)", defaultName: "" },
  altro: { label: "Qualcos'altro", hint: "Qualunque cosa per cui vuoi mettere da parte", icon: SparklesIcon, color: "var(--swatch-pink)", defaultName: "" },
};

/** Il traguardo delle Analitiche, mostrato come ultimo obiettivo. */
export const FIRE_GOAL_INFO = { icon: TargetIcon, color: "var(--swatch-emerald)" } as const;

/** Colore della parte che manca nella barra del risparmio. */
export const GAP_COLOR = "var(--neg)";
