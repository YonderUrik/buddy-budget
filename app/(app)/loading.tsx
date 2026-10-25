"use client";
import { useLocalization } from "@/lib/localization/provider";
import { PAGE_FRAME, PAGE_SPLIT } from "@/components/domain/shared";
/**
 * Stato di caricamento di ogni schermata dell'app: appare subito al cambio pagina, prima che arrivino codice e dati della
 * nuova route, con la stessa larghezza e un'altezza simile al contenuto per non far saltare la pagina.
 */
export default function AppLoading() {
  const { t: tr } = useLocalization();
  return (
    <div className={PAGE_FRAME} aria-busy="true" aria-live="polite">
      <span className="sr-only">{tr("Caricamento in corso")}</span>
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-44 animate-pulse rounded-xl bg-muted" />
      <div className={PAGE_SPLIT}>
        <div className="h-64 animate-pulse rounded-xl bg-muted @4xl/main:col-span-3" />
        <div className="h-64 animate-pulse rounded-xl bg-muted @4xl/main:col-span-2" />
      </div>
    </div>
  );
}
