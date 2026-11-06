"use client";
import { useId } from "react";
import { Loader2Icon } from "lucide-react";
import { ErrorWithReport } from "@/components/domain/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalization } from "@/lib/localization/provider";
import { IbkrFlexRequestError, useConnectIbkrFlex } from "@/lib/queries/ibkr-flex";
import { IBKR_FLEX_ERRORS, IBKR_FLEX_GUIDE_STEPS } from "./ibkr-flex-text";

const FIELD_CLASS = "h-11";

export interface ConnectIbkrFlexFormProps {
  /** Called once the connection is saved (the import continues in the background). */
  onConnected?: () => void;
  /** Label of the submit button: «Collega» for a new account, «Ricollega» when replacing a token. */
  submitLabel?: string;
  disabled?: boolean;
}

/** The Flex Query guide and the token + Query ID form; the token is cleared from the form as soon as it is sent. */
export function ConnectIbkrFlexForm({ onConnected, submitLabel = "Collega Interactive Brokers", disabled = false }: ConnectIbkrFlexFormProps) {
  const { t } = useLocalization();
  const connect = useConnectIbkrFlex();
  const id = useId();
  const error = connect.error instanceof IbkrFlexRequestError ? connect.error : connect.error ? new IbkrFlexRequestError("internal") : null;
  return (
    <div className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text-2">
        {IBKR_FLEX_GUIDE_STEPS.map((step) => <li key={step}>{t(step)}</li>)}
      </ol>
      <form className="flex flex-col gap-4" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget; const data = new FormData(form);
        const token = String(data.get("token") ?? "").trim(); const queryId = String(data.get("queryId") ?? "").trim();
        form.reset();
        connect.mutate({ token, queryId }, { onSuccess: () => onConnected?.() });
      }}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-token`}>{t("Token Flex Web Service")}</Label>
          <Input id={`${id}-token`} name="token" type="password" autoComplete="off" spellCheck={false} inputMode="numeric" required minLength={10} maxLength={64} pattern="[A-Za-z0-9]+" disabled={disabled || connect.isPending} className={FIELD_CLASS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-query`}>{t("Query ID")}</Label>
          <Input id={`${id}-query`} name="queryId" autoComplete="off" inputMode="numeric" required maxLength={12} pattern="[0-9]+" disabled={disabled || connect.isPending} className={FIELD_CLASS} />
        </div>
        {error ? (
          <div className="flex flex-col gap-1 rounded-xl bg-neg-soft p-3 text-sm">
            <ErrorWithReport error={IBKR_FLEX_ERRORS[error.reason] ?? IBKR_FLEX_ERRORS.internal} area="collega_banca" />
            {error.sections.length ? <p className="text-text-2">{t("Sezioni mancanti: {0}", { 0: error.sections.join(", ") })}</p> : null}
          </div>
        ) : null}
        <Button type="submit" className="h-11" disabled={disabled || connect.isPending}>
          {connect.isPending ? <><Loader2Icon className="size-4 animate-spin" aria-hidden="true" />{t("Controllo con Interactive Brokers…")}</> : t(submitLabel)}
        </Button>
        {connect.isPending ? <p className="text-center text-xs text-muted-foreground" role="status">{t("Interactive Brokers prepara un rendiconto di prova: può volerci fino a un minuto.")}</p> : null}
      </form>
    </div>
  );
}
