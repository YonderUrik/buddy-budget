"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Riga «in breve» sotto il prezzo: fino a sei numeri tra due linee sottili, su due colonne da telefono. */

import { keyFacts, type KeyFactsInput } from "./key-facts";

export type TitleKeyFactsProps = Omit<KeyFactsInput, "locale">;

export function TitleKeyFacts(props: TitleKeyFactsProps) {
  const { t: tr, locale } = useLocalization();
  const facts = keyFacts({ ...props, locale });
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3 lg:grid-cols-6">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{tr(fact.label)}</dt>
          <dd className="truncate font-heading text-lg font-medium tabular-nums text-foreground" title={fact.value}>
            {fact.value}
          </dd>
          {fact.note ? <p className="text-xs text-muted-foreground">{fact.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}
