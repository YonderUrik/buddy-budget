"use client";
import { useId } from "react";
import { Loader2Icon } from "lucide-react";
import { ErrorWithReport } from "@/components/domain/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalization } from "@/lib/localization/provider";
import { IbkrFlexSettings } from "./ibkr-flex-step-parts";
import { IBKR_FLEX_ERRORS, IBKR_FLEX_TOKEN_SETTINGS } from "./ibkr-flex-text";
import type { IbkrFlexConnectFlow } from "./use-ibkr-flex-connect";

const FIELD_CLASS = "h-11 text-base";
/** Example shown in the sketch of IBKR's query list: not a real query. */
const SAMPLE_QUERY_ID = "1234567";

export interface IbkrFlexStepProps {
  flow: IbkrFlexConnectFlow;
  /** Hide «Indietro» on the first step shown (a reconnect starts at the Query ID). */
  canGoBack?: boolean;
}

/** Step 2: the Query ID, with a sketch of where IBKR shows it. */
export function IbkrFlexQueryIdStep({ flow, canGoBack = true }: IbkrFlexStepProps) {
  const { t } = useLocalization();
  const id = useId();
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (flow.queryIdValid) flow.goTo(2); }}>
      <p className="text-sm leading-relaxed text-text-2">{t("Salva la query. Nell'elenco delle Flex Queries, il numero accanto al nome è il Query ID.")}</p>
      <figure className="flex flex-col gap-2">
        <div role="img" aria-label={t("Schema: la riga della query con il Query ID evidenziato")} className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-3.5">
          <span className="text-xs font-semibold text-text-2">Activity Flex Query</span>
          <span className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5 text-sm">
            <span>BuddyBudget</span>
            <span className="rounded-md bg-highlight px-2 py-0.5 font-semibold tabular-nums text-foreground">{SAMPLE_QUERY_ID}</span>
          </span>
        </div>
        <figcaption className="text-xs text-text-3">{t("Schema: il numero evidenziato è quello da copiare.")}</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-query`}>{t("Query ID")}</Label>
        <Input id={`${id}-query`} value={flow.queryId} onChange={(event) => flow.setQueryId(event.target.value)} inputMode="numeric" autoComplete="off" placeholder={SAMPLE_QUERY_ID} maxLength={12} className={FIELD_CLASS} aria-describedby={`${id}-query-hint`} aria-invalid={flow.queryId.trim() !== "" && !flow.queryIdValid} />
        <span id={`${id}-query-hint`} className="text-xs text-text-3">{t("Solo cifre.")}</span>
      </div>
      <div className="flex gap-2 pt-2">
        {canGoBack ? <Button type="button" variant="secondary" className="h-11 px-6" onClick={() => flow.goTo(0)}>{t("Indietro")}</Button> : null}
        <Button type="submit" variant="sun" className="h-11 flex-1" disabled={!flow.queryIdValid}>{t("Avanti")}</Button>
      </div>
    </form>
  );
}

export interface IbkrFlexTokenStepProps extends IbkrFlexStepProps {
  /** «Collega» for a new account, «Ricollega» when replacing a token. */
  submitLabel?: string;
}

/** Step 3: where to generate the token, the token field and «Collega», with IBKR's refusal and how to fix it. */
export function IbkrFlexTokenStep({ flow, submitLabel = "Collega" }: IbkrFlexTokenStepProps) {
  const { t } = useLocalization();
  const id = useId();
  const error = flow.error;
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); flow.submit(); }}>
      <p className="text-sm leading-relaxed text-text-2">
        {t("Nella stessa pagina apri")} <b className="font-semibold text-foreground">Flex Web Service Configuration</b> {t("(l'ingranaggio), attiva il servizio e genera un token:")}
      </p>
      <IbkrFlexSettings rows={IBKR_FLEX_TOKEN_SETTINGS} translateValue />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-token`}>{t("Token")}</Label>
        <Input id={`${id}-token`} type="password" value={flow.token} onChange={(event) => flow.setToken(event.target.value)} autoComplete="off" spellCheck={false} placeholder={t("Incolla il token")} maxLength={80} disabled={flow.pending} className={FIELD_CLASS} aria-describedby={`${id}-token-hint`} />
        <span id={`${id}-token-hint`} className="text-xs text-text-3">{t("Lo cifriamo appena arriva e non torna mai al browser. Puoi revocarlo da IBKR quando vuoi.")}</span>
      </div>
      {error ? (
        <div className="flex flex-col gap-2 rounded-xl bg-neg-soft p-3 text-sm">
          <ErrorWithReport error={IBKR_FLEX_ERRORS[error.reason] ?? IBKR_FLEX_ERRORS.internal} area="collega_banca" />
          {error.sections.length ? <p className="text-text-2">{t("Sezioni mancanti: {0}", { 0: error.sections.join(", ") })}</p> : null}
          {flow.queryProblem ? <Button type="button" variant="secondary" className="h-11 self-start" onClick={() => flow.goTo(0)}>{t("Correggi la query")}</Button> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="h-11 px-6" disabled={flow.pending} onClick={() => flow.goTo(1)}>{t("Indietro")}</Button>
          <Button type="submit" variant="sun" className="h-11 flex-1 gap-2" disabled={flow.pending || !flow.tokenValid}>
            {flow.pending ? <><Loader2Icon className="size-4 animate-spin" aria-hidden="true" />{t("Controllo con Interactive Brokers…")}</> : t(submitLabel)}
          </Button>
        </div>
        {flow.pending ? <p className="text-center text-xs text-text-3" role="status">{t("Interactive Brokers prepara un rendiconto di prova: può volerci fino a un minuto.")}</p> : null}
      </div>
    </form>
  );
}
