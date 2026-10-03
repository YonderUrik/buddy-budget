"use client";

/** Secondo passo dell'import: quale colonna è la data, i contributi e il controvalore, con anteprima delle righe lette. */

import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_ORDERS, DECIMAL_SEPARATORS, type DateOrder, type DecimalSeparator } from "@/lib/investments/import/values";
import {
  PENSION_IMPORT_FIELDS,
  PENSION_IMPORT_FIELD_LABELS,
  type PensionImportField,
  type PensionImportMapping,
  type PensionImportRow,
  type PensionImportTable,
} from "@/lib/pension/import/mapping";
import { formatShortDateKey, money } from "../pension-format";

export interface PensionImportMappingStepProps {
  fileName: string | null;
  table: PensionImportTable;
  mapping: PensionImportMapping;
  rows: PensionImportRow[];
  missing: string[];
  currency: string;
  onChange: (patch: Partial<PensionImportMapping>) => void;
}

const NONE = "none";
const PREVIEW_ROWS = 5;
const MAX_LISTED_PROBLEMS = 5;
const DATE_ORDER_LABELS: Record<DateOrder, string> = {
  ymd: "Anno, mese, giorno (2026-01-31)",
  dmy: "Giorno, mese, anno (31/01/2026)",
  mdy: "Mese, giorno, anno (01/31/2026)",
};
const DECIMAL_LABELS: Record<DecimalSeparator, string> = { ".": "Punto (1,234.56)", ",": "Virgola (1.234,56)" };

function LabeledSelect<T extends string>(props: { label: string; value: T; options: readonly T[]; labelFor: (v: T) => string; onChange: (v: T) => void }) {
  const id = React.useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span id={id} className="text-xs text-muted-foreground">
        {props.label}
      </span>
      <Select value={props.value} onValueChange={(v) => v !== null && props.onChange(v as T)}>
        <SelectTrigger className="w-full" aria-labelledby={id}>
          <SelectValue>{(v: string | null) => (v ? props.labelFor(v as T) : "")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option} value={option}>
              {props.labelFor(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PensionImportMappingStep({ fileName, table, mapping, rows, missing, currency, onChange }: PensionImportMappingStepProps) {
  const options = [NONE, ...table.headers.map((_, i) => String(i))];
  const sample = (column: number) => table.rows.find((r) => (r[column] ?? "").trim() !== "")?.[column] ?? "";
  const columnLabel = (value: string) => {
    if (value === NONE) return "Nessuna colonna";
    const example = sample(Number(value));
    return `${table.headers[Number(value)] || `Colonna ${Number(value) + 1}`}${example ? ` — es. ${example}` : ""}`;
  };
  const setColumn = (field: PensionImportField, value: string) => {
    const columns = { ...mapping.columns };
    if (value === NONE) delete columns[field];
    else columns[field] = Number(value);
    onChange({ columns });
  };
  const ok = rows.flatMap((r) => (r.status === "ok" ? [r.snapshot] : []));
  const problems = rows.filter((r) => r.status === "error");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {fileName ? <span className="font-medium text-foreground">{fileName}</span> : "Testo incollato"} · controlla che ogni colonna sia quella giusta.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PENSION_IMPORT_FIELDS.map((field) => (
          <LabeledSelect
            key={field}
            label={PENSION_IMPORT_FIELD_LABELS[field]}
            value={mapping.columns[field] === undefined ? NONE : String(mapping.columns[field])}
            options={options}
            labelFor={columnLabel}
            onChange={(v) => setColumn(field, v)}
          />
        ))}
        <LabeledSelect label="Formato delle date" value={mapping.dateOrder} options={DATE_ORDERS} labelFor={(v) => DATE_ORDER_LABELS[v]} onChange={(dateOrder) => onChange({ dateOrder })} />
        <LabeledSelect label="Separatore dei decimali" value={mapping.decimal} options={DECIMAL_SEPARATORS} labelFor={(v) => DECIMAL_LABELS[v]} onChange={(decimal) => onChange({ decimal })} />
      </div>

      {missing.length > 0 ? (
        <p className="text-sm text-destructive">Indica quale colonna contiene: {missing.join(", ")}.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            <span className="font-medium tabular-nums">{ok.length}</span> fotografie lette su {rows.length} righe
            {problems.length > 0 ? `, ${problems.length} scartate` : ""}.
          </p>
          {ok.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Riga</th>
                    <th className="px-2 py-1.5 font-medium">Data</th>
                    <th className="px-2 py-1.5 text-right font-medium">Contributi netti</th>
                    <th className="px-2 py-1.5 text-right font-medium">Controvalore</th>
                  </tr>
                </thead>
                <tbody>
                  {ok.slice(0, PREVIEW_ROWS).map((s) => (
                    <tr key={s.line} className="border-t">
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{s.line}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatShortDateKey(s.date)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">{money(s.netContributions, currency)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">{money(s.value, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {problems.length > 0 ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {problems.slice(0, MAX_LISTED_PROBLEMS).map((row) => (
                <li key={row.line} className="flex items-start gap-1.5">
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden="true" />
                  Riga {row.line}: {row.status === "error" ? row.message : ""}
                </li>
              ))}
              {problems.length > MAX_LISTED_PROBLEMS ? <li>…e altre {problems.length - MAX_LISTED_PROBLEMS}</li> : null}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
