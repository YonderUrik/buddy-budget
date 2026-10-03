"use client";

/** Riquadro «Come leggere e come è calcolato» di un'analitica: sempre in pagina, i dettagli si aprono a richiesta. */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/analytics";
import { EXPLAINERS, type ExplainerId } from "./explainers";

export interface ExplainerProps {
  id: ExplainerId;
}

export function Explainer({ id }: ExplainerProps) {
  const content = EXPLAINERS[id];
  return (
    <div className="rounded-lg bg-muted/40 px-3.5 py-3 text-sm">
      <p className="text-muted-foreground">{content.what}</p>
      <details
        className="group mt-2"
        onToggle={(event) => {
          if ((event.currentTarget as HTMLDetailsElement).open) track("analytics_explainer_opened", { analysis: id });
        }}
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-foreground marker:hidden">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
          Come leggerla e come è calcolata
        </summary>
        <dl className="mt-2 flex flex-col gap-2.5 text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Come leggerla</dt>
            <dd>{content.read}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Come è calcolata</dt>
            <dd>{content.how}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Limiti</dt>
            <dd>{content.limits}</dd>
          </div>
          {"sources" in content && content.sources ? (
            <div>
              <dt className="font-medium text-foreground">Fonti</dt>
              <dd>
                <ul className="list-disc pl-4">
                  {content.sources.map((source) => (
                    <li key={source.label}>
                      {"url" in source && source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {source.label}
                        </a>
                      ) : (
                        source.label
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </details>
    </div>
  );
}
