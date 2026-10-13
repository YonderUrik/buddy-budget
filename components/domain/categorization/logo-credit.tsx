/** Cita Logo.dev sotto un elenco che ha mostrato almeno un logo remoto (condizione del piano gratuito). */

import { cn } from "@/lib/utils";

/** Pagina del servizio dei loghi. */
const LOGO_SERVICE_URL = "https://logo.dev";

export interface LogoCreditProps {
  /** Mostra la citazione: vero dopo che è comparso almeno un logo remoto. */
  visible: boolean;
  className?: string;
}

export function LogoCredit({ visible, className }: LogoCreditProps) {
  if (!visible) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Loghi forniti da{" "}
      <a href={LOGO_SERVICE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        Logo.dev
      </a>
    </p>
  );
}
