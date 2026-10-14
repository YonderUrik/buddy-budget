/**
 * Dal nome di un esercente al sito del marchio, con la ricerca su Logo.dev fatta una volta per tutti gli utenti e solo per i
 * nomi visti nei movimenti di almeno `MIN_USERS_FOR_NAME_SEARCH` utenti: un nome che compare in tanti conti è una catena o un
 * marchio, non la bottega sotto casa o una persona.
 */

import { searchBrandDomain, type BrandSearchOutcome } from "./search";

/** Utenti diversi che devono avere l'esercente prima di cercarlo per nome. */
export const MIN_USERS_FOR_NAME_SEARCH = 3;
/** Ricerche al giorno in tutto (consumano crediti Logo.dev): oltre, si riprova il giorno dopo. */
export const NAME_SEARCH_DAILY_LIMIT = 100;
/** Un sito trovato vale un mese; un nome senza risultato si ricerca dopo una settimana. */
export const NAME_DOMAIN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const NAME_MISS_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Quanto si ricorda che un utente ha un esercente (per contare gli utenti diversi). */
export const NAME_PRESENCE_TTL_SECONDS = 180 * 24 * 60 * 60;

export interface MerchantNameStore {
  /** `undefined` = mai cercato, `null` = cercato senza risultato. */
  getDomain(name: string): Promise<string | null | undefined>;
  setDomain(name: string, domain: string | null, ttlSeconds: number): Promise<void>;
  /** Segna che l'utente (impronta) ha questi esercenti; conta gli utenti diversi senza salvarne l'elenco. */
  addPresence(names: readonly string[], userHash: string): Promise<void>;
  countUsers(name: string): Promise<number>;
  /** Consuma una ricerca dal budget del giorno; false se è finito. */
  takeSearchBudget(day: string, limit: number): Promise<boolean>;
}

/** `cached`: dalla cache; `searched`: chiesto ora al servizio; `skipped`: non cercato (pochi utenti, budget, chiave). */
export type NameDomainResult =
  | { status: "cached"; domain: string | null }
  | { status: "searched"; search: BrandSearchOutcome }
  | { status: "skipped"; reason: "disabled" | "few_users" | "budget" };

/** Sito del marchio per un nome, dalla cache o cercandolo se il nome è abbastanza diffuso. Non lancia per errori del servizio. */
export async function resolveNameDomain(
  name: string,
  deps: { store: MerchantNameStore; secretKey: string | undefined; now?: Date; fetchFn?: typeof fetch }
): Promise<NameDomainResult> {
  const cached = await deps.store.getDomain(name);
  if (cached !== undefined) return { status: "cached", domain: cached };
  if (!deps.secretKey) return { status: "skipped", reason: "disabled" };
  if ((await deps.store.countUsers(name)) < MIN_USERS_FOR_NAME_SEARCH) return { status: "skipped", reason: "few_users" };
  const day = (deps.now ?? new Date()).toISOString().slice(0, 10);
  if (!(await deps.store.takeSearchBudget(day, NAME_SEARCH_DAILY_LIMIT))) return { status: "skipped", reason: "budget" };

  const search = await searchBrandDomain(name, { secretKey: deps.secretKey, fetchFn: deps.fetchFn });
  if (search.outcome === "found") await deps.store.setDomain(name, search.domain, NAME_DOMAIN_TTL_SECONDS);
  if (search.outcome === "none") await deps.store.setDomain(name, null, NAME_MISS_TTL_SECONDS);
  return { status: "searched", search };
}

/** Sito trovato, se c'è, da un risultato di `resolveNameDomain`. */
export function domainOf(result: NameDomainResult): string | null {
  if (result.status === "cached") return result.domain;
  if (result.status === "searched" && result.search.outcome === "found") return result.search.domain;
  return null;
}
