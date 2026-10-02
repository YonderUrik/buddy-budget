import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { describeRenewalAlert, type RenewalAlert } from "./renewal-alerts";

export interface RenewalBannerProps {
  alerts: RenewalAlert[];
  /** Chiamato dal pulsante "Rinnova" (apre il flusso di riconnessione). Ignorato se c'è `renewHref`. */
  onRenew?: () => void;
  /** Se presente, "Rinnova" è un link verso la pagina che ospita il flusso (es. dalla Panoramica). */
  renewHref?: string;
  /** Etichetta del pulsante. */
  renewLabel?: string;
}

/** Avviso in cima a Conti quando un collegamento bancario scade a breve o non funziona più. Non rende nulla se non serve. */
export function RenewalBanner({ alerts, onRenew, renewHref, renewLabel = "Rinnova" }: RenewalBannerProps) {
  if (alerts.length === 0) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 sm:p-4">
      <AlertTriangle size={18} className="shrink-0 text-destructive" aria-hidden />
      <ul className="min-w-0 flex-1 space-y-0.5 text-sm text-foreground">
        {alerts.map((alert) => (
          <li key={alert.connectionId}>{describeRenewalAlert(alert)}</li>
        ))}
      </ul>
      {renewHref ? (
        <Link href={renewHref} className={buttonVariants({ size: "sm" })}>
          {renewLabel}
        </Link>
      ) : (
        <Button size="sm" className="cursor-pointer" onClick={onRenew}>
          {renewLabel}
        </Button>
      )}
    </div>
  );
}
