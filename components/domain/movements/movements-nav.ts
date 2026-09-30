import { ListOrdered, PieChart, Tags } from "lucide-react";
import type { SectionTab } from "@/components/domain/shared";

/** Schede di Movimenti: l'elenco è la radice, Analisi raccoglie ciò che prima stava in Cash flow, Categorie la gestione. */
export const MOVEMENTS_TABS: readonly SectionTab[] = [
  { href: "/movimenti", label: "Elenco", icon: ListOrdered },
  { href: "/movimenti/analisi", label: "Analisi", icon: PieChart },
  { href: "/movimenti/categorie", label: "Categorie", icon: Tags },
];

/** Scheda in cui il periodo e "Aggiungi" non hanno senso (gestione delle categorie). */
export const MOVEMENTS_CATEGORIES_HREF = "/movimenti/categorie";
