/** Le aree dell'app mostrate in fila sotto il grafico del login: nome, frase corta, icona e colore dell'ambito. */

import { ArrowLeftRightIcon, CreditCardIcon, LandmarkIcon, ReceiptTextIcon, TrendingUpIcon, UmbrellaIcon, type LucideIcon } from "lucide-react";

export interface LoginArea {
  name: string;
  description: string;
  icon: LucideIcon;
  /** Token CSS del colore dell'ambito (come nelle sezioni della Panoramica). */
  color: string;
}

export const LOGIN_AREAS: readonly LoginArea[] = [
  { name: "Liquidità", description: "conti collegati, in sola lettura", icon: LandmarkIcon, color: "var(--primary)" },
  { name: "Investimenti", description: "rendimento e tasse italiane", icon: TrendingUpIcon, color: "var(--swatch-blue)" },
  { name: "Pensione", description: "fondo e TFR a confronto", icon: UmbrellaIcon, color: "var(--swatch-amber)" },
  { name: "Debiti", description: "rate ed estinzioni", icon: CreditCardIcon, color: "var(--neg)" },
  { name: "Movimenti", description: "già categorizzati", icon: ReceiptTextIcon, color: "var(--swatch-violet)" },
  { name: "Cash flow", description: "quanto risparmi", icon: ArrowLeftRightIcon, color: "var(--swatch-teal)" },
];
