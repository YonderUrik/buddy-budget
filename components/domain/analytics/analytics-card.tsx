import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Explainer } from "./explainer";
import type { GlossaryId } from "./glossary";
import { Term } from "./term";
import type { ExplainerId } from "./explainers";

export interface AnalyticsCardProps {
  title: string;
  explainer?: ExplainerId;
  children: ReactNode;
}

/** Card standard di Analitiche: titolo, contenuto e (se c'è) il riquadro che spiega l'analitica. */
export function AnalyticsCard({ title, explainer, children }: AnalyticsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}
        {explainer ? <Explainer id={explainer} /> : null}
      </CardContent>
    </Card>
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
    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{term ? <Term id={term}>{label}</Term> : label}</p>
      <p className={`font-heading text-xl font-medium tabular-nums ${color}`}>{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Messaggio quando mancano i dati per un'analitica: dice che cosa serve. */
export function MissingData({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}
