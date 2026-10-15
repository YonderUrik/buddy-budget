import { t } from "@/lib/localization";
import { SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";
/** Preserve old links without presenting an Italian tax calculation as a German feature. */
export function CountryUnavailable() {
  return <><SiteNav /><main className="cp"><div className="wrap cp-wrap"><h1>{t("Questa pagina riguarda il prodotto Italia.")}</h1><p>{t("Per vedere le regole italiane, scegli Italia nel selettore del paese. Nel prodotto Germania queste funzioni non sono disponibili.")}</p></div></main><SiteFooter /></>;
}
