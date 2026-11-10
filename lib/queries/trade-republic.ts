"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { pageText } from "@/lib/localization/page-text";

export type TradeRepublicLoginAction = { action: "login"; phoneNumber: string; pin: string } | { action: "verify"; code: string };
interface LoginResult { status: "pending" | "confirmed" | "connected"; needsAuthenticator?: boolean; accountId?: string; jobId?: string }
const LOGIN_PATH = "/api/trade-republic/login";
async function post(body: object): Promise<LoginResult> {
  const response = await fetch(LOGIN_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? pageText("Impossibile avviare il collegamento"));
  return result;
}

/** Keep one-use PINs and MFA codes out of query/mutation caches, storage and URLs. */
export function useTradeRepublicLogin() {
  const client = useQueryClient();
  const [actionResult, setResult] = useState<LoginResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const initial = useQuery({ queryKey: ["trade-republic", "login"], queryFn: async (): Promise<{ pending: boolean; configured: boolean }> => {
    const response = await fetch(LOGIN_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(pageText("Impossibile avviare il collegamento"));
    return response.json();
  }, retry: false });
  const canPoll = !stopped && !busy && (actionResult?.status === "pending" || initial.data?.pending === true) && actionResult?.status !== "connected";
  const poll = useQuery({ queryKey: ["trade-republic", "approval"], queryFn: () => post({ action: "poll" }),
    enabled: query => canPoll && query.state.data?.status !== "connected" && !query.state.data?.needsAuthenticator && !query.state.error,
    retry: false, refetchInterval: query => canPoll && query.state.data?.status !== "connected" && !query.state.data?.needsAuthenticator && !query.state.error ? 2500 : false, gcTime: 0,
  });
  const result = poll.data ?? actionResult;
  const pending = !stopped && !poll.error && result?.status !== "connected" && (result?.status === "pending" || initial.data?.pending === true);
  useEffect(() => {
    if (result?.status !== "connected") return;
    track("trade_republic_connected");
    for (const key of [["accounts"], ["gocardless", "connections", "status"], ["sync-jobs"]]) void client.invalidateQueries({ queryKey: key });
  }, [result?.status, client]);
  async function submit(input: TradeRepublicLoginAction) {
    setBusy(true); setError(null);
    try {
      const next = await post(input);
      client.removeQueries({ queryKey: ["trade-republic", "approval"] });
      setStopped(false); setResult(next);
      if (input.action === "login") track("trade_republic_login_started");
    } catch (failure) { setError(failure instanceof Error ? failure.message : pageText("Impossibile avviare il collegamento")); setStopped(true); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try {
      const response = await fetch(LOGIN_PATH, { method: "DELETE" });
      if (!response.ok) throw new Error(pageText("Impossibile annullare il collegamento"));
      setStopped(true); setResult(null); setError(null);
      client.removeQueries({ queryKey: ["trade-republic", "approval"] });
      await client.invalidateQueries({ queryKey: ["trade-republic", "login"] });
    } catch (failure) { setError(failure instanceof Error ? failure.message : pageText("Impossibile annullare il collegamento")); }
    finally { setBusy(false); }
  }
  return { result, pending, busy, error: error ?? poll.error?.message ?? initial.error?.message, loading: initial.isPending, configured: initial.data?.configured, submit, cancel };
}
