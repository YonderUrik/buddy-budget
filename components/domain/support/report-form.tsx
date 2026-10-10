"use client";

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
  type ReportKind,
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
}

async function postReport(body: { kind: ReportKind; message: string; context?: ReportContext }): Promise<{ reference: string }> {
  const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as { reference?: string; error?: string } | null;
  if (!res.ok || !data?.reference) throw new Error(data?.error ?? "Non siamo riusciti a inviare la segnalazione.");
  return { reference: data.reference };
}

export function ReportForm({ context, initialKind = "problema" }: ReportFormProps) {
  const [kind, setKind] = React.useState<ReportKind>(initialKind);
  const [message, setMessage] = React.useState("");
  const [withContext, setWithContext] = React.useState(true);
  const mutation = useMutation({
    mutationFn: postReport,
    onSuccess: () => {
      track("support_report_sent", { kind, withContext });
      setMessage("");
    },
  });

  const tooShort = message.trim().length < REPORT_MESSAGE_MIN_LENGTH;

  if (mutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-pos-soft p-4 text-sm">
        <p className="font-medium text-foreground">Grazie, abbiamo ricevuto la segnalazione.</p>
        <p className="text-muted-foreground">
          Codice di riferimento <span className="font-mono text-foreground">{mutation.data.reference}</span>. Ti rispondiamo via email.
        </p>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => mutation.reset()}>
          Scrivi un&apos;altra segnalazione
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (tooShort || mutation.isPending) return;
        mutation.mutate({ kind, message: message.trim(), context: withContext ? context : undefined });
      }}
    >
      <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} ariaLabel="Di cosa si tratta" stretch />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="support-message" className="text-sm font-medium text-foreground">
          Racconta
        </label>
        <Textarea
          id="support-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={REPORT_MESSAGE_MAX_LENGTH}
          placeholder={PLACEHOLDERS[kind]}
          className="min-h-28"
          aria-describedby="support-message-hint"
        />
        <p id="support-message-hint" className="text-xs text-muted-foreground">
          Non scrivere IBAN, password o altri dati sensibili: non servono. Useremo la tua email solo per risponderti.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={withContext} onChange={(event) => setWithContext(event.target.checked)} className="mt-1 size-4" />
        <span>
          Allega il contesto tecnico:{" "}
          <span className="text-foreground">
            pagina {context.path}, versione {context.version}, schermo {context.viewport}, tema {context.theme}
          </span>
          . Nessun dato finanziario.
        </span>
      </label>
      {mutation.isError && (
        <p role="alert" className="text-sm text-neg">
          {mutation.error.message} Puoi anche scrivere a {SUPPORT_EMAIL}.
        </p>
      )}
      <Button type="submit" disabled={tooShort || mutation.isPending} className="w-full sm:w-fit">
        {mutation.isPending ? "Invio…" : "Invia"}
      </Button>
    </form>
  );
}
