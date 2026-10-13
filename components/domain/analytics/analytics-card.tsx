import type { ReactNode } from "react";
import { Explainer } from "./explainer";
import type { GlossaryId } from "./glossary";
import { Term } from "./term";
import type { ExplainerId } from "./explainers";

export interface AnalyticsCardProps {
  title: string;
  explainer?: ExplainerId;
  children: ReactNode;
}

/** Blocco standard di Analitiche, senza riquadro: filetto, titolo, contenuto e (se c'è) il riquadro che spiega l'analitica. */
export function AnalyticsCard({ title, explainer, children }: AnalyticsCardProps) {
  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
      {explainer ? <Explainer id={explainer} /> : null}
    </section>
  );
}

export interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "pos" | "neg";
  /** Voce del glossario: l'etichetta diventa sottolineata e al tocco spiega il termine. */
  term?: GlossaryId;
}

/** Numero in evidenza con etichetta e nota. */
export function Metric({ label, value, sub, tone = "default", term }: MetricProps) {
  const color = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-foreground";
  return (
    <div className="border-t pt-3">
      <p className="text-sm text-muted-foreground">{term ? <Term id={term}>{label}</Term> : label}</p>
      <p className={`font-heading text-2xl font-medium tabular-nums ${color}`}>{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Messaggio quando mancano i dati per un'analitica: dice che cosa serve. */
export function MissingData({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}
