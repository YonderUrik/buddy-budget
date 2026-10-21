"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCESS_CODE_MAX_LENGTH } from "@/lib/billing";
import { useLocalization } from "@/lib/localization/provider";

export interface AccessCodeFormProps {
  pending: boolean;
  error?: string | null;
  onRedeem: (code: string) => void;
}

/** «Hai un codice?»: a field that opens on demand to redeem an access code from the owner (free Pro). */
export function AccessCodeForm({ pending, error, onRedeem }: AccessCodeFormProps) {
  const { t: tr } = useLocalization();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const inputId = React.useId();
  if (!open) {
    return (
      <Button type="button" variant="link" className="w-fit px-0" onClick={() => setOpen(true)}>
        {tr("Hai un codice?")}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim()) onRedeem(code.trim());
      }}
    >
      <Label htmlFor={inputId}>{tr("Codice di attivazione")}</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={ACCESS_CODE_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="BB-XXXX-XXXX"
          className="max-w-56 uppercase"
        />
        <Button type="submit" variant="outline" className="rounded-full" disabled={pending || !code.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {tr("Usa codice")}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-neg">{error}</p> : null}
    </form>
  );
}
