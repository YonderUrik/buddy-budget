/**
 * Dominio del sito di un esercente scritto nel testo del movimento («NETFLIX.COM», «WWW.HETZNER.DE», «help.uber.com»).
 * Il dominio identifica il marchio senza ambiguità, quindi è la fonte di logo più sicura dopo il dizionario.
 */

/** Domini finali accettati: i più comuni nei movimenti italiani ed europei. Un elenco chiuso evita falsi positivi. */
const TLDS = [
  "com", "it", "eu", "net", "org", "io", "co", "app", "shop", "store", "tv", "me", "ai",
  "de", "fr", "es", "nl", "be", "at", "ch", "uk", "ie", "pt", "se", "dk", "no", "fi", "pl", "lu", "us", "ca", "au",
];

/** Secondi livelli dei domini a tre parti (amazon.co.uk, ebay.com.au): si tengono anche loro. */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov"]);

const DOMAIN_PATTERN = new RegExp(
  `(?:^|[^a-z0-9.-])(?:https?://)?(?:www\\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLDS.join("|")}))(?![a-z0-9-])`,
  "g"
);

/**
 * Intermediari di pagamento e servizi che compaiono nel testo al posto dell'esercente: il loro logo sarebbe sbagliato.
 */
const INTERMEDIARY_DOMAINS = new Set([
  "paypal.com", "paypal.it", "paypal.me", "sumup.com", "sumup.it", "stripe.com", "adyen.com", "nexi.it", "klarna.com",
  "scalapay.com", "worldline.com", "mollie.com", "paddle.com", "paddle.net", "fastspring.com", "2checkout.com",
  "satispay.com", "zettle.com", "squareup.com",
]);

/** Dominio registrabile: senza sottodomini (help.uber.com → uber.com), tre parti per i domini come amazon.co.uk. */
export function registrableDomain(host: string): string | null {
  const labels = host.toLowerCase().split(".").filter((label) => label.length > 0);
  if (labels.length < 2) return null;
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const parts = tld.length === 2 && SECOND_LEVEL.has(second) && labels.length >= 3 ? 3 : 2;
  const name = labels[labels.length - parts];
  // Il nome del sito ha almeno due caratteri e una lettera: «12.it» o «a.com» non sono esercenti.
  if (name.length < 2 || !/[a-z]/.test(name)) return null;
  return labels.slice(-parts).join(".");
}

/** Vero per gli intermediari di pagamento, il cui dominio non dice chi è l'esercente. */
export function isIntermediaryDomain(domain: string): boolean {
  return INTERMEDIARY_DOMAINS.has(domain);
}

/** Primo dominio di un esercente scritto nel testo, se c'è e non è un intermediario; altrimenti null. */
export function domainFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const match of text.toLowerCase().matchAll(DOMAIN_PATTERN)) {
    const domain = registrableDomain(match[1]);
    if (domain && !isIntermediaryDomain(domain)) return domain;
  }
  return null;
}
