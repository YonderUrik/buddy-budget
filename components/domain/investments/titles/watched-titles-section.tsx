"use client";

/**
 * Titoli che si seguono senza possederli (watchlist), con ultima chiusura, variazione e avvisi. Non mostra nulla se
 * non ce ne sono o se l'elenco non si carica: i posseduti sono già nelle Posizioni.
 */

import { EyeIcon } from "lucide-react";
import { useTitleListQuery } from "@/lib/queries/titles";
import { PanelSection } from "../panel-section";
import { TitleListCard } from "./title-list-card";

export interface WatchedTitlesSectionProps {
  /** Base dell'indirizzo della pagina di un titolo (default `/investimenti/titoli`). */
  hrefBase?: string;
}

export function WatchedTitlesSection({ hrefBase }: WatchedTitlesSectionProps) {
  const list = useTitleListQuery();
  const items = (list.data?.items ?? []).filter((item) => item.watching && !item.held);
  if (items.length === 0) return null;
  return (
    <PanelSection icon={EyeIcon} title="Seguiti" description="Titoli che osservi senza possederli. Aprine uno per il grafico e gli avvisi di prezzo.">
      <TitleListCard items={items} hrefBase={hrefBase} />
    </PanelSection>
  );
}
