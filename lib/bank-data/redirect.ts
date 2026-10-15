import { getAppUrl } from "@/lib/env";

/** URL a cui GoCardless rimanda dopo il consenso. Salvato su ogni requisition: la pulizia lo usa per riconoscere le nostre. */
export function gocardlessRedirectUrl(): string {
  return `${getAppUrl()}/api/gocardless/callback`;
}

/** URL a cui Enable Banking rimanda dopo il consenso: va registrato tra i «redirect URL» dell'applicazione. */
export function bankCallbackUrl(): string {
  return `${getAppUrl()}/api/bank/callback`;
}
