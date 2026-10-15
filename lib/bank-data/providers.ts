import "server-only";
import { enableBankingProvider } from "./enablebanking/adapter";
import { goCardlessProvider } from "./gocardless/adapter";
import type { BankDataProvider, BankProviderId } from "./provider";

const PROVIDERS: Record<BankProviderId, BankDataProvider> = {
  gocardless: goCardlessProvider,
  enablebanking: enableBankingProvider,
};

/** Il fornitore di una connessione (colonna `provider`): sync, rinnovi e revoca passano sempre dal suo. */
export function getBankProvider(id: BankProviderId): BankDataProvider {
  return PROVIDERS[id];
}

/**
 * Fornitore per i collegamenti nuovi e i rinnovi. `BANK_DATA_PROVIDER` decide; se manca si usa GoCardless se
 * configurato, altrimenti Enable Banking (un self-hoster con le sole chiavi Enable Banking non deve impostare altro).
 * Le connessioni già attive restano sul loro fornitore finché l'utente non rinnova: è così che si passa dall'uno all'altro.
 */
export function providerForNewConnections(env: Record<string, string | undefined> = process.env): BankProviderId {
  const chosen = env.BANK_DATA_PROVIDER?.trim();
  if (chosen === "gocardless" || chosen === "enablebanking") return chosen;
  if (env.GOCARDLESS_SECRET_ID && env.GOCARDLESS_SECRET_KEY) return "gocardless";
  if (env.ENABLE_BANKING_APP_ID && env.ENABLE_BANKING_PRIVATE_KEY) return "enablebanking";
  return "gocardless";
}
