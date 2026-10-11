"use client";

/**
 * Terzo passo dell'import: per ogni titolo del file dice a cosa l'ho abbinato (già tuo, nuovo con quotazione
 * automatica, da controllare, non trovato) e cosa fare. Quelli che chiedono attenzione sono in cima e con la ricerca
 * già aperta; per gli altri il cambio è su richiesta.
 */

import * as React from "react";
import { CheckCircle2Icon, CircleAlertIcon, CircleHelpIcon, PencilLineIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Instrument } from "@/lib/db/schema/investments";
import type { ImportIdentity } from "@/lib/investments/import/normalize";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import { cn } from "@/lib/utils";
import { InstrumentPicker } from "../instrument-picker";
import { attentionRank, describeChoice, identityLabel, type ChoiceTone, type InstrumentChoice } from "./investment-import.state";

export interface ImportInstrumentsStepProps {
  identities: (ImportIdentity & { count: number })[];
  choices: Record<string, InstrumentChoice>;
  excluded: ReadonlySet<string>;
  defaultCurrency: string;
  onChoose: (key: string, instrument: Instrument) => void;
  onToggleExcluded: (key: string, exclude: boolean) => void;
}

const TONE_STYLE: Record<ChoiceTone, { icon: LucideIcon; color: string }> = {
  ready: { icon: CheckCircle2Icon, color: "var(--pos)" },
  manual: { icon: PencilLineIcon, color: "var(--swatch-indigo)" },
  check: { icon: CircleHelpIcon, color: "var(--swatch-amber)" },
  missing: { icon: CircleAlertIcon, color: "var(--destructive)" },
};

/** Cosa si importerebbe di questo titolo: nome da mostrare e dettaglio dello strumento scelto. */
function chosenName(choice: InstrumentChoice | undefined): { name: string; detail: string | null } | null {
  if (!choice || choice.kind === "skip") return null;
  if (choice.kind === "known") return { name: choice.instrument.name, detail: choice.instrument.isin ?? null };
  return { name: choice.label, detail: `${choice.detail} · ${INSTRUMENT_TYPE_SINGULAR[choice.type]}` };
}

function InstrumentRow({
  identity,
  choice,
  included,
  defaultCurrency,
  onChoose,
  onToggleExcluded,
}: {
  identity: ImportIdentity & { count: number };
  choice: InstrumentChoice | undefined;
  included: boolean;
  defaultCurrency: string;
  onChoose: ImportInstrumentsStepProps["onChoose"];
  onToggleExcluded: ImportInstrumentsStepProps["onToggleExcluded"];
}) {
  const status = describeChoice(choice);
  const { icon: Icon, color } = TONE_STYLE[status.tone];
  const usable = choice !== undefined && choice.kind !== "skip";
  const needsAttention = status.tone === "missing" || status.tone === "check";
  const [changing, setChanging] = React.useState(false);
  const chosen = chosenName(choice);
  return (
    <li className={cn("flex gap-3 py-4 first:pt-0 last:pb-0", !included && "opacity-70")}>
      <Checkbox
        checked={included}
        disabled={!usable}
        aria-label={`Importa ${identityLabel(identity)}`}
        onCheckedChange={(checked) => onToggleExcluded(identity.key, checked !== true)}
        className="mt-1"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">{identity.name ?? identity.symbol ?? identity.isin}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {identity.count} {identity.count === 1 ? "operazione" : "operazioni"}
          </span>
        </div>
        {identity.name ? <p className="-mt-1.5 truncate font-mono text-xs text-muted-foreground">{[identity.symbol, identity.isin].filter(Boolean).join(" · ")}</p> : null}
        <p className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full" style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }} aria-hidden="true">
            <Icon className="size-3" />
          </span>
          <span className="min-w-0">
            <span className="font-medium text-foreground">{status.title}</span>
            <span className="text-muted-foreground"> · {status.text}</span>
          </span>
        </p>
        {chosen ? (
          <p className="pl-7 text-sm text-foreground">
            {chosen.name}
            {chosen.detail ? <span className="text-muted-foreground"> · {chosen.detail}</span> : null}
          </p>
        ) : null}
        <div className="pl-7">
          {needsAttention || changing ? (
            <InstrumentPicker
              value={null}
              onChange={(instrument) => {
                onChoose(identity.key, instrument);
                setChanging(false);
              }}
              defaultCurrency={identity.currency ?? defaultCurrency}
              placeholder={usable ? "Scegli un altro strumento…" : "Cerca lo strumento…"}
              className="sm:max-w-xs"
            />
          ) : (
            <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setChanging(true)}>
              Non è questo? Cambia strumento
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function ImportInstrumentsStep(props: ImportInstrumentsStepProps) {
  const { identities, choices, excluded, defaultCurrency, onChoose, onToggleExcluded } = props;
  // Ordine stabile preso all'apertura del passo: scegliere uno strumento non deve far saltare la riga altrove.
  const [order] = React.useState(() =>
    [...identities].sort((a, b) => attentionRank(choices[a.key]) - attentionRank(choices[b.key])).map((i) => i.key)
  );
  const sorted = order.flatMap((key) => identities.filter((i) => i.key === key));
  const included = identities.filter((i) => choices[i.key] && choices[i.key].kind !== "skip" && !excluded.has(i.key)).length;
  const missing = identities.filter((i) => attentionRank(choices[i.key]) === 0 && !excluded.has(i.key)).length;
  const toCheck = identities.filter((i) => attentionRank(choices[i.key]) === 1).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{included}</span> su {identities.length} {identities.length === 1 ? "titolo" : "titoli"} pronti da importare.
        {missing > 0 ? ` ${missing} non ${missing === 1 ? "è stato trovato" : "sono stati trovati"}: cercali oppure lasciali fuori, e le loro operazioni non verranno importate.` : ""}
        {toCheck > 0 ? ` ${toCheck} ${toCheck === 1 ? "è da controllare" : "sono da controllare"}.` : ""}
        {" "}I titoli nuovi si aggiungono ai tuoi strumenti.
      </p>
      <ul className="flex flex-col divide-y">
        {sorted.map((identity) => {
          const choice = choices[identity.key];
          const usable = choice !== undefined && choice.kind !== "skip";
          return (
            <InstrumentRow
              key={identity.key}
              identity={identity}
              choice={choice}
              included={usable && !excluded.has(identity.key)}
              defaultCurrency={defaultCurrency}
              onChoose={onChoose}
              onToggleExcluded={onToggleExcluded}
            />
          );
        })}
      </ul>
    </div>
  );
}
