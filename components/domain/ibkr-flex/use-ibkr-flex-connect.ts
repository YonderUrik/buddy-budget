"use client";
import { useState } from "react";
import { IbkrFlexRequestError, useConnectIbkrFlex } from "@/lib/queries/ibkr-flex";
import { IBKR_FLEX_QUERY_REASONS } from "./ibkr-flex-text";

/** 0 = create the query, 1 = Query ID, 2 = token. */
export type IbkrFlexStep = 0 | 1 | 2;

const QUERY_ID_PATTERN = /^\d{1,12}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9]{10,64}$/;

/**
 * State of the three-step connection: the current step, the Query ID and token typed so far, and the connect call.
 * Both values survive a refusal (a query to fix keeps the token, a new token keeps the Query ID); the token is
 * dropped as soon as the connection succeeds and never leaves this hook except in the request itself.
 */
export function useIbkrFlexConnectFlow(initialStep: IbkrFlexStep = 0, onConnected?: () => void) {
  const connect = useConnectIbkrFlex();
  const [step, setStep] = useState<IbkrFlexStep>(initialStep);
  const [queryId, setQueryIdValue] = useState("");
  const [token, setTokenValue] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const error = connect.error instanceof IbkrFlexRequestError ? connect.error : connect.error ? new IbkrFlexRequestError("internal") : null;
  const cleanQueryId = queryId.trim();
  const cleanToken = token.replace(/\s/g, "");

  return {
    step,
    queryId,
    token,
    connected,
    jobId,
    pending: connect.isPending,
    error,
    /** The refusal is about the query: offer to go back to its settings. */
    queryProblem: error !== null && IBKR_FLEX_QUERY_REASONS.has(error.reason),
    queryIdValid: QUERY_ID_PATTERN.test(cleanQueryId),
    tokenValid: TOKEN_PATTERN.test(cleanToken),
    setQueryId: (value: string) => { setQueryIdValue(value); connect.reset(); },
    setToken: (value: string) => { setTokenValue(value); connect.reset(); },
    goTo: (next: IbkrFlexStep) => setStep(next),
    submit: () => {
      if (!QUERY_ID_PATTERN.test(cleanQueryId)) { setStep(1); return; }
      if (!TOKEN_PATTERN.test(cleanToken)) return;
      connect.mutate({ token: cleanToken, queryId: cleanQueryId }, {
        onSuccess: (result) => { setTokenValue(""); setJobId(result.jobId); setConnected(true); onConnected?.(); },
      });
    },
  };
}

export type IbkrFlexConnectFlow = ReturnType<typeof useIbkrFlexConnectFlow>;
