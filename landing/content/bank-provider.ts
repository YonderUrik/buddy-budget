/**
 * Fornitore Open Banking di cui parlano landing, pagina Sicurezza e informativa. L'app sceglie il fornitore dei
 * collegamenti nuovi con `BANK_DATA_PROVIDER` (vedi `lib/bank-data/providers.ts`); qui si dice al pubblico quale si usa.
 *
 * Va portato a true SOLO dopo il passaggio in produzione (contratto firmato con Enable Banking e
 * `BANK_DATA_PROVIDER=enablebanking` nel Secret), insieme a un nuovo `LEGAL_VERSION` perché cambia l'informativa.
 * Finché è false i testi restano quelli di GoCardless, che è ancora il fornitore in uso.
 */
export const ENABLE_BANKING_LIVE = false;

/** Giorni di consenso dei collegamenti GoCardless (`GOCARDLESS_CONSENT_DAYS` in `lib/bank-data/connection-health.ts`). */
export const GOCARDLESS_CONSENT_DAYS = 90;
/** Durata massima che chiediamo a Enable Banking (`ENABLE_BANKING_MAX_CONSENT_DAYS`): la banca può concedere meno. */
export const ENABLE_BANKING_MAX_CONSENT_DAYS = 180;

export interface BankProviderCopy {
  /** Nome breve, nelle frasi («tramite GoCardless»). */
  name: string;
  /** Chi è, con l'autorità che lo vigila, verificato nelle sue condizioni. */
  who: string;
  /** Durata del consenso, già in parole («90 giorni», «fino a 180 giorni, secondo la banca»). */
  consent: string;
  /** Giorni massimi di consenso, per le frasi «al massimo N giorni». */
  maxConsentDays: number;
  /** Etichetta breve della fonte e link alle condizioni. */
  termsLabel: string;
  termsHref: string;
}

const GOCARDLESS: BankProviderCopy = {
  name: "GoCardless",
  who: "GoCardless SAS, istituto autorizzato in Francia (ACPR, n. 17118)",
  consent: `${GOCARDLESS_CONSENT_DAYS} giorni`,
  maxConsentDays: GOCARDLESS_CONSENT_DAYS,
  termsLabel: "Condizioni GoCardless, art. 4",
  termsHref: "https://gocardless.com/legal/bank-account-data/",
};

const ENABLE_BANKING: BankProviderCopy = {
  name: "Enable Banking",
  who: "Enable Banking Oy, prestatore di servizi di informazione sui conti registrato in Finlandia e vigilato dall'autorità finanziaria finlandese (FIN-FSA)",
  consent: `fino a ${ENABLE_BANKING_MAX_CONSENT_DAYS} giorni, secondo la banca`,
  maxConsentDays: ENABLE_BANKING_MAX_CONSENT_DAYS,
  termsLabel: "Condizioni Enable Banking",
  termsHref: "https://enablebanking.com/terms",
};

/** Il fornitore dei collegamenti nuovi, come lo racconta la landing. */
export const BANK_PROVIDER: BankProviderCopy = ENABLE_BANKING_LIVE ? ENABLE_BANKING : GOCARDLESS;
