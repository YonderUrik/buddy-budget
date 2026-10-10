import { BarChart3, Landmark, ListOrdered, Tags } from "lucide-react";
import type { SectionTab } from "@/components/domain/shared";

/** Radice della sezione Liquidità. */
export const LIQUIDITY_HREF = "/liquidita";
/** Nome del parametro d'indirizzo che apre Liquidità già filtrata per conto. */
export const LIQUIDITY_ACCOUNT_PARAM = "conto";

/** Schede di Liquidità: i movimenti sono la radice; Categorie e regole raccoglie la gestione. */
export const LIQUIDITY_TABS: readonly SectionTab[] = [
  { href: LIQUIDITY_HREF, label: "Movimenti", icon: ListOrdered, description: "Entrate e uscite, ricerca e categorie" },
  { href: `${LIQUIDITY_HREF}/analisi`, label: "Analisi", icon: BarChart3, description: "Dove vanno i soldi, mese per mese" },
  { href: `${LIQUIDITY_HREF}/conti`, label: "Conti", icon: Landmark, description: "Saldi e collegamenti con le banche" },
  { href: `${LIQUIDITY_HREF}/categorie`, label: "Categorie e regole", icon: Tags, description: "Gruppi di spesa e regole automatiche" },
];

/** Schede in cui il conto selezionato non filtra nulla (la gestione di categorie e regole è globale). */
export const LIQUIDITY_GLOBAL_HREFS = [`${LIQUIDITY_HREF}/categorie`, `${LIQUIDITY_HREF}/regole`] as const;
