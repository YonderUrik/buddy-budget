"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { ResolvedPrice } from "@/lib/calc/investments";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import type {
  Instrument,
  InvestmentPortfolio,
  InvestmentTransaction,
  UserInstrumentPrice,
} from "@/lib/db/schema/investments";
import type { InvestmentData } from "@/lib/investments/data";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import type { YahooSearchHit } from "@/lib/market-data/providers/yahoo";
import type { ActivityStatement } from "@/lib/investments/import/interactive-brokers";
import type { ImportMatch, ImportResult } from "@/lib/investments/import/types";
import type { ResolveImportInput, RunImportInput } from "@/lib/validation/investments-import";
import type {
  CreateInstrumentInput,
  CreateInvestmentTransactionInput,
  ManualPriceInput,
  UpdateInvestmentTransactionInput,
  UpdateBreakdownInput,
  UpdatePortfolioInput,
  UpdateTargetsInput,
  CreateTaxCarryforwardInput,
  DismissDividendInput,
  UpdateInstrumentSettingsInput,
} from "@/lib/validation/investments";

const INVESTMENTS_QUERY_KEY = ["investments"] as const;
/** Query da aggiornare quando cambia il portafoglio: anche il patrimonio netto della Panoramica. */
const KEYS_CHANGED_BY_INVESTMENTS = [INVESTMENTS_QUERY_KEY, ["net-worth-snapshots"]] as const;
/** Attesa dopo l'ultima battuta prima di cercare sulle fonti. */
export const INSTRUMENT_SEARCH_DEBOUNCE_MS = 300;
/** Intervallo di polling mentre lo storico di uno strumento si sta scaricando. */
export const BACKFILL_POLL_INTERVAL_MS = 2000;

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

function useInvalidateInvestments() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of KEYS_CHANGED_BY_INVESTMENTS) queryClient.invalidateQueries({ queryKey: [...queryKey] });
  };
}

/** Operazioni, strumenti, prezzi e cambi dell'utente per il periodo del grafico. */
export function useInvestmentsOverviewQuery(period: NetWorthPeriod) {
  return useQuery({
    queryKey: [...INVESTMENTS_QUERY_KEY, "overview", period],
    queryFn: async (): Promise<InvestmentData> => {
      const response = await fetch(`/api/investments/overview?period=${period}`);
      if (!response.ok) throw new Error("Impossibile caricare gli investimenti");
      return response.json();
    },
  });
}

/** Risultati della ricerca strumenti. */
export interface InstrumentSearchResult {
  known: Instrument[];
  market: YahooSearchHit[];
  crypto: { id: string; name: string; symbol: string }[];
  /** ISIN valido digitato dall'utente, per offrire la creazione "solo ISIN" o manuale. */
  isin: string | null;
  /** Yahoo (ETF, azioni, fondi) non ha risposto: l'assenza di risultati non significa che lo strumento non esista. */
  marketUnavailable: boolean;
  /** CoinGecko non ha risposto. */
  cryptoUnavailable: boolean;
}

/** Valore che si aggiorna solo dopo `delay` ms senza cambi. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Cerca strumenti per nome, ticker o ISIN (con attesa tra una battuta e l'altra). */
export function useInstrumentSearchQuery(query: string) {
  const debounced = useDebouncedValue(query.trim(), INSTRUMENT_SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: [...INVESTMENTS_QUERY_KEY, "search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<InstrumentSearchResult> => {
      const response = await fetch(`/api/instruments/search?q=${encodeURIComponent(debounced)}`);
      if (!response.ok) throw new Error("Ricerca non riuscita");
      return response.json();
    },
  });
}

/** Prezzo di uno strumento a una data; `loading` indica che lo storico si sta ancora scaricando. */
export interface InstrumentPriceOnDate {
  price: ResolvedPrice | null;
  loading: boolean;
}

/** Prezzo alla data per precompilare un'operazione; riprova finché lo storico di quello strumento si sta scaricando. */
export function useInstrumentPriceOnDateQuery(instrumentId: string | null, date: string) {
  return useQuery({
    queryKey: [...INVESTMENTS_QUERY_KEY, "price-on-date", instrumentId, date],
    enabled: instrumentId !== null && /^\d{4}-\d{2}-\d{2}$/.test(date),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<InstrumentPriceOnDate> => {
      const response = await fetch(`/api/instruments/${instrumentId}/price?date=${date}`);
      if (!response.ok) throw await readError(response, "Prezzo non disponibile");
      return response.json();
    },
    refetchInterval: (q) => (q.state.data?.loading ? BACKFILL_POLL_INTERVAL_MS : false),
  });
}

/** Stato del recupero storico degli strumenti; interroga il server solo mentre almeno uno è in corso. */
export function useBackfillStatusQuery(instrumentIds: string[]) {
  const ids = [...instrumentIds].sort().join(",");
  const queryClient = useQueryClient();
  const wasRunning = React.useRef(false);
  const query = useQuery({
    queryKey: [...INVESTMENTS_QUERY_KEY, "backfill", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<BackfillStateView[]> => {
      const response = await fetch(`/api/instruments/backfill?ids=${ids}`);
      if (!response.ok) throw new Error("Impossibile leggere lo stato dei prezzi");
      return response.json();
    },
    refetchInterval: (q) =>
      q.state.data?.some((s) => s.status === "running" && !s.interrupted) ? BACKFILL_POLL_INTERVAL_MS : false,
  });
  const running = query.data?.some((s) => s.status === "running" && !s.interrupted) ?? false;
  // A recupero concluso i prezzi nuovi vanno riletti.
  React.useEffect(() => {
    if (wasRunning.current && !running) queryClient.invalidateQueries({ queryKey: [...INVESTMENTS_QUERY_KEY, "overview"] });
    wasRunning.current = running;
  }, [running, queryClient]);
  return query;
}

/** Crea o riusa uno strumento; restituisce lo strumento. */
export function useCreateInstrumentMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (input: CreateInstrumentInput): Promise<Instrument> => {
      const response = await fetch("/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile aggiungere lo strumento");
      return response.json();
    },
    onSuccess: (_instrument, input) => {
      track("instrument_added", { source: input.source });
      invalidate();
    },
  });
}

/** Registra un'operazione. */
export function useCreateInvestmentTransactionMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (input: CreateInvestmentTransactionInput): Promise<InvestmentTransaction> => {
      const response = await fetch("/api/investments/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile registrare l'operazione");
      return response.json();
    },
    onSuccess: (_row, input) => {
      track("investment_operation_added", { type: input.type });
      invalidate();
    },
  });
}

/** Modifica un'operazione. */
export function useUpdateInvestmentTransactionMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateInvestmentTransactionInput }): Promise<InvestmentTransaction> => {
      const response = await fetch(`/api/investments/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile modificare l'operazione");
      return response.json();
    },
    onSuccess: (_row, { input }) => {
      track("investment_operation_updated", { type: input.type });
      invalidate();
    },
  });
}

/** Elimina un'operazione. */
export function useDeleteInvestmentTransactionMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/investments/transactions/${id}`, { method: "DELETE" });
      if (!response.ok) throw await readError(response, "Impossibile eliminare l'operazione");
    },
    onSuccess: invalidate,
  });
}

/** Salva un prezzo manuale dell'utente per uno strumento. */
export function useSaveManualPriceMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async ({ instrumentId, input }: { instrumentId: string; input: ManualPriceInput }): Promise<UserInstrumentPrice> => {
      const response = await fetch(`/api/instruments/${instrumentId}/manual-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile salvare il prezzo");
      return response.json();
    },
    onSuccess: invalidate,
  });
}

/** Legge un Activity Statement di Interactive Brokers sul server (sezioni multiple: non è una tabella piatta). Non scrive nulla. */
export function useParseStatementMutation() {
  return useMutation({
    mutationFn: async (csv: string): Promise<ActivityStatement> => {
      const response = await fetch("/api/investments/import/parse", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csv,
      });
      if (!response.ok) throw await readError(response, "Impossibile leggere il file");
      return response.json();
    },
  });
}

/** Abbina gli strumenti di un file da importare (catalogo o fonti). Non scrive nulla. */
export function useResolveImportMutation() {
  return useMutation({
    mutationFn: async (input: ResolveImportInput): Promise<{ key: string; match: ImportMatch }[]> => {
      const response = await fetch("/api/investments/import/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile riconoscere gli strumenti");
      return (await response.json()).results;
    },
  });
}

/**
 * Anteprima (`dryRun`) o import delle operazioni. Un import rifiutato per righe in errore (400) o per uno strumento
 * (422) restituisce comunque l'esito, così la UI mostra le righe da correggere.
 */
export function useRunImportMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (input: RunImportInput): Promise<ImportResult> => {
      const response = await fetch("/api/investments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => null);
      if (body && Array.isArray(body.rows)) return body;
      throw new Error(body?.error ?? "Import non riuscito");
    },
    onSuccess: (result, input) => {
      if (input.dryRun || result.inserted === 0) return;
      track("investments_imported", { operations: result.inserted, format: input.preset ?? "personalizzato" });
      invalidate();
    },
  });
}

/** Sceglie o toglie (null) lo strumento di confronto del portafoglio. */
export function useUpdatePortfolioMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (input: UpdatePortfolioInput): Promise<InvestmentPortfolio> => {
      const response = await fetch("/api/investments/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile salvare le impostazioni del portafoglio");
      return response.json();
    },
    onSuccess: (_portfolio, input) => {
      if (input.benchmarkInstrumentId) track("investment_benchmark_set");
      if (input.taxRegime) track("investment_tax_regime_set", { regime: input.taxRegime });
      invalidate();
    },
  });
}

/** Sostituisce l'allocazione obiettivo del portafoglio (lista vuota = nessun obiettivo). */
export function useUpdateTargetsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTargetsInput): Promise<{ targets: { instrumentId: string; weight: string }[] }> => {
      const response = await fetch("/api/investments/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile salvare l'obiettivo");
      return response.json();
    },
    onSuccess: (_result, input) => {
      if (input.targets.length > 0) track("investment_targets_set", { instruments: input.targets.length });
      queryClient.invalidateQueries({ queryKey: [...INVESTMENTS_QUERY_KEY] });
    },
  });
}

/** Salva (o cancella, con entrambe le dimensioni null) la correzione manuale di settore e area di uno strumento. */
export function useUpdateBreakdownMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ instrumentId, input }: { instrumentId: string; input: UpdateBreakdownInput }): Promise<unknown> => {
      const response = await fetch(`/api/instruments/${instrumentId}/breakdown`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readError(response, "Impossibile salvare la ripartizione");
      return response.json();
    },
    onSuccess: (_result, { input }) => {
      if (input.sectors !== null || input.areas !== null) track("instrument_breakdown_saved");
      queryClient.invalidateQueries({ queryKey: [...INVESTMENTS_QUERY_KEY] });
    },
  });
}

async function sendJson(url: string, method: string, body: unknown, fallback: string): Promise<Response> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw await readError(response, fallback);
  return response;
}

/** Salva le impostazioni fiscali e le cedole di uno strumento (tutto null = torna all'automatico). */
export function useUpdateInstrumentSettingsMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async ({ instrumentId, ...input }: UpdateInstrumentSettingsInput & { instrumentId: string }) =>
      (await sendJson(`/api/instruments/${instrumentId}/settings`, "PUT", input, "Impossibile salvare le impostazioni")).json(),
    onSuccess: () => {
      track("instrument_settings_saved");
      invalidate();
    },
  });
}

/** Aggiunge una minusvalenza pregressa allo zaino. */
export function useCreateTaxCarryforwardMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (input: CreateTaxCarryforwardInput) =>
      (await sendJson("/api/investments/tax-carryforwards", "POST", input, "Impossibile salvare la minusvalenza")).json(),
    onSuccess: () => {
      track("tax_carryforward_added");
      invalidate();
    },
  });
}

/** Elimina una minusvalenza pregressa. */
export function useDeleteTaxCarryforwardMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/investments/tax-carryforwards/${id}`, { method: "DELETE" });
      if (!response.ok) throw await readError(response, "Impossibile eliminare la minusvalenza");
    },
    onSuccess: () => invalidate(),
  });
}

/** Ignora (o, con `restore`, ripristina) una o più proposte di dividendo o cedola da registrare. */
export function useDismissDividendMutation() {
  const invalidate = useInvalidateInvestments();
  return useMutation({
    mutationFn: async ({ restore, ...input }: DismissDividendInput & { restore?: boolean }) => {
      await sendJson("/api/investments/dividends/dismissed", restore ? "DELETE" : "POST", input, "Operazione non riuscita");
    },
    onSuccess: (_result, input) => {
      if (!input.restore) track("investment_dividend_dismissed");
      invalidate();
    },
  });
}
