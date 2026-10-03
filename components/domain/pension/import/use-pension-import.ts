"use client";

import * as React from "react";
import {
  initialPensionMapping,
  missingPensionFields,
  normalizePensionRows,
  readCsvTable,
  type PensionImportMapping,
  type PensionImportTable,
} from "@/lib/pension/import/mapping";
import { planSnapshotImport, type ExistingSnapshot, type SnapshotImportPlan } from "@/lib/pension/import/plan";
import { readXlsx } from "@/lib/pension/import/xlsx";
import { PENSION_MAX_SNAPSHOTS_PER_FUND } from "@/lib/pension/limits";
import { useImportPensionSnapshotsMutation } from "@/lib/queries/pension";

/** Passi del wizard di import. */
export const PENSION_IMPORT_STEPS = ["file", "columns", "summary"] as const;
export type PensionImportStep = (typeof PENSION_IMPORT_STEPS)[number];
export type PensionImportFormat = "csv" | "xlsx" | "incollato";

const isXlsx = (file: File) => /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");

/**
 * Stato del wizard di import delle fotografie: il file si legge nel browser (non viene mai caricato), le righe si
 * ricalcolano a ogni cambio di colonna e il piano (nuove, aggiornate, saltate) si confronta con le fotografie già salvate.
 */
export function usePensionImport(fundId: string, existing: ExistingSnapshot[], today: string) {
  const [step, setStep] = React.useState<PensionImportStep>("file");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [format, setFormat] = React.useState<PensionImportFormat>("csv");
  const [table, setTable] = React.useState<PensionImportTable | null>(null);
  const [mapping, setMapping] = React.useState<PensionImportMapping | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<SnapshotImportPlan["counts"] | null>(null);
  const run = useImportPensionSnapshotsMutation();

  const rows = React.useMemo(() => (table && mapping ? normalizePensionRows(table, mapping, today) : []), [table, mapping, today]);
  const valid = React.useMemo(() => rows.flatMap((r) => (r.status === "ok" ? [r.snapshot] : [])), [rows]);
  const missing = mapping ? missingPensionFields(mapping) : [];
  const plan = React.useMemo(() => planSnapshotImport(valid, existing, today, PENSION_MAX_SNAPSHOTS_PER_FUND), [valid, existing, today]);

  function load(next: PensionImportTable, name: string | null, kind: PensionImportFormat) {
    if (next.headers.length < 2 || next.rows.length === 0) {
      setError("Il file non sembra una tabella con intestazioni e almeno una riga");
      return;
    }
    setTable(next);
    setMapping(initialPensionMapping(next));
    setFileName(name);
    setFormat(kind);
    setError(null);
    setStep("columns");
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    try {
      if (isXlsx(file)) load(readXlsx(new Uint8Array(await file.arrayBuffer())), file.name, "xlsx");
      else load(readCsvTable(await file.text()), file.name, "csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non riesco a leggere il file");
    }
  }

  const loadText = (text: string) => load(readCsvTable(text), null, "incollato");

  function updateMapping(patch: Partial<PensionImportMapping>) {
    setMapping((current) => (current ? { ...current, ...patch } : current));
  }

  async function confirm() {
    setError(null);
    try {
      const result = await run.mutateAsync({ fundId, input: { format, rows: valid } });
      setDone(result.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import non riuscito");
    }
  }

  function back() {
    setError(null);
    setStep((current) => (current === "summary" ? "columns" : "file"));
  }

  return {
    step,
    fileName,
    table,
    mapping,
    rows,
    plan,
    missing,
    error,
    done,
    running: run.isPending,
    loadFile,
    loadText,
    updateMapping,
    toSummary: () => setStep("summary"),
    confirm,
    back,
  };
}
