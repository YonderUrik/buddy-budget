import { ListOrdered, PieChart, Tags, Wand2 } from "lucide-react";
import type { SectionTab } from "@/components/domain/shared";

/** Schede di Movimenti: l'elenco è la radice, Analisi raccoglie ciò che prima stava in Cash flow, Categorie e Regole la gestione. */
export const MOVEMENTS_TABS: readonly SectionTab[] = [
  { href: "/movimenti", label: "Elenco", icon: ListOrdered },
  { href: "/movimenti/analisi", label: "Analisi", icon: PieChart },
  { href: "/movimenti/categorie", label: "Categorie", icon: Tags },
  { href: "/movimenti/regole", label: "Regole", icon: Wand2 },
];

/** Schede di gestione, in cui periodo e "Aggiungi" non hanno senso. */
export const MOVEMENTS_MANAGEMENT_HREFS = ["/movimenti/categorie", "/movimenti/regole"] as const;

/** Scheda che ha bisogno di più larghezza (la board delle categorie). */
export const MOVEMENTS_CATEGORIES_HREF = "/movimenti/categorie";
