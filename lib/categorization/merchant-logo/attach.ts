import "server-only";
import { hashUserId, logger } from "@/lib/observability";
import { redisMerchantNameStore } from "./redis-store";
import { resolveMerchantLogo, type MerchantLogoInput } from "./resolve";
import { merchantLogoPath } from "./sign";
import type { MerchantNameStore } from "./name-domain";

/**
 * Aggiunge `logoPath` a ogni gruppo (dizionario, sito nel movimento o nome da cercare) e segna, per contare gli utenti
 * diversi, gli esercenti che l'utente ha fra quelli cercabili per nome. Un guasto di Redis non toglie i gruppi: si perde
 * solo il conteggio.
 */
export async function withMerchantLogos<T>(
  groups: readonly T[],
  inputOf: (group: T) => MerchantLogoInput,
  userId: string,
  store: MerchantNameStore = redisMerchantNameStore
): Promise<(T & { logoPath: string | null })[]> {
  const names = new Set<string>();
  const result = groups.map((group) => {
    const ref = resolveMerchantLogo(inputOf(group));
    if (ref?.kind === "name") names.add(ref.name);
    return { ...group, logoPath: ref ? merchantLogoPath(ref) : null };
  });
  if (names.size > 0) {
    try {
      await store.addPresence([...names], hashUserId(userId));
    } catch (error) {
      logger.warn("merchant.logo.presence_failed", { user: hashUserId(userId), error });
    }
  }
  return result;
}
