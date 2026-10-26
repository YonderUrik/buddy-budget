import { extractMerchantName } from "./extract";

/**
 * Dominio del sito di ogni marchio del dizionario degli esercenti (`aliases.ts`, stessi nomi): il logo si chiede a
 * Logo.dev per **dominio**, che identifica il marchio senza ambiguità. Mai per nome: la ricerca per nome può restituire
 * il logo di un'azienda omonima, e per un negozio piccolo un logo sbagliato è peggio dell'iniziale. Le voci generiche
 * del dizionario (prelievi, bollo, farmacia, parcheggio...) non hanno un marchio e non stanno qui.
 */
export const MERCHANT_LOGO_DOMAINS: Readonly<Record<string, string>> = {
  INPS: "inps.it",
  "Agenzia delle Entrate": "agenziaentrate.gov.it",
  "Amazon Prime": "amazon.com",
  Amazon: "amazon.com",
  Netflix: "netflix.com",
  Spotify: "spotify.com",
  "Disney+": "disneyplus.com",
  DAZN: "dazn.com",
  Apple: "apple.com",
  "Google / YouTube": "youtube.com",
  Google: "google.com",
  Microsoft: "microsoft.com",
  OpenAI: "openai.com",
  Claude: "claude.ai",
  NOW: "nowtv.it",
  Adobe: "adobe.com",
  Dropbox: "dropbox.com",
  PlayStation: "playstation.com",
  Steam: "steampowered.com",
  Nintendo: "nintendo.com",
  eBay: "ebay.com",
  Zalando: "zalando.com",
  Shein: "shein.com",
  AliExpress: "aliexpress.com",
  Vinted: "vinted.com",
  Subito: "subito.it",
  Satispay: "satispay.com",
  Revolut: "revolut.com",
  "Poste Italiane": "poste.it",
  "Just Eat": "justeat.it",
  Glovo: "glovoapp.com",
  Deliveroo: "deliveroo.it",
  "Uber Eats": "ubereats.com",
  "McDonald's": "mcdonalds.com",
  "Burger King": "burgerking.it",
  Starbucks: "starbucks.com",
  Autogrill: "autogrill.com",
  Grom: "grom.it",
  Esselunga: "esselunga.it",
  Conad: "conad.it",
  Coop: "e-coop.it",
  Carrefour: "carrefour.it",
  Lidl: "lidl.it",
  Eurospin: "eurospin.it",
  MD: "mdspa.it",
  Pam: "pampanorama.it",
  Despar: "despar.it",
  Aldi: "aldi.it",
  "NaturaSì": "naturasi.it",
  IKEA: "ikea.com",
  "Leroy Merlin": "leroymerlin.it",
  Decathlon: "decathlon.it",
  MediaWorld: "mediaworld.it",
  Unieuro: "unieuro.it",
  Sephora: "sephora.it",
  Douglas: "douglas.it",
  "H&M": "hm.com",
  Zara: "zara.com",
  OVS: "ovs.it",
  Tiger: "flyingtiger.com",
  Trenitalia: "trenitalia.com",
  Italo: "italotreno.com",
  FlixBus: "flixbus.it",
  Telepass: "telepass.com",
  Autostrade: "autostrade.it",
  Ryanair: "ryanair.com",
  easyJet: "easyjet.com",
  "Wizz Air": "wizzair.com",
  "ITA Airways": "ita-airways.com",
  "Booking.com": "booking.com",
  Airbnb: "airbnb.com",
  Uber: "uber.com",
  FreeNow: "free-now.com",
  Eni: "eni.com",
  Q8: "q8.it",
  Tamoil: "tamoil.it",
  Enel: "enel.it",
  Edison: "edison.it",
  A2A: "a2a.eu",
  Hera: "gruppohera.it",
  Iren: "irenlucegas.it",
  Sorgenia: "sorgenia.it",
  Acea: "acea.it",
  Plenitude: "eniplenitude.com",
  TIM: "tim.it",
  Vodafone: "vodafone.it",
  WindTre: "windtre.it",
  Fastweb: "fastweb.it",
  Iliad: "iliad.it",
  "Ho. Mobile": "ho-mobile.it",
  "Kena Mobile": "kenamobile.it",
  Sky: "sky.it",
  UnipolSai: "unipolsai.it",
  Generali: "generali.it",
  Allianz: "allianz.it",
  AXA: "axa.it",
  "Basic-Fit": "basic-fit.com",
  Technogym: "technogym.com",
};

const KNOWN_DOMAINS: ReadonlySet<string> = new Set(Object.values(MERCHANT_LOGO_DOMAINS));

/** Vero se il dominio è uno dei marchi noti: il server chiede a Logo.dev solo questi. */
export function isKnownMerchantLogoDomain(domain: string): boolean {
  return KNOWN_DOMAINS.has(domain);
}

/** Dominio del marchio di un movimento, se la descrizione corrisponde a un marchio noto del dizionario; altrimenti null. */
export function merchantLogoDomain(description: string): string | null {
  const { name, source } = extractMerchantName({ rawText: description });
  if (source !== "alias") return null;
  return MERCHANT_LOGO_DOMAINS[name] ?? null;
}
