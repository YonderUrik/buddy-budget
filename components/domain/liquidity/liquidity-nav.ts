import { BarChart3, Gauge, Landmark, ListOrdered, Repeat, Tags } from "lucide-react";
import type { SectionTab } from "@/components/domain/shared";
import { LIQUIDITY_LINK_PARAMS } from "@/lib/liquidity/links";

/** Radice della sezione Liquidità. */
export const LIQUIDITY_HREF = "/liquidita";
/** Address parameter that opens Liquidità already filtered by account (the others: `LIQUIDITY_LINK_PARAMS`). */
export const LIQUIDITY_ACCOUNT_PARAM = LIQUIDITY_LINK_PARAMS.account;
/** Id of the tools above the list of Movimenti: a link filtered by category or text scrolls there. */
export const MOVEMENTS_LIST_ID = "elenco-movimenti";

/** Schede di Liquidità: i movimenti sono la radice; Categorie e regole raccoglie la gestione. */
export const LIQUIDITY_TABS: readonly SectionTab[] = [
  { href: LIQUIDITY_HREF, label: "Movimenti", icon: ListOrdered, description: "Entrate e uscite, ricerca e categorie" },
  { href: `${LIQUIDITY_HREF}/analisi`, label: "Analisi", icon: BarChart3, description: "Dove vanno i soldi, mese per mese" },
  { href: `${LIQUIDITY_HREF}/budget`, label: "Budget", icon: Gauge, description: "Quanto puoi ancora spendere nel mese, categoria per categoria" },
  { href: `${LIQUIDITY_HREF}/conti`, label: "Conti", icon: Landmark, description: "Saldi e collegamenti con le banche" },
  { href: `${LIQUIDITY_HREF}/abbonamenti`, label: "Abbonamenti", icon: Repeat, description: "Addebiti ricorrenti, costo al mese e prossimi addebiti" },
  { href: `${LIQUIDITY_HREF}/categorie`, label: "Categorie e regole", icon: Tags, description: "Gruppi di spesa e regole automatiche" },
];

/** Schede in cui il conto selezionato non filtra nulla (la gestione di categorie e regole è globale). */
export const LIQUIDITY_GLOBAL_HREFS = [`${LIQUIDITY_HREF}/budget`, `${LIQUIDITY_HREF}/abbonamenti`, `${LIQUIDITY_HREF}/categorie`, `${LIQUIDITY_HREF}/regole`] as const;
