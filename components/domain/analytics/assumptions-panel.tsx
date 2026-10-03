"use client";

/**
 * Pannello delle ipotesi: ogni campo dice che cosa significa e da dove partire. Le cifre che l'app può ricavare dai
 * dati (spesa e risparmio) si possono lasciare vuote; per quelle personali il campo vuoto significa «usa i miei dati».
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_ASSUMPTIONS, ASSUMPTION_LIMITS, type AnalyticsAssumptions, type UpdateAssumptionsInput } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { WITHDRAWAL_RULES, type WithdrawalRule } from "@/lib/calc/monte-carlo";
import { money, pct } from "./analytics-format";
import { limitsOf, parseNumber, PERCENT_FIELDS, toFieldText, toPercentDraft, type PercentDraft, type PercentField } from "./assumptions-fields";

export const RULE_LABELS: Record<WithdrawalRule, string> = {
  fissa: "Fissa (stessa spesa ogni anno)",
  percentuale: "Percentuale del patrimonio",
  "guyton-klinger": "Guyton-Klinger (semplificata)",
  vanguard: "Vanguard dinamica",
};

export interface AssumptionsPanelProps {
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  currency: string;
  pensionValue: number;
  saving: boolean;
  error: string | null;
  onSave: (input: UpdateAssumptionsInput) => Promise<void>;
}

function Field({ label, hint, children, id }: { label: string; hint: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AssumptionsPanel({ assumptions, plan, currency, pensionValue, saving, error, onSave }: AssumptionsPanelProps) {
  const [percents, setPercents] = React.useState<PercentDraft>(() => toPercentDraft(assumptions));
  const [years, setYears] = React.useState(String(assumptions.retirementYears));
  const [spending, setSpending] = React.useState(toFieldText(assumptions.annualSpending, false));
  const [savings, setSavings] = React.useState(toFieldText(assumptions.annualSavings, false));
  const [rule, setRule] = React.useState<WithdrawalRule>(assumptions.rule);
  const [includePension, setIncludePension] = React.useState(assumptions.includePensionFunds);
  const [includeTax, setIncludeTax] = React.useState(assumptions.includeLatentTax);
  const [pensionAnnual, setPensionAnnual] = React.useState(toFieldText(assumptions.publicPension?.annual ?? null, false));
  const [pensionAfter, setPensionAfter] = React.useState(assumptions.publicPension ? String(assumptions.publicPension.startsAfterYears) : "");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const reset = (next: AnalyticsAssumptions) => {
    setPercents(toPercentDraft(next));
    setYears(String(next.retirementYears));
    setSpending(toFieldText(next.annualSpending, false));
    setSavings(toFieldText(next.annualSavings, false));
    setRule(next.rule);
    setIncludePension(next.includePensionFunds);
    setIncludeTax(next.includeLatentTax);
    setPensionAnnual(toFieldText(next.publicPension?.annual ?? null, false));
    setPensionAfter(next.publicPension ? String(next.publicPension.startsAfterYears) : "");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    const input: Record<string, unknown> = {};
    for (const field of PERCENT_FIELDS) {
      const value = parseNumber(percents[field.key]);
      const { min, max } = limitsOf(field.key);
      if (value === null || value / 100 < min || value / 100 > max) {
        setLocalError(`${field.label}: inserisci un valore tra ${pct(min)} e ${pct(max)}.`);
        return;
      }
      input[field.key] = value / 100;
    }
    const yearsValue = parseNumber(years);
    if (yearsValue === null || !Number.isInteger(yearsValue) || yearsValue < ASSUMPTION_LIMITS.retirementYears.min || yearsValue > ASSUMPTION_LIMITS.retirementYears.max) {
      setLocalError(`Anni di pensione: inserisci un numero intero tra ${ASSUMPTION_LIMITS.retirementYears.min} e ${ASSUMPTION_LIMITS.retirementYears.max}.`);
      return;
    }
    input.retirementYears = yearsValue;
    const spendingValue = parseNumber(spending);
    const savingsValue = parseNumber(savings);
    input.annualSpending = spendingValue;
    input.annualSavings = savingsValue;
    const annual = parseNumber(pensionAnnual);
    const after = parseNumber(pensionAfter);
    input.publicPension = annual && annual > 0 ? { annual, startsAfterYears: Math.max(0, Math.round(after ?? 0)) } : null;
    input.rule = rule;
    input.includePensionFunds = includePension;
    input.includeLatentTax = includeTax;
    await onSave(input as UpdateAssumptionsInput).catch(() => undefined);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Tutti i calcoli partono da queste ipotesi: sono tue assunzioni, non previsioni. Cambiale e guarda come si muovono i risultati.
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {PERCENT_FIELDS.map((field: PercentField) => (
          <Field key={field.key} id={`ass-${field.key}`} label={`${field.label} (%)`} hint={field.hint}>
            <Input
              id={`ass-${field.key}`}
              inputMode="decimal"
              value={percents[field.key]}
              onChange={(e) => setPercents({ ...percents, [field.key]: e.target.value })}
            />
          </Field>
        ))}
        <Field id="ass-years" label="Anni di pensione da coprire" hint="Quanto deve durare il patrimonio. Per smettere a 45 anni e arrivare a 90, circa 45; più è lungo, più il tasso di prelievo sicuro scende.">
          <Input id="ass-years" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
        </Field>
        <Field
          id="ass-spending"
          label={`Spesa annua in pensione (${currency})`}
          hint={
            plan.spendingSource === "dati" && plan.spending !== null
              ? `Vuoto = uso le tue uscite degli ultimi 12 mesi: ${money(plan.spending, currency)}. Scrivi una cifra se in pensione spenderai diversamente.`
              : "Vuoto = uso le tue uscite degli ultimi 12 mesi (servono almeno 3 mesi di movimenti)."
          }
        >
          <Input id="ass-spending" inputMode="numeric" value={spending} placeholder="Dai tuoi dati" onChange={(e) => setSpending(e.target.value)} />
        </Field>
        <Field
          id="ass-savings"
          label={`Risparmio annuo (${currency})`}
          hint={
            plan.savingsSource === "dati" && plan.savings !== null
              ? `Vuoto = uso quanto hai messo da parte negli ultimi 12 mesi: ${money(plan.savings, currency)}.`
              : "Vuoto = uso entrate meno uscite degli ultimi 12 mesi. Scrivi 0 se non versi più nulla."
          }
        >
          <Input id="ass-savings" inputMode="numeric" value={savings} placeholder="Dai tuoi dati" onChange={(e) => setSavings(e.target.value)} />
        </Field>
        <Field id="ass-rule" label="Regola di prelievo" hint="Come decidi quanto prelevare ogni anno in pensione. La scheda Prelievi le confronta.">
          <Select value={rule} onValueChange={(v) => v && setRule(v as WithdrawalRule)}>
            <SelectTrigger id="ass-rule" className="w-full" aria-label="Regola di prelievo">
              <SelectValue>{(v: string | null) => (v ? RULE_LABELS[v as WithdrawalRule] : "")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WITHDRAWAL_RULES.map((r) => (
                <SelectItem key={r} value={r}>
                  {RULE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Pensione pubblica attesa (facoltativa)</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input aria-label="Importo annuo della pensione pubblica" inputMode="numeric" value={pensionAnnual} placeholder={`Importo annuo (${currency})`} onChange={(e) => setPensionAnnual(e.target.value)} />
            <Input aria-label="Anni dall'inizio della pensione FIRE" inputMode="numeric" value={pensionAfter} placeholder="Dopo quanti anni di pensione FIRE" onChange={(e) => setPensionAfter(e.target.value)} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Se andrai in pensione presto, la pensione pubblica arriverà più tardi e ridurrà quanto devi prelevare da allora. Scrivi l&apos;importo in euro di oggi e fra quanti anni dall&apos;inizio la riceverai; lascia vuoto per ignorarla (scelta prudente).
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex items-start justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">Conta le imposte sulle plusvalenze</span>
            <span className="block text-xs text-muted-foreground">Il patrimonio che spendi è quello dopo le tasse: il numero FIRE sale di conseguenza. Stimate: {money(plan.liquidation.latentTax, currency)} se vendessi tutto oggi.</span>
          </span>
          <Switch checked={includeTax} onCheckedChange={setIncludeTax} aria-label="Conta le imposte sulle plusvalenze" />
        </label>
        <label className="flex items-start justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">Includi la previdenza complementare</span>
            <span className="block text-xs text-muted-foreground">
              {pensionValue > 0 ? `Valore attuale ${money(pensionValue, currency)}. ` : ""}Di solito non è prelevabile prima dell&apos;età pensionabile, quindi è escluso di default.
            </span>
          </span>
          <Switch checked={includePension} onCheckedChange={setIncludePension} aria-label="Includi la previdenza complementare" />
        </label>
      </div>
      {localError || error ? (
        <p className="text-sm text-neg" role="alert">
          {localError ?? error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvo…" : "Salva ipotesi"}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => reset({ ...DEFAULT_ASSUMPTIONS, terByInstrument: assumptions.terByInstrument })}>
          Ripristina i valori consigliati
        </Button>
      </div>
    </form>
  );
}
