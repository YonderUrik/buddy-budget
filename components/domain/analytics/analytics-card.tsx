"use client";
import { useLocalization } from "@/lib/localization/provider";
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
  const { t: tr } = useLocalization();
  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <h3 className="text-sm font-medium text-muted-foreground">{tr(title)}</h3>
      {children}
      {explainer ? <Explainer id={explainer} /> : null}
    </section>
  );
}

export interface MetricProps {
  /** Label and note: Italian sources (translated here) or text already in the user's language. */
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "pos" | "neg";
  /** Voce del glossario: l'etichetta diventa sottolineata e al tocco spiega il termine. */
  term?: GlossaryId;
}

/** Numero in evidenza con etichetta e nota. */
export function Metric({ label, value, sub, tone = "default", term }: MetricProps) {
  const { t: tr } = useLocalization();
  const color = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-foreground";
  return (
    <div className="border-t pt-3">
      <p className="text-sm text-muted-foreground">{term ? <Term id={term}>{tr(label)}</Term> : tr(label)}</p>
      <p className={`font-heading text-2xl font-medium tabular-nums ${color}`}>{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{tr(sub)}</p> : null}
    </div>
  );
}

/** Messaggio quando mancano i dati per un'analitica: dice che cosa serve. */
export function MissingData({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{children}</p>;
}
