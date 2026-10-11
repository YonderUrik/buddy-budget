"use client";

/** Domanda 2, «Quando posso smettere di lavorare?»: la salita del patrimonio verso il traguardo. */

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { MissingData } from "./analytics-card";
import { money } from "./analytics-format";
import { FireTab } from "./fire-tab";
import { Term } from "./term";
import { timelineSeries } from "./plain-answers";
import { QuestionSection } from "./question-section";
import type { QuestionSectionData } from "./section-props";

const CONFIG: ChartConfig = {
  wealth: { label: "Patrimonio previsto", color: "var(--primary)" },
  baseline: { label: "Ipotesi salvate", color: "var(--muted-foreground)" },
};

/** Domanda 2: la salita del patrimonio verso il numero FIRE; con i cursori mossi, la linea tratteggiata mostra le ipotesi salvate. */
export function TimelineSection({ question, base, assumptions, plan, baseline }: QuestionSectionData) {
  const { currency } = base;
  const expert = () => <FireTab base={base} assumptions={assumptions} plan={plan} />;
  if (plan.target === null || plan.spending === null) {
    return (
      <QuestionSection question={question} expertHint="sensibilità, Coast FIRE" renderExpert={expert}>
        <MissingData>Per stimare quando arrivi serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti e la ricavo da lì.</MissingData>
      </QuestionSection>
    );
  }
  const today = new Date();
  const series = timelineSeries(plan, assumptions);
  const baselineSeries = baseline ? timelineSeries(baseline.plan, baseline.assumptions) : null;
  const data = series.map((p, i) => ({ ...p, baseline: baselineSeries?.[i]?.wealth }));
  return (
    <QuestionSection question={question} expertHint="sensibilità alle ipotesi, Coast FIRE, lean FIRE" renderExpert={expert}>
      <p className="text-base leading-relaxed text-muted-foreground">
        Con {money(plan.savings ?? 0, currency)} risparmiati l&apos;anno e un <Term id="rendimento-reale">rendimento reale</Term> del {(assumptions.expectedReturn * 100).toFixed(1).replace(".", ",")}%, in <Term id="euro-di-oggi">euro di oggi</Term>.
        {baseline ? " La linea tratteggiata è il percorso con le ipotesi salvate." : ""}
      </p>
      <ChartContainer config={CONFIG} className="h-56 w-full">
        <ComposedChart data={data}>
          <CartesianGrid vertical={false} strokeOpacity={0.3} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${today.getFullYear() + y}`} minTickGap={32} />
          <YAxis hide domain={[0, (max: number) => Math.max(max, plan.target ?? 0) * 1.05]} />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{today.getFullYear() + p.year}</p>
                  <p>Patrimonio: {money(p.wealth, currency)}</p>
                  {p.baseline !== undefined ? <p className="text-muted-foreground">Ipotesi salvate: {money(p.baseline, currency)}</p> : null}
                </div>
              );
            }}
          />
          <ReferenceLine y={plan.target} stroke="var(--pos)" strokeDasharray="5 4" label={{ value: `Numero FIRE ${money(plan.target, currency)}`, position: "insideTopLeft", fill: "var(--pos)", fontSize: 11 }} />
          {baselineSeries ? <Line dataKey="baseline" stroke="var(--color-baseline)" strokeWidth={1.8} strokeDasharray="4 4" dot={false} isAnimationActive={false} /> : null}
          <Area dataKey="wealth" stroke="var(--color-wealth)" strokeWidth={2.5} fill="var(--color-wealth)" fillOpacity={0.12} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>
    </QuestionSection>
  );
}
