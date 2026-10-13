"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Form «Scrivici»: tipo, messaggio e contesto tecnico visibile (si può togliere). Per le idee propone anche GitHub. */

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import {
  REPORT_KINDS,
  REPORT_KIND_LABELS,
  REPORT_MESSAGE_MAX_LENGTH,
  REPORT_MESSAGE_MIN_LENGTH,
  SUPPORT_EMAIL,
  type ReportContext,
  type ReportError,
  type ReportInput,
  type ReportKind,
  type ReportSource,
} from "@/lib/support";

const KIND_OPTIONS = REPORT_KINDS.map((value) => ({ value, label: REPORT_KIND_LABELS[value] }));

const PLACEHOLDERS: Record<ReportKind, string> = {
  problema: "Cosa è successo e cosa ti aspettavi? Se puoi, i passi per rivederlo.",
  domanda: "Cosa vuoi sapere?",
  idea: "Cosa ti piacerebbe poter fare?",
};

export interface ReportFormProps {
  context: ReportContext;
  /** Tipo selezionato all'apertura (es. dal link «Ho un'idea»). */
  initialKind?: ReportKind;
  /** Versione per il foglio rapido: niente etichetta, area di testo più bassa. */
  compact?: boolean;
  /** Da dove parte la segnalazione (per log e Umami). Default: la pagina Aiuto. */
  source?: ReportSource;
  /** Errore da allegare: il tipo è «problema» e la scelta del tipo sparisce. */
  error?: ReportError;
}

async function postReport(body: ReportInput): Promise<{ reference: string }> {
  const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as { reference?: string; error?: string } | null;
  if (!res.ok || !data?.reference) throw new Error(data?.error ?? "Non siamo riusciti a inviare la segnalazione.");
  return { reference: data.reference };
}

export function ReportForm({ context, initialKind = "problema", compact = false, source = "pagina", error }: ReportFormProps) {
  const { t: tr } = useLocalization();
  const [kind, setKind] = React.useState<ReportKind>(error ? "problema" : initialKind);
  const [message, setMessage] = React.useState("");
  const [withContext, setWithContext] = React.useState(true);
  const mutation = useMutation({
    mutationFn: postReport,
    onSuccess: () => {
      track("support_report_sent", { kind, withContext, source, area: error?.area });
      setMessage("");
    },
  });

  const tooShort = message.trim().length < REPORT_MESSAGE_MIN_LENGTH;

  if (mutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-pos-soft p-4 text-sm">
        <p className="font-medium text-foreground">{tr("Grazie, abbiamo ricevuto la segnalazione.")}</p>
        <p className="text-muted-foreground">{tr("Codice di riferimento")}{" "}<span className="font-mono text-foreground">{mutation.data.reference}</span>{tr(". Ti rispondiamo via email.")}</p>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => mutation.reset()}>{tr("Scrivi un'altra segnalazione")}</Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (tooShort || mutation.isPending) return;
        mutation.mutate({ kind, message: message.trim(), context: withContext ? context : undefined, source, error });
      }}
    >
      {error ? null : <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} ariaLabel={tr("Di cosa si tratta")} stretch />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="support-message" className={compact ? "sr-only" : "text-sm font-medium text-foreground"}>{tr("Racconta")}</label>
        <Textarea
          id="support-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={REPORT_MESSAGE_MAX_LENGTH}
          placeholder={PLACEHOLDERS[kind]}
          className={compact ? "min-h-24" : "min-h-28"}
          aria-describedby="support-message-hint"
        />
        <p id="support-message-hint" className="text-xs text-muted-foreground">{tr("Non scrivere IBAN, password o altri dati sensibili: non servono. Useremo la tua email solo per risponderti.")}</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={withContext} onChange={(event) => setWithContext(event.target.checked)} className="mt-1 size-4" />
        <span>{tr("Allega il contesto tecnico:")}{" "}
          <span className="text-foreground">{tr("pagina")}{" "}{context.path}{tr(", versione")}{" "}{context.version}{tr(", schermo")}{" "}{context.viewport}{tr(", tema")}{" "}{context.theme}
          </span>{tr(". Nessun dato finanziario.")}</span>
      </label>
      {mutation.isError && (
        <p role="alert" className="text-sm text-neg">
          {tr(mutation.error.message)}{" "}{tr("Puoi anche scrivere a")}{" "}{SUPPORT_EMAIL}.
        </p>
      )}
      <Button type="submit" disabled={tooShort || mutation.isPending} className="w-full sm:w-fit">
        {mutation.isPending ? tr("Invio…") : tr("Invia")}
      </Button>
    </form>
  );
}
