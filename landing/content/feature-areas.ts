/**
 * Presentazione delle aree nella pagina «Tutte le funzioni»: icona (la stessa della sidebar dell'app), una frase
 * d'introduzione, una schermata vera e un eventuale approfondimento. Le funzioni vere e proprie
 * vengono dal catalogo condiviso (`catalog.generated.ts`): qui c'è solo il contorno.
 */
import type { FeatureArea } from "./catalog.generated";
import type { HomeIcon } from "./home";
import type { ScreenId } from "./screens";
import { CONTENT_PATHS } from "./seo-pages";

export interface AreaMeta {
  /** Ancora della sezione (`/funzioni#liquidita`). */
  slug: string;
  icon: HomeIcon;
  intro: string;
  shot?: { id: ScreenId };
  more?: { href: string; label: string };
}

export const AREA_META: Record<FeatureArea, AreaMeta> = {
  Liquidità: {
    slug: "liquidita",
    icon: "wallet",
    intro: "Conti collegati in sola lettura o tenuti a mano, movimenti con la categoria giusta e le spese divise nei quattro gruppi.",
    shot: { id: "movimenti" },
  },
  Investimenti: {
    slug: "investimenti",
    icon: "trending",
    intro: "Il rendimento calcolato dalle tue operazioni, il confronto con un indice, il rischio e le tasse secondo le regole italiane.",
    shot: { id: "investimenti" },
    more: { href: CONTENT_PATHS.funzioneInvestimenti, label: "Gli investimenti nel dettaglio" },
  },
  Debiti: {
    slug: "debiti",
    icon: "card",
    intro: "Mutui e finanziamenti con il piano delle rate, il TAEG e la simulazione di un'estinzione anticipata.",
    shot: { id: "debiti" },
    more: { href: CONTENT_PATHS.ammortamento, label: "Calcolatore della rata" },
  },
  Patrimonio: {
    slug: "patrimonio",
    icon: "dashboard",
    intro: "Il quadro d'insieme: il patrimonio netto giorno per giorno, il fondo pensione e l'anno in cui puoi smettere di lavorare.",
    shot: { id: "panoramica" },
  },
  Account: {
    slug: "account",
    icon: "shield",
    intro: "Accesso senza password, i dati che esporti quando vuoi e un'app che si installa sul telefono.",
  },
};
