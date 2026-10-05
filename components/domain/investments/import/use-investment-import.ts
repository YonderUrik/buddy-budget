"use client";

import * as React from "react";
import type { Instrument } from "@/lib/db/schema/investments";
import { parseCsv, type CsvTable } from "@/lib/investments/import/csv";
import { missingFields, type ImportMapping } from "@/lib/investments/import/mapping";
import { collectIdentities, normalizeRows } from "@/lib/investments/import/normalize";
import { initialMapping, type ImportPreset } from "@/lib/investments/import/presets";
import type { ActivityStatement } from "@/lib/investments/import/interactive-brokers";
import { detectImportProvider, providerMismatchMessage, type ImportProviderId } from "@/lib/investments/import/providers";
import { statementToRows, statementWarnings } from "@/lib/investments/import/statement-rows";
import { toDateKey } from "@/lib/calc/net-worth";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { track } from "@/lib/analytics";
import { useInvestmentsOverviewQuery, useParseStatementMutation, useResolveImportMutation, useRunImportMutation } from "@/lib/queries/investments";
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
  const portfolioQuery = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const [portfolioId, setPortfolioId] = React.useState("");
  const [step, setStep] = React.useState<ImportStep>("file");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<CsvTable | null>(null);
  const [preset, setPreset] = React.useState<ImportPreset | null>(null);
  // Provider scelto nella griglia del primo passo; null = lo riconosce dal file.
  const [provider, setProvider] = React.useState<ImportProviderId | null>(null);
  // Rendiconto già strutturato (Interactive Brokers): sostituisce tabella e mappatura.
  const [statementCsv, setStatementCsv] = React.useState<string | null>(null);
  const [statement, setStatement] = React.useState<ActivityStatement | null>(null);
  const [mapping, setMapping] = React.useState<ImportMapping | null>(null);
  const [choices, setChoices] = React.useState<Record<string, InstrumentChoice>>({});
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  // Esito tenuto a parte: `data` della mutation si svuota mentre l'import è in corso e il riepilogo sparirebbe.
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const resolve = useResolveImportMutation();
  const run = useRunImportMutation();
  const parseStatement = useParseStatementMutation();

  const todayKey = React.useMemo(() => toDateKey(new Date()), []);
  const rows = React.useMemo(() => {
    if (statement) return statementToRows(statement);
    return table && mapping ? normalizeRows(table, mapping, todayKey) : [];
  }, [statement, table, mapping, todayKey]);
  const warnings = React.useMemo(() => (statement ? statementWarnings(statement) : []), [statement]);
  const identities = React.useMemo(() => collectIdentities(rows), [rows]);
  const missing = mapping ? missingFields(mapping) : [];

  function selectProvider(next: ImportProviderId | null) {
    setProvider(next);
    setError(null);
  }

  /** Misura quanto serve la ricerca nell'elenco dei provider. */
  function trackProviderSearch(chosen: ImportProviderId) {
    track("investments_import_provider_searched", { provider: chosen });
  }

  async function loadText(text: string, name: string | null) {
    const detected = detectImportProvider(text);
    const mismatch = provider ? providerMismatchMessage(provider, detected) : null;
    if (mismatch) {
      setError(mismatch);
      return;
    }
    if (detected === "interactive-brokers" || detected === "degiro") {
      try {
        const parsed = await parseStatement.mutateAsync(text);
        if (parsed.operations.length === 0 && !parsed.issues.some((i) => i.severity === "error")) {
          setError("Nel rendiconto non ci sono acquisti, vendite o dividendi di azioni ed ETF da importare");
          return;
        }
        setStatement(parsed);
        setStatementCsv(text);
        setTable(null);
        setMapping(null);
        setPreset(null);
        track("investments_import_file_read", { provider: detected, chosen: provider === detected });
        setProvider(detected);
        setFileName(name);
        setError(null);
        setStep("mapping");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossibile leggere il file");
      }
      return;
    }
    const parsed = parseCsv(text);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setError("Il file non sembra un CSV con intestazioni e almeno una riga");
      return;
    }
    const initial = initialMapping(parsed);
    track("investments_import_file_read", { provider: detected ?? "generic", chosen: provider !== null });
    setStatement(null);
    setStatementCsv(null);
    setTable(parsed);
    setFileName(name);
    setPreset(initial.preset);
    setMapping(readSavedMapping(parsed) ?? initial.mapping);
    setError(null);
    setStep("mapping");
  }

  function updateMapping(patch: Partial<ImportMapping>) {
    setMapping((current) => (current ? { ...current, ...patch } : current));
    setResult(null);
  }

  async function goToInstruments() {
    if (!statement && (!table || !mapping)) return;
    if (identities.length > IMPORT_MAX_IDENTITIES) {
      setError(`Il file ha ${identities.length} strumenti: al massimo ${IMPORT_MAX_IDENTITIES} per import`);
      return;
    }
    if (table && mapping) saveMapping(table, mapping);
    setError(null);
    try {
      const results = await resolve.mutateAsync({
        identities: identities.map(({ key, symbol, isin, name, currency, symbolIsYahoo, type }) => ({
          key,
          symbol,
          isin,
          name,
          currency,
          symbolIsYahoo,
          type,
        })),
      });
      setChoices(Object.fromEntries(results.map((r) => [r.key, choiceFromMatch(r.match)])));
      setExcluded(new Set());
      setStep("instruments");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile riconoscere gli strumenti");
    }
  }

  function chooseInstrument(key: string, instrument: Instrument) {
    setChoices((current) => ({
      ...current,
      [key]: { kind: "known", instrument },
    }));
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
    const request = buildImportRequest(rows, choices, excluded, dryRun, statement ? statement.preset : (preset?.id ?? null));
    if (!request) {
      setError("Nessuna operazione da importare: scegli almeno uno strumento");
      return;
    }
    if (statementCsv) request.statementCsv = statementCsv;
    if (statement && portfolioId) request.portfolioId = portfolioId;
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
    portfolioId, setPortfolioId, portfolios: portfolioQuery.data?.portfolios ?? [],
    step,
    fileName,
    table,
    preset,
    provider,
    statement,
    warnings,
    mapping,
    rows,
    identities,
    missing,
    choices,
    excluded,
    error,
    done,
    reading: parseStatement.isPending,
    resolving: resolve.isPending,
    running: run.isPending,
    result,
    selectProvider,
    trackProviderSearch,
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
