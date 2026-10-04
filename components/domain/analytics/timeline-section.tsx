"use client";

/** Domanda 2, «Quando posso smettere di lavorare?»: l'anno del traguardo, la salita del patrimonio e due «e se…». */

import { Area, CartesianGrid, ComposedChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Metric, MissingData } from "./analytics-card";
import { formatYears, money } from "./analytics-format";
import { FireTab } from "./fire-tab";
import { timelineHeadline, timelineScenarios, timelineSeries } from "./plain-answers";
import { QuestionSection } from "./question-section";
import type { QuestionSectionData } from "./section-props";

const CONFIG: ChartConfig = { wealth: { label: "Patrimonio previsto", color: "var(--primary)" } };

export function TimelineSection({ question, index, base, assumptions, plan }: QuestionSectionData) {
  const { currency } = base;
  const expert = () => <FireTab base={base} assumptions={assumptions} plan={plan} />;
  if (plan.target === null || plan.spending === null) {
    return (
      <QuestionSection question={question} index={index} expertHint="sensibilità, Coast FIRE" renderExpert={expert}>
        <MissingData>Per stimare quando arrivi serve la tua spesa annua. Scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti e la ricavo da lì.</MissingData>
      </QuestionSection>
    );
  }
  const today = new Date();
  const series = timelineSeries(plan, assumptions);
  const scenarios = timelineScenarios(plan, assumptions, currency);
  return (
    <QuestionSection question={question} index={index} expertHint="sensibilità alle ipotesi, Coast FIRE, lean FIRE" renderExpert={expert}>
      <div className="flex flex-col gap-1 text-base leading-relaxed text-muted-foreground">
        <p className="font-heading text-xl font-medium text-foreground">{timelineHeadline(plan, today)}</p>
        <p>
          Con {money(plan.savings ?? 0, currency)} risparmiati l&apos;anno e un rendimento reale del {(assumptions.expectedReturn * 100).toFixed(1).replace(".", ",")}%, in euro di oggi.
        </p>
      </div>
      <ChartContainer config={CONFIG} className="h-56 w-full">
        <ComposedChart data={series}>
          <CartesianGrid vertical={false} strokeOpacity={0.3} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${today.getFullYear() + y}`} minTickGap={32} />
          <YAxis hide domain={[0, (max: number) => Math.max(max, plan.target ?? 0) * 1.05]} />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof series)[number];
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{today.getFullYear() + p.year}</p>
                  <p>Patrimonio: {money(p.wealth, currency)}</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={plan.target} stroke="var(--pos)" strokeDasharray="5 4" label={{ value: `Numero FIRE ${money(plan.target, currency)}`, position: "insideTopLeft", fill: "var(--pos)", fontSize: 11 }} />
          <Area dataKey="wealth" stroke="var(--color-wealth)" strokeWidth={2.5} fill="var(--color-wealth)" fillOpacity={0.12} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Come sei messo ora" value={formatYears(plan.yearsToFire)} sub="ai ritmi attuali" />
        {scenarios.map((s) => (
          <Metric
            key={s.label}
            label={s.label}
            value={formatYears(s.years)}
            tone={s.yearsSaved !== null && s.yearsSaved > 0 ? "pos" : "default"}
            sub={s.yearsSaved !== null && s.yearsSaved > 0.05 ? `${formatYears(s.yearsSaved)} prima` : undefined}
          />
        ))}
      </div>
    </QuestionSection>
  );
}
