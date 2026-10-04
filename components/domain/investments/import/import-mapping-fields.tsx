"use client";

/**
 * Selettori della mappatura: quale colonna alimenta ogni campo, formato di date e numeri, e traduzione dei valori
 * della colonna "tipo". Mostra accanto a ogni colonna un valore d'esempio, così si capisce cosa si sta scegliendo.
 */

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVESTMENT_TRANSACTION_TYPES, type InvestmentTransactionType } from "@/lib/db/schema/investments";
import type { CsvTable } from "@/lib/investments/import/csv";
import {
  distinctValues,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  suggestTypeValue,
  type ImportField,
  type ImportMapping,
  type TypeValueTarget,
} from "@/lib/investments/import/mapping";
import { DATE_ORDERS, DECIMAL_SEPARATORS, type DateOrder, type DecimalSeparator } from "@/lib/investments/import/values";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";

export interface ImportMappingFieldsProps {
  table: CsvTable;
  mapping: ImportMapping;
  onChange: (patch: Partial<ImportMapping>) => void;
}

const NONE = "none";
const DATE_ORDER_LABELS: Record<DateOrder, string> = {
  ymd: "Anno, mese, giorno (2026-01-31)",
  dmy: "Giorno, mese, anno (31/01/2026)",
  mdy: "Mese, giorno, anno (01/31/2026)",
};
const DECIMAL_LABELS: Record<DecimalSeparator, string> = { ".": "Punto (1,234.56)", ",": "Virgola (1.234,56)" };
const TYPE_TARGET_LABELS: Record<TypeValueTarget, string> = { ...TRANSACTION_TYPE_LABELS, ignora: "Ignora la riga" };
/** Campi indispensabili, mostrati per primi. */
const REQUIRED: ReadonlySet<ImportField> = new Set(["date", "symbol", "isin", "name", "quantity", "price", "total"]);

function LabeledSelect<T extends string>(props: {
  label: string;
  value: T;
  options: readonly T[];
  labelFor: (value: T) => string;
  onChange: (value: T) => void;
}) {
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

export function ImportMappingFields({ table, mapping, onChange }: ImportMappingFieldsProps) {
  const columnOptions = [NONE, ...table.headers.map((_, i) => String(i))];
  const sample = (column: number) => table.rows.find((r) => (r[column] ?? "").trim() !== "")?.[column] ?? "";
  const columnLabel = (value: string) => {
    if (value === NONE) return "Nessuna colonna";
    const example = sample(Number(value));
    return `${table.headers[Number(value)] || `Colonna ${Number(value) + 1}`}${example ? ` — es. ${example}` : ""}`;
  };
  const setColumn = (field: ImportField, value: string) => {
    const columns = { ...mapping.columns };
    if (value === NONE) delete columns[field];
    else columns[field] = Number(value);
    // Una colonna tipo appena scelta: i suoi valori si traducono per sinonimo, senza perdere le scelte già fatte.
    const typeValues = { ...mapping.typeValues };
    if (field === "type") {
      for (const v of distinctValues(table, columns.type)) typeValues[v.toLowerCase()] ??= suggestTypeValue(v);
    }
    onChange({ columns, typeValues });
  };
  const ordered = [...IMPORT_FIELDS].sort((a, b) => Number(REQUIRED.has(b)) - Number(REQUIRED.has(a)));
  const typeValues = distinctValues(table, mapping.columns.type);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ordered.map((field) => (
          <LabeledSelect
            key={field}
            label={IMPORT_FIELD_LABELS[field]}
            value={mapping.columns[field] === undefined ? NONE : String(mapping.columns[field])}
            options={columnOptions}
            labelFor={columnLabel}
            onChange={(v) => setColumn(field, v)}
          />
        ))}
        <LabeledSelect label="Formato delle date" value={mapping.dateOrder} options={DATE_ORDERS} labelFor={(v) => DATE_ORDER_LABELS[v]} onChange={(dateOrder) => onChange({ dateOrder })} />
        <LabeledSelect label="Separatore dei decimali" value={mapping.decimal} options={DECIMAL_SEPARATORS} labelFor={(v) => DECIMAL_LABELS[v]} onChange={(decimal) => onChange({ decimal })} />
      </div>

      {mapping.columns.type === undefined ? (
        <LabeledSelect
          label="Senza colonna tipo, ogni riga è un"
          value={mapping.defaultType}
          options={INVESTMENT_TRANSACTION_TYPES}
          labelFor={(v) => TRANSACTION_TYPE_LABELS[v]}
          onChange={(defaultType: InvestmentTransactionType) => onChange({ defaultType })}
        />
      ) : typeValues.length > 0 ? (
        <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
          <legend className="px-1 text-xs text-muted-foreground">Cosa significano i valori della colonna tipo</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {typeValues.map((value) => (
              <LabeledSelect
                key={value}
                label={`"${value}"`}
                value={mapping.typeValues[value.toLowerCase()] ?? "ignora"}
                options={[...INVESTMENT_TRANSACTION_TYPES.filter((t) => t !== "rettifica"), "ignora"] as TypeValueTarget[]}
                labelFor={(v) => TYPE_TARGET_LABELS[v]}
                onChange={(target) => onChange({ typeValues: { ...mapping.typeValues, [value.toLowerCase()]: target } })}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
