/**
 * Stato di caricamento di ogni schermata dell'app: appare subito al cambio pagina, prima che arrivino codice e dati della
 * nuova route, con la stessa larghezza e un'altezza simile al contenuto per non far saltare la pagina.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Caricamento in corso</span>
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-44 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-3" />
        <div className="h-64 animate-pulse rounded-xl bg-muted lg:col-span-2" />
      </div>
    </div>
  );
}
