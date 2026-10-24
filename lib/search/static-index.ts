/**
 * The part of the search that never asks the server: pages, settings and «Aggiungi» actions. Built once on the client
 * and filtered on every keystroke (a few hundred entries at most), so «notifiche» or «tema scuro» answer instantly and
 * work offline. Texts are Italian source keys; the palette matches both the key and its translation.
 */

import { QUICK_ADD_ACTIONS } from "@/lib/quick-add/actions";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { matchScore } from "./normalize";
import type { SearchHit, SearchIcon } from "./types";

export interface StaticEntry {
  id: string;
  group: "pagine" | "azioni";
  icon: SearchIcon;
  title: string;
  subtitle: string;
  /** Other words people may type for it («dark» for the theme, «csv» for imports). */
  keywords: string[];
  href?: string;
  quickAdd?: string;
}

/** Icon of a page: the one of its section in the menu, so «Budget del mese» looks like Liquidità. */
const PAGE_ICONS: [prefix: string, icon: SearchIcon][] = [
  ["/panoramica", "panoramica"],
  ["/liquidita", "liquidita"],
  ["/categorizza", "liquidita"],
  ["/importazioni", "liquidita"],
  ["/investimenti", "titolo"],
  ["/pensione", "pensione"],
  ["/debiti", "debito"],
  ["/analitiche", "analitiche"],
  ["/aiuto", "aiuto"],
];
const pageIcon = (href: string): SearchIcon => PAGE_ICONS.find(([prefix]) => href.startsWith(prefix))?.[1] ?? "pagina";

const page = (id: string, title: string, subtitle: string, href: string, keywords: string[] = []): StaticEntry => ({ id, group: "pagine", icon: pageIcon(href), title, subtitle, href, keywords });
const setting = (id: string, title: string, href: string, keywords: string[] = []): StaticEntry => ({ id, group: "pagine", icon: "impostazione", title, subtitle: "Impostazioni", href, keywords });

/** Every screen and setting worth jumping to. */
export const STATIC_ENTRIES: readonly StaticEntry[] = [
  page("panoramica", "Panoramica", "Il tuo patrimonio in un numero", "/panoramica", ["home", "patrimonio", "inizio"]),
  page("movimenti", "Movimenti", "Liquidità", "/liquidita", ["transazioni", "spese", "entrate"]),
  page("budget", "Budget del mese", "Liquidità", "/liquidita/budget", ["spendere", "limite"]),
  page("analisi", "Analisi delle spese", "Liquidità", "/liquidita/analisi", ["dove spendo", "grafico"]),
  page("conti", "Conti", "Liquidità", "/liquidita/conti", ["banca", "saldo"]),
  page("abbonamenti", "Abbonamenti", "Liquidità", "/liquidita/abbonamenti", ["ricorrenti", "netflix", "spotify"]),
  page("categorie", "Categorie e regole", "Liquidità", "/liquidita/categorie", ["regole", "gruppi"]),
  page("categorizza", "Da decidere", "Categorizza", "/categorizza", ["categorizza", "senza categoria"]),
  page("importazioni", "Importazioni", "Liquidità", "/importazioni", ["csv", "excel", "file"]),
  page("portafoglio", "Portafoglio", "Investimenti", "/investimenti", ["etf", "azioni", "posizioni"]),
  page("performance", "Performance", "Investimenti", "/investimenti/performance", ["rendimento", "twr", "benchmark"]),
  page("diversificazione", "Diversificazione", "Investimenti", "/investimenti/diversificazione", ["rischio", "settori", "paesi"]),
  page("dividendi", "Dividendi", "Investimenti", "/investimenti/proventi", ["cedole", "proventi"]),
  page("tasse", "Tasse", "Investimenti", "/investimenti/tasse", ["imposte", "minusvalenze", "zainetto fiscale", "capital gain"]),
  page("operazioni", "Operazioni", "Investimenti", "/investimenti/operazioni", ["acquisti", "vendite", "rendiconti"]),
  page("pensione", "Pensione", "Fondo pensione e TFR", "/pensione", ["tfr", "previdenza"]),
  page("debiti", "Debiti", "Mutui e prestiti", "/debiti", ["mutuo", "prestito", "rate"]),
  page("analitiche", "Analitiche", "E se…", "/analitiche", ["fire", "simulazione", "futuro"]),
  page("obiettivi", "Obiettivi", "Analitiche", "/analitiche/obiettivi", ["risparmio", "casa", "viaggio"]),
  page("aiuto", "Aiuto", "Domande e segnalazioni", "/aiuto", ["supporto", "problema", "contatti"]),
  setting("profilo", "Profilo e nome", "/impostazioni?sezione=account", ["account", "email", "nome"]),
  setting("sessioni", "Dispositivi collegati", "/impostazioni?sezione=account", ["sessioni", "esci"]),
  setting("password", "Password", "/impostazioni?sezione=account", ["accesso"]),
  setting("tema", "Tema chiaro o scuro", "/impostazioni?sezione=aspetto", ["dark", "scuro", "aspetto"]),
  setting("valuta", "Valuta, lingua e paese", "/impostazioni?sezione=aspetto", ["euro", "inglese", "tedesco", "lingua"]),
  setting("pagina-iniziale", "Pagina iniziale", "/impostazioni?sezione=aspetto", ["apertura"]),
  setting("barra-laterale", "Barra laterale", "/impostazioni?sezione=aspetto", ["sidebar", "moduli"]),
  setting("notifiche", "Email di riepilogo e avvisi", "/impostazioni?sezione=notifiche", ["notifiche", "email", "avvisi", "budget"]),
  setting("ai", "Assistente per le categorie", "/impostazioni?sezione=notifiche", ["ai", "intelligenza artificiale"]),
  setting("esporta", "Scarica i tuoi dati", "/impostazioni?sezione=privacy", ["export", "zip", "backup"]),
  setting("privacy", "Privacy e statistiche anonime", "/impostazioni?sezione=privacy", ["gdpr", "informativa"]),
  setting("elimina", "Elimina l'account", "/impostazioni?sezione=pericolo", ["cancella", "disattiva", "reset"]),
  ...QUICK_ADD_ACTIONS.map<StaticEntry>((action) => ({
    id: `aggiungi-${action.id}`,
    group: "azioni",
    icon: "azione",
    title: `Aggiungi ${action.title.toLocaleLowerCase("it")}`,
    subtitle: action.description,
    keywords: ["aggiungi", "nuovo", "nuova"],
    quickAdd: action.id,
    href: action.path,
  })),
];

/** Entries matching `query` (folded) for a user of `country`; `translate` gives the visible text, matched as well. */
export function searchStatic(query: string, country: string, translate: (key: string) => string): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const entry of STATIC_ENTRIES) {
    if (entry.href && !isCountryPathAvailable(country, entry.href.split("?")[0])) continue;
    const title = translate(entry.title);
    const score = Math.max(matchScore(title, query), matchScore(entry.title, query), entry.keywords.some((k) => matchScore(k, query) >= 2) ? 2 : 0);
    if (score === 0) continue;
    hits.push({ key: `${entry.group}:${entry.id}`, group: entry.group, icon: entry.icon, title, subtitle: translate(entry.subtitle), href: entry.quickAdd ? undefined : entry.href, quickAdd: entry.quickAdd, score });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** Every entry of one kind, for a filter chosen before typing (all settings, all «Aggiungi» actions). */
export function staticEntriesOf(kind: "impostazione" | "azione", country: string, translate: (key: string) => string): SearchHit[] {
  return STATIC_ENTRIES.filter((entry) => entry.icon === kind && (!entry.href || isCountryPathAvailable(country, entry.href.split("?")[0]))).map((entry) => ({
    key: `${entry.group}:${entry.id}`,
    group: entry.group,
    icon: entry.icon,
    title: translate(entry.title),
    subtitle: translate(entry.subtitle),
    href: entry.quickAdd ? undefined : entry.href,
    quickAdd: entry.quickAdd,
    score: 0,
  }));
}
