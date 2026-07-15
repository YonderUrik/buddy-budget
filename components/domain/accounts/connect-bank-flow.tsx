"use client";

/**
 * Flusso "Collega banca": selezione paese (con bandiera), ricerca istituto
 * (con logo, se GoCardless lo fornisce), redirect al consenso GoCardless.
 */

import * as React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateConnectionMutation, useInstitutionsQuery } from "@/lib/queries/gocardless";
import type { Institution } from "@/lib/queries/gocardless";

const COUNTRY_OPTIONS = [
  { code: "IT", label: "Italia" },
  { code: "DE", label: "Germania" },
  { code: "FR", label: "Francia" },
  { code: "ES", label: "Spagna" },
  { code: "GB", label: "Regno Unito" },
] as const;

/** Converte un codice paese ISO 3166-1 alpha-2 nella bandiera emoji corrispondente. */
function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/** Logo dell'istituto se disponibile, altrimenti un'icona generica di fallback. */
function InstitutionLogo({ institution }: { institution: Institution }) {
  const [errored, setErrored] = React.useState(false);

  if (!institution.logo || errored) {
    return (
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Building2 size={14} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo di dominio esterno GoCardless
    <img
      src={institution.logo}
      alt=""
      className="size-6 shrink-0 rounded-full bg-white object-contain"
      onError={() => setErrored(true)}
    />
  );
}

export function ConnectBankFlow() {
  const [country, setCountry] = React.useState<string>(COUNTRY_OPTIONS[0].code);
  const [search, setSearch] = React.useState("");
  const { data: institutions, isLoading } = useInstitutionsQuery(country);
  const createConnection = useCreateConnectionMutation();
  const [error, setError] = React.useState<string | null>(null);

  const filtered = (institutions ?? []).filter((institution) =>
    institution.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(institutionId: string, institutionName: string, transactionTotalDays: string) {
    setError(null);
    createConnection.mutate(
      { institutionId, institutionName, transactionTotalDays: Number(transactionTotalDays) },
      {
        onSuccess: (data) => {
          window.location.href = data.link;
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Paese</label>
          <Select value={country} onValueChange={(value) => setCountry(value as string)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {countryFlag(option.code)} {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca la tua banca…"
          className="w-56"
          aria-label="Cerca istituto"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento istituti…</p>
      ) : (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {filtered.map((institution) => (
            <Button
              key={institution.id}
              type="button"
              variant="outline"
              className="justify-start gap-2 h-auto whitespace-normal py-2.5 text-left w-full items-center"
              disabled={createConnection.isPending}
              onClick={() => handleSelect(institution.id, institution.name, institution.transaction_total_days)}
            >
              <InstitutionLogo institution={institution} />
              <span className="flex-1 min-w-0 break-words">{institution.name}</span>
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
