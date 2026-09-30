"use client";

/**
 * Dialog delle impostazioni di uno strumento, solo per te: aliquota (automatica, 26% o 12,5%), ETF/fondo armonizzato
 * e, per le obbligazioni, tasso, frequenza e scadenza delle cedole (servono a prevederle e a proporle da registrare).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isFund } from "@/lib/calc/taxes";
import { COUPON_FREQUENCIES, type CouponFrequency, type Instrument } from "@/lib/db/schema/investments";
import { resolveTaxSettings, type InstrumentSettingInput } from "@/lib/investments/tax-settings";
import { useUpdateInstrumentSettingsMutation } from "@/lib/queries/investments";
import { parseAmount } from "@/lib/validation/accounts";
import { OperationFormField as Field } from "../operation-form-field";
import { formatPct } from "../percent";

const AUTO = "auto";
const RATE_LABELS: Record<string, string> = { "0.26": "26% (ordinaria)", "0.125": "12,5% (titoli di Stato)" };
const HARMONIZED_LABELS: Record<string, string> = { true: "Sì (UCITS)", false: "No" };
const FREQUENCY_LABELS: Record<CouponFrequency, string> = { 1: "Annuale", 2: "Semestrale", 4: "Trimestrale" };

export interface InstrumentSettingsDialogProps {
  /** Strumento da modificare; null chiude il dialog. */
  instrument: Instrument | null;
  setting: InstrumentSettingInput | undefined;
  onClose: () => void;
}

export function InstrumentSettingsDialog({ instrument, setting, onClose }: InstrumentSettingsDialogProps) {
  return (
    <Dialog open={instrument !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {instrument ? <SettingsForm key={instrument.id} instrument={instrument} setting={setting} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({
  instrument,
  setting,
  onClose,
}: {
  instrument: Instrument;
  setting: InstrumentSettingInput | undefined;
  onClose: () => void;
}) {
  const id = React.useId();
  const save = useUpdateInstrumentSettingsMutation();
  const isBond = instrument.type === "obbligazione";
  const [rate, setRate] = React.useState(setting?.taxRate ? String(Number(setting.taxRate)) : AUTO);
  const [harmonized, setHarmonized] = React.useState(setting?.taxHarmonized == null ? AUTO : String(setting.taxHarmonized));
  const [couponRate, setCouponRate] = React.useState(setting?.couponRate ? String(Number(setting.couponRate) * 100).replace(".", ",") : "");
  const [frequency, setFrequency] = React.useState<string>(String(setting?.couponFrequency ?? 2));
  const [maturity, setMaturity] = React.useState(setting?.maturityDate ?? "");
  const [error, setError] = React.useState<string | null>(null);
  // Il valore "automatico" è quello senza la correzione dell'utente.
  const automatic = resolveTaxSettings(instrument, undefined);
  const autoRateLabel = `Automatica (${formatPct(automatic.taxRate)})`;
  const autoHarmonizedLabel = `Automatico (${automatic.harmonized ? "sì" : "no"})`;

  function submit(values: Parameters<typeof save.mutate>[0]) {
    setError(null);
    save.mutate(values, { onSuccess: onClose, onError: (e) => setError(e.message) });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const couponPercent = couponRate.trim() ? parseAmount(couponRate) : null;
    const hasCoupons = isBond && (couponPercent !== null || maturity !== "");
    if (hasCoupons && (!couponPercent || !maturity)) return setError("Per le cedole servono tasso e scadenza");
    submit({
      instrumentId: instrument.id,
      taxRate: rate === AUTO ? null : (rate as "0.26" | "0.125"),
      taxHarmonized: harmonized === AUTO ? null : harmonized === "true",
      couponRate: hasCoupons ? couponPercent! / 100 : null,
      couponFrequency: hasCoupons ? Number(frequency) : null,
      maturityDate: hasCoupons ? maturity : null,
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{instrument.name}</DialogTitle>
        <DialogDescription>Valgono solo per te: servono a stimare tasse e proventi.</DialogDescription>
      </DialogHeader>
      <Field label="Aliquota">
        <Select value={rate} onValueChange={(v) => v && setRate(v)}>
          <SelectTrigger className="w-full" aria-label="Aliquota">
            <SelectValue>{(v: string | null) => (v === AUTO || !v ? autoRateLabel : RATE_LABELS[v])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{autoRateLabel}</SelectItem>
            <SelectItem value="0.26">{RATE_LABELS["0.26"]}</SelectItem>
            <SelectItem value="0.125">{RATE_LABELS["0.125"]}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {isFund(instrument.type) ? (
        <Field label="Armonizzato UE">
          <Select value={harmonized} onValueChange={(v) => v && setHarmonized(v)}>
            <SelectTrigger className="w-full" aria-label="Armonizzato UE">
              <SelectValue>{(v: string | null) => (v === AUTO || !v ? autoHarmonizedLabel : HARMONIZED_LABELS[v])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>{autoHarmonizedLabel}</SelectItem>
              <SelectItem value="true">{HARMONIZED_LABELS.true}</SelectItem>
              <SelectItem value="false">{HARMONIZED_LABELS.false}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {isBond ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Cedole</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tasso annuo lordo (%)" htmlFor={`${id}-rate`}>
              <Input id={`${id}-rate`} inputMode="decimal" value={couponRate} onChange={(e) => setCouponRate(e.target.value)} placeholder="Es. 3,85" />
            </Field>
            <Field label="Frequenza">
              <Select value={frequency} onValueChange={(v) => v && setFrequency(v)}>
                <SelectTrigger className="w-full" aria-label="Frequenza delle cedole">
                  <SelectValue>{(v: string | null) => (v ? FREQUENCY_LABELS[Number(v) as CouponFrequency] : "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COUPON_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Scadenza" htmlFor={`${id}-maturity`}>
            <Input id={`${id}-maturity`} type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">Le date delle cedole si contano a ritroso dalla scadenza.</p>
        </fieldset>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={save.isPending || !setting}
          onClick={() => submit({ instrumentId: instrument.id, taxRate: null, taxHarmonized: null, couponRate: null, couponFrequency: null, maturityDate: null })}
        >
          Torna all&apos;automatico
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </form>
  );
}
