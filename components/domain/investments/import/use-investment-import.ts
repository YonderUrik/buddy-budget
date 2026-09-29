"use client";

import * as React from "react";
import type { Instrument } from "@/lib/db/schema/investments";
import { parseCsv, type CsvTable } from "@/lib/investments/import/csv";
import { missingFields, type ImportMapping } from "@/lib/investments/import/mapping";
import { collectIdentities, normalizeRows } from "@/lib/investments/import/normalize";
import { initialMapping, type ImportPreset } from "@/lib/investments/import/presets";
import { toDateKey } from "@/lib/calc/net-worth";
import { useResolveImportMutation, useRunImportMutation } from "@/lib/queries/investments";
import type { ImportResult } from "@/lib/investments/import/types";
import { IMPORT_MAX_IDENTITIES } from "@/lib/validation/investments-import";
import {
  buildImportRequest,
  choiceFromMatch,
  readSavedMapping,
  saveMapping,
  type ImportStep,
  type InstrumentChoice,
} from "./investment-import.state";

/**
 * Stato del wizard di import: file letto, mappatura, abbinamento degli strumenti, anteprima e import. Le righe si
 * ricalcolano a ogni modifica della mappatura, così l'anteprima dei valori letti è sempre quella vera.
 */
export function useInvestmentImport() {
  const [step, setStep] = React.useState<ImportStep>("file");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<CsvTable | null>(null);
  const [preset, setPreset] = React.useState<ImportPreset | null>(null);
  const [mapping, setMapping] = React.useState<ImportMapping | null>(null);
  const [choices, setChoices] = React.useState<Record<string, InstrumentChoice>>({});
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  // Esito tenuto a parte: `data` della mutation si svuota mentre l'import è in corso e il riepilogo sparirebbe.
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const resolve = useResolveImportMutation();
  const run = useRunImportMutation();

  const todayKey = React.useMemo(() => toDateKey(new Date()), []);
  const rows = React.useMemo(() => (table && mapping ? normalizeRows(table, mapping, todayKey) : []), [table, mapping, todayKey]);
  const identities = React.useMemo(() => collectIdentities(rows), [rows]);
  const missing = mapping ? missingFields(mapping) : [];

  function loadText(text: string, name: string | null) {
    const parsed = parseCsv(text);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setError("Il file non sembra un CSV con intestazioni e almeno una riga");
      return;
    }
    const detected = initialMapping(parsed);
    setTable(parsed);
    setFileName(name);
    setPreset(detected.preset);
    setMapping(readSavedMapping(parsed) ?? detected.mapping);
    setError(null);
    setStep("mapping");
  }

  function updateMapping(patch: Partial<ImportMapping>) {
    setMapping((current) => (current ? { ...current, ...patch } : current));
    setResult(null);
  }

  async function goToInstruments() {
    if (!table || !mapping) return;
    if (identities.length > IMPORT_MAX_IDENTITIES) {
      setError(`Il file ha ${identities.length} strumenti: al massimo ${IMPORT_MAX_IDENTITIES} per import`);
      return;
    }
    saveMapping(table, mapping);
    setError(null);
    try {
      const results = await resolve.mutateAsync({
        identities: identities.map(({ key, symbol, isin, name, currency, symbolIsYahoo }) => ({ key, symbol, isin, name, currency, symbolIsYahoo })),
      });
      setChoices(Object.fromEntries(results.map((r) => [r.key, choiceFromMatch(r.match)])));
      setExcluded(new Set());
      setStep("instruments");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile riconoscere gli strumenti");
    }
  }

  function chooseInstrument(key: string, instrument: Instrument) {
    setChoices((current) => ({ ...current, [key]: { kind: "known", instrument } }));
    setExcluded((current) => new Set([...current].filter((k) => k !== key)));
  }

  function toggleExcluded(key: string, exclude: boolean) {
    setExcluded((current) => {
      const next = new Set(current);
      if (exclude) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function submit(dryRun: boolean) {
    const request = buildImportRequest(rows, choices, excluded, dryRun, preset?.id ?? null);
    if (!request) {
      setError("Nessuna operazione da importare: scegli almeno uno strumento");
      return;
    }
    setError(null);
    try {
      const result = await run.mutateAsync(request);
      setResult(result);
      if (result.error) setError(result.error);
      if (dryRun && !result.error) setStep("summary");
      if (!dryRun && !result.error && result.counts.error === 0) setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import non riuscito");
    }
  }

  function back() {
    setError(null);
    setResult(null);
    setStep((current) => (current === "summary" ? "instruments" : current === "instruments" ? "mapping" : "file"));
  }

  return {
    step,
    fileName,
    table,
    preset,
    mapping,
    rows,
    identities,
    missing,
    choices,
    excluded,
    error,
    done,
    resolving: resolve.isPending,
    running: run.isPending,
    result,
    loadText,
    updateMapping,
    goToInstruments,
    chooseInstrument,
    toggleExcluded,
    preview: () => submit(true),
    confirm: () => submit(false),
    back,
  };
}

export type InvestmentImportState = ReturnType<typeof useInvestmentImport>;
