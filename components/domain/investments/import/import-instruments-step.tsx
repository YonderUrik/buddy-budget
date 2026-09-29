"use client";

/**
 * Terzo passo dell'import: per ogni strumento del file mostra a cosa è stato abbinato (già tuo, nuovo dalle fonti,
 * non trovato) e permette di sceglierne un altro con la ricerca o di escluderlo. Le proposte incerte sono evidenziate.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Instrument } from "@/lib/db/schema/investments";
import type { ImportIdentity } from "@/lib/investments/import/normalize";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import { cn } from "@/lib/utils";
import { InstrumentPicker } from "../instrument-picker";
import { attentionRank, identityLabel, type InstrumentChoice } from "./investment-import.state";

export interface ImportInstrumentsStepProps {
  identities: (ImportIdentity & { count: number })[];
  choices: Record<string, InstrumentChoice>;
  excluded: ReadonlySet<string>;
  defaultCurrency: string;
  onChoose: (key: string, instrument: Instrument) => void;
  onToggleExcluded: (key: string, exclude: boolean) => void;
}

function ChoiceDescription({ choice }: { choice: InstrumentChoice | undefined }) {
  if (!choice || choice.kind === "skip") {
    return (
      <p className="text-sm text-destructive">
        {choice?.reason === "unavailable" ? "Fonte prezzi non raggiungibile: sceglilo a mano" : "Non trovato: cercalo a mano"}
      </p>
    );
  }
  if (choice.kind === "known") {
    return (
      <p className="text-sm text-foreground">
        {choice.instrument.name} <span className="text-muted-foreground">· già tra i tuoi strumenti</span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-foreground">
        {choice.label} <span className="text-muted-foreground">· {choice.detail}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">Nuovo · {INSTRUMENT_TYPE_SINGULAR[choice.type]}</Badge>
        {choice.confidence === "guess" ? <Badge variant="outline">Da controllare</Badge> : null}
      </div>
    </div>
  );
}

export function ImportInstrumentsStep(props: ImportInstrumentsStepProps) {
  const { identities, choices, excluded, defaultCurrency, onChoose, onToggleExcluded } = props;
  // Ordine stabile preso all'apertura del passo: scegliere uno strumento non deve far saltare la riga altrove.
  const [order] = React.useState(() =>
    [...identities].sort((a, b) => attentionRank(choices[a.key]) - attentionRank(choices[b.key])).map((i) => i.key)
  );
  const sorted = order.flatMap((key) => identities.filter((i) => i.key === key));
  const notFound = identities.filter((i) => attentionRank(choices[i.key]) === 0).length;
  const guesses = identities.filter((i) => attentionRank(choices[i.key]) === 1).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Controlla che ogni strumento del file sia quello giusto. Quelli nuovi vengono aggiunti all&apos;import, con i
        prezzi storici scaricati in automatico.
        {notFound + guesses > 0 ? (
          <span className="mt-1 block text-foreground">
            {[notFound > 0 ? `${notFound} da cercare a mano` : null, guesses > 0 ? `${guesses} da controllare` : null]
              .filter(Boolean)
              .join(", ")}
            : sono in cima. Quelli non scelti restano fuori dall&apos;import.
          </span>
        ) : null}
      </p>
      <ul className="flex max-h-[45vh] flex-col overflow-y-auto rounded-lg border">
        {sorted.map((identity) => {
          const choice = choices[identity.key];
          const usable = choice !== undefined && choice.kind !== "skip";
          const included = usable && !excluded.has(identity.key);
          return (
            <li key={identity.key} className={cn("flex gap-3 border-b px-3 py-3 last:border-b-0", !included && "bg-muted/40")}>
              <Checkbox
                checked={included}
                disabled={!usable}
                aria-label={`Importa ${identityLabel(identity)}`}
                onCheckedChange={(checked) => onToggleExcluded(identity.key, checked !== true)}
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-mono text-xs text-muted-foreground">{identityLabel(identity)}</p>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {identity.count} {identity.count === 1 ? "operazione" : "operazioni"}
                  </span>
                </div>
                <ChoiceDescription choice={choice} />
                <InstrumentPicker
                  value={null}
                  onChange={(instrument) => onChoose(identity.key, instrument)}
                  defaultCurrency={identity.currency ?? defaultCurrency}
                  placeholder={usable ? "Scegli un altro strumento…" : "Cerca lo strumento…"}
                  className="sm:max-w-xs"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
