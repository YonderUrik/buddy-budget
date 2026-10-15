"use client";
import { useId, type ReactNode } from "react";
import { useLocalization } from "@/lib/localization/provider";
import { Input } from "@/components/ui/input";

export interface NumberFieldProps { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }
/** Labelled numeric input for explicit financial assumptions. */
export function NumberField({ label, value, onChange, min = 0, max, step = 0.01 }: NumberFieldProps) {
  const id = useId(); const { t } = useLocalization();
  return <label htmlFor={id} className="flex flex-col gap-1 text-sm"><span>{t(label)}</span><Input id={id} type="number" min={min} max={max} step={step} value={Number(value.toFixed(8))} onChange={e => onChange(Math.max(min, Math.min(max ?? 1e12, Number(e.target.value) || 0)))} /></label>;
}
export interface ChoiceProps { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }
/** Native select with translated labels and stable stored identifiers. */
export function Choice({ label, value, options, onChange }: ChoiceProps) {
  const id = useId(); const { t } = useLocalization();
  return <div className="flex flex-col gap-1 text-sm"><label htmlFor={id}>{t(label)}</label><select id={id} value={value} onChange={e => onChange(e.target.value)} className="h-10 rounded-md border bg-background px-3">{options.map(o => <option value={o.value} key={o.value}>{t(o.label)}</option>)}</select></div>;
}
/** Group related inputs and results in the same visual section. */
export function Panel({ title, children, literalTitle = false }: { title: string; children: ReactNode; literalTitle?: boolean }) {
  const { t } = useLocalization();
  return <section className="space-y-4 rounded-2xl border p-5"><h2 className="font-heading text-lg font-medium">{literalTitle ? title : t(title)}</h2>{children}</section>;
}
/** Locale-aware EUR amount; unavailable estimates are explicit. */
export function Amount({ value }: { value: number | null }) {
  const { locale, t } = useLocalization();
  return <span className="font-mono tabular-nums">{value === null ? t("More information needed") : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value)}</span>;
}
/** Label and amount for a scenario result. */
export function Result({ label, value }: { label: string; value: number | null }) {
  const { t } = useLocalization();
  return <div className="flex justify-between gap-4 border-b py-2"><span>{t(label)}</span><Amount value={value} /></div>;
}
export const FUND_OPTIONS = [{ value: "unknown", label: "Not yet classified" }, { value: "equity", label: "Equity fund (30% exemption)" }, { value: "mixed", label: "Mixed fund (15% exemption)" }, { value: "property", label: "Property fund (60% exemption)" }, { value: "foreign-property", label: "Foreign property fund (80% exemption)" }, { value: "other", label: "Other fund (no exemption)" }] as const;
