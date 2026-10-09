"use client";

/**
 * Flusso "Collega banca": paese, ricerca dell'istituto (con logo e storico disponibile) e redirect al consenso
 * GoCardless. Gestisce caricamento, errore con riprova, nessun risultato e l'attesa del redirect.
 */

import * as React from "react";
import { Building2, ChevronRightIcon, Loader2Icon, LockKeyholeIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCreateConnectionMutation, useInstitutionsQuery } from "@/lib/queries/gocardless";
import type { Institution } from "@/lib/queries/gocardless";

export const BANK_COUNTRY_OPTIONS = [
  { code: "IT", label: "Italia" },
  { code: "DE", label: "Germania" },
  { code: "FR", label: "Francia" },
  { code: "ES", label: "Spagna" },
  { code: "GB", label: "Regno Unito" },
] as const;

const FIELD_CLASS = "h-11 sm:h-9";
const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** Converte un codice paese ISO 3166-1 alpha-2 nella bandiera emoji corrispondente. */
function countryFlag(code: string): string {
  return code.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/** Logo dell'istituto se disponibile, altrimenti un'icona generica di fallback. */
function InstitutionLogo({ institution }: { institution: Institution }) {
  const [errored, setErrored] = React.useState(false);
  if (!institution.logo || errored) {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <Building2 className="size-4" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo di dominio esterno GoCardless
    <img src={institution.logo} alt="" className="size-9 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-border" onError={() => setErrored(true)} />
  );
}

/** Frase sullo storico che la banca mette a disposizione, se il dato è valido. */
export function describeHistory(days: string): string | null {
  const total = Number(days);
  if (!Number.isFinite(total) || total <= 0) return null;
  return total >= 365 ? `Storico fino a ${Math.round(total / 365) === 1 ? "1 anno" : `${Math.round(total / 365)} anni`}` : `Storico fino a ${total} giorni`;
}

export interface ConnectBankFlowProps {
  /** Se presente, offre la via d'uscita «aggiungi un conto manuale» quando la banca non si trova. */
  onChooseManual?: () => void;
}

export function ConnectBankFlow({ onChooseManual }: ConnectBankFlowProps) {
  const fieldId = React.useId();
  const [country, setCountry] = React.useState<string>(BANK_COUNTRY_OPTIONS[0].code);
  const [search, setSearch] = React.useState("");
  const { data: institutions, isLoading, isError, refetch } = useInstitutionsQuery(country);
  const createConnection = useCreateConnectionMutation();
  const [error, setError] = React.useState<string | null>(null);
  const [chosenId, setChosenId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return (institutions ?? []).filter((institution) => institution.name.toLowerCase().includes(query));
  }, [institutions, search]);

  function handleSelect(institution: Institution) {
    setError(null);
    setChosenId(institution.id);
    createConnection.mutate(
      { institutionId: institution.id, institutionName: institution.name, transactionTotalDays: Number(institution.transaction_total_days) },
      {
        // Il redirect lascia la pagina: finché non parte restiamo nello stato «ti porto alla banca».
        onSuccess: (data) => {
          window.location.href = data.link;
        },
        onError: (mutationError) => {
          setChosenId(null);
          setError(mutationError.message);
        },
      }
    );
  }

  const busy = chosenId !== null;
  const chosenName = institutions?.find((institution) => institution.id === chosenId)?.name;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2.5 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        <LockKeyholeIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Ti porto sul sito della tua banca per dare il consenso. Il collegamento è in sola lettura: BuddyBudget non vede le tue credenziali e non può muovere denaro.</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`${fieldId}-country`}>
            Paese
          </label>
          <Select value={country} onValueChange={(value) => { setCountry(value as string); setSearch(""); }} disabled={busy}>
            <SelectTrigger id={`${fieldId}-country`} className={cn("w-full", FIELD_CLASS)}>
              <SelectValue>{(value: string | null) => { const option = BANK_COUNTRY_OPTIONS.find((o) => o.code === value); return option ? `${countryFlag(option.code)} ${option.label}` : ""; }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BANK_COUNTRY_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {countryFlag(option.code)} {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`${fieldId}-search`}>
            Cerca la tua banca
          </label>
          <Input id={`${fieldId}-search`} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Es. Intesa, Fineco, N26" autoComplete="off" disabled={busy} className={FIELD_CLASS} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Caricamento delle banche">
          {SKELETON_ROWS.map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">Non riesco a caricare l&apos;elenco delle banche.</p>
          <p className="text-muted-foreground">Succede se la connessione cade o il servizio è occupato. Non hai perso nulla.</p>
          <button type="button" onClick={() => void refetch()} className="min-h-11 cursor-pointer font-medium text-primary hover:underline">Riprova</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-1 rounded-xl border border-dashed p-4 text-sm">
          <p className="font-medium text-foreground">{search.trim() ? `Nessuna banca trovata per «${search.trim()}».` : "Nessuna banca disponibile in questo paese."}</p>
          <p className="text-muted-foreground">Controlla il nome o cambia paese.{onChooseManual ? " Se non c'è, puoi tenere il conto a mano e importare i movimenti da un file." : ""}</p>
          {onChooseManual ? <button type="button" onClick={onChooseManual} className="min-h-11 cursor-pointer font-medium text-primary hover:underline">Aggiungi un conto manuale</button> : null}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">{filtered.length === 1 ? "1 banca" : `${filtered.length} banche`}</p>
          <ul className="-mt-2 flex max-h-[min(22rem,45dvh)] flex-col gap-2 overflow-y-auto pr-0.5 max-sm:max-h-none">
            {filtered.map((institution) => {
              const history = describeHistory(institution.transaction_total_days);
              const chosen = chosenId === institution.id;
              return (
                <li key={institution.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSelect(institution)}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <InstitutionLogo institution={institution} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="break-words text-sm font-medium text-foreground">{institution.name}</span>
                      {history ? <span className="text-xs text-muted-foreground">{history}</span> : null}
                    </span>
                    {chosen ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p role="status" className="sr-only">{busy ? `Ti porto sul sito di ${chosenName ?? "la banca"}…` : ""}</p>
      {busy ? <p className="text-sm text-muted-foreground" aria-hidden="true">Ti porto sul sito di {chosenName ?? "la banca"}…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
