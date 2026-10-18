/**
 * Texts of the demo data (`seed.ts`, used by the landing screenshots and the public demo) in every interface language. The seed is written in Italian and
 * passes every user-facing string through `demoText`, so each language gets plausible names: account and merchant
 * names, raw bank descriptions, bonds, goals and debts (German gets German brands where Italian ones would be odd).
 * Securities carry their real names and are not translated. Amounts and dates are the same in every language.
 */
import type { Language } from "@/lib/localization/config";

/** Italian text → [English, German]. User-facing content of the demo account (Italian is the base). */
const DEMO_SEED_TEXTS: Record<string, readonly [en: string, de: string]> = {
  "Giulia Demo": ["Giulia Demo", "Julia Demo"],
  "Conto corrente": ["Current account", "Girokonto"],
  "Conto deposito": ["Savings account", "Tagesgeldkonto"],
  "Contanti": ["Cash", "Bargeld"],
  "Rata mutuo": ["Mortgage payment", "Kreditrate Haus"],
  "ADDEBITO SDD RATA MUTUO N. 4471": ["DIRECT DEBIT MORTGAGE PAYMENT NO. 4471", "LASTSCHRIFT DARLEHENSRATE NR. 4471"],
  "PAGAMENTO POS TRATTORIA DA MARIO": ["CARD PAYMENT TRATTORIA DA MARIO", "KARTENZAHLUNG GASTHAUS ZUM LOEWEN"],
  "PAGAMENTO POS FARMACIA COMUNALE": ["CARD PAYMENT CITY PHARMACY", "KARTENZAHLUNG STADT-APOTHEKE"],
  "Enel Energia": ["Enel Energia", "Stadtwerke"],
  "SDD ENEL ENERGIA FATT 2291": ["DIRECT DEBIT ENEL ENERGIA INV 2291", "LASTSCHRIFT STADTWERKE ENERGIE RG 2291"],
  "TIM": ["TIM", "Vodafone"],
  "ADDEBITO SDD TIM FIBRA E MOBILE": ["DIRECT DEBIT TIM BROADBAND AND MOBILE", "LASTSCHRIFT VODAFONE GMBH KABEL UND MOBIL"],
  "Esselunga": ["Esselunga", "Lidl"],
  "PAGAMENTO POS ESSELUNGA 0412": ["CARD PAYMENT ESSELUNGA 0412", "KARTENZAHLUNG LIDL SAGT DANKE 0412"],
  "Conad": ["Conad", "Aldi"],
  "PAGAMENTO POS CONAD 0187": ["CARD PAYMENT CONAD 0187", "KARTENZAHLUNG ALDI SUED 0187"],
  "Eni": ["Eni", "Eni"],
  "PAGAMENTO POS ENI STATION 1187": ["CARD PAYMENT ENI STATION 1187", "KARTENZAHLUNG ENI STATION 1187"],
  "Trattoria da Mario": ["Trattoria da Mario", "Gasthaus zum Löwen"],
  "Netflix": ["Netflix", "Netflix"],
  "PAGAMENTO ONLINE NETFLIX.COM": ["ONLINE PAYMENT NETFLIX.COM", "ONLINEZAHLUNG NETFLIX.COM"],
  "Spotify": ["Spotify", "Spotify"],
  "PAGAMENTO ONLINE SPOTIFY P2B71C": ["ONLINE PAYMENT SPOTIFY P2B71C", "ONLINEZAHLUNG SPOTIFY P2B71C"],
  "Palestra Olimpia": ["Olympia Gym", "Fitnessstudio Olympia"],
  "ADDEBITO SDD PALESTRA OLIMPIA": ["DIRECT DEBIT OLYMPIA GYM", "LASTSCHRIFT FITNESSSTUDIO OLYMPIA"],
  "Amazon": ["Amazon", "Amazon"],
  "PAGAMENTO ONLINE AMAZON EU SARL": ["ONLINE PAYMENT AMAZON EU SARL", "ONLINEZAHLUNG AMAZON EU SARL"],
  "Zara": ["Zara", "Zara"],
  "PAGAMENTO POS ZARA 0233": ["CARD PAYMENT ZARA 0233", "KARTENZAHLUNG ZARA 0233"],
  "Farmacia Comunale": ["City Pharmacy", "Stadt-Apotheke"],
  "Booking.com": ["Booking.com", "Booking.com"],
  "PAGAMENTO ONLINE BOOKING.COM": ["ONLINE PAYMENT BOOKING.COM", "ONLINEZAHLUNG BOOKING.COM"],
  "iCloud+": ["iCloud+", "iCloud+"],
  "PAGAMENTO ONLINE APPLE.COM/BILL": ["ONLINE PAYMENT APPLE.COM/BILL", "ONLINEZAHLUNG APPLE.COM/BILL"],
  "UnipolSai": ["UnipolSai", "Allianz"],
  "ADDEBITO SDD UNIPOLSAI RCA": ["DIRECT DEBIT UNIPOLSAI MOTOR INSURANCE", "LASTSCHRIFT ALLIANZ VERSICHERUNG KFZ"],
  "Fondo Bilanciato": ["Balanced Fund", "Mischfonds"],
  "Fondo Misto": ["Balanced Fund", "Mischfonds"],
  "Stipendio": ["Salary", "Gehalt"],
  "BONIFICO A VOSTRO FAVORE ACME SRL STIPENDIO": ["CREDIT TRANSFER ACME LTD SALARY", "GUTSCHRIFT ACME GMBH GEHALT"],
  "Consulenza": ["Consulting", "Beratung"],
  "BONIFICO FATT 12/26": ["CREDIT TRANSFER INV 12/26", "GUTSCHRIFT RG 12/26"],
  "Giornale online": ["Online newspaper", "Online-Zeitung"],
  "PAGAMENTO ONLINE IL QUOTIDIANO DIGITALE": ["ONLINE PAYMENT THE DIGITAL DAILY", "ONLINEZAHLUNG DIE DIGITALE ZEITUNG"],
  "Versamento PAC": ["ETF savings plan", "ETF-Sparplan"],
  "BONIFICO PAC ETF AZIONARIO": ["TRANSFER EQUITY ETF SAVINGS PLAN", "UEBERWEISUNG ETF-SPARPLAN AKTIEN"],
  "Bar Centrale": ["Central Café", "Café Zentral"],
  "PAGAMENTO POS BAR CENTRALE": ["CARD PAYMENT CENTRAL CAFE", "KARTENZAHLUNG CAFE ZENTRAL"],
  "Libreria del Corso": ["High Street Books", "Buchhandlung am Markt"],
  "PAGAMENTO POS LIBRERIA DEL CORSO": ["CARD PAYMENT HIGH STREET BOOKS", "KARTENZAHLUNG BUCHHANDLUNG AM MARKT"],
  "Ferramenta Rossi": ["Rossi Hardware", "Eisenwaren Schmidt"],
  "PAGAMENTO POS FERRAMENTA ROSSI": ["CARD PAYMENT ROSSI HARDWARE", "KARTENZAHLUNG EISENWAREN SCHMIDT"],
  "Ottica Vista": ["Vista Opticians", "Optik Vista"],
  "PAGAMENTO POS OTTICA VISTA": ["CARD PAYMENT VISTA OPTICIANS", "KARTENZAHLUNG OPTIK VISTA"],
  "Bonifico a favore di Luca": ["Transfer to Luca", "Überweisung an Lukas"],
  "BONIFICO A FAVORE DI LUCA R": ["TRANSFER TO LUCA R", "UEBERWEISUNG AN LUKAS R"],
  "Giroconto al conto deposito": ["Transfer to savings account", "Übertrag aufs Tagesgeldkonto"],
  "Portafoglio principale": ["Main portfolio", "Hauptdepot"],
  "BTP Valore 2030": ["BTP Valore 2030", "Bundesanleihe 2030"],
  "Bund tedesco 2030": ["German Bund 2030", "Bundesanleihe 2030"],
  "BOT 12 mesi": ["BOT 12-month bill", "BOT 12 Monate"],
  "Titolo di Stato tedesco 12 mesi": ["German 12-month bill", "Bubill 12 Monate"],
  "Interactive Brokers · liquidità": ["Interactive Brokers · cash", "Interactive Brokers · Guthaben"],
  "Trade Republic · liquidità": ["Trade Republic · cash", "Trade Republic · Guthaben"],
  "Minusvalenze dal broker precedente": ["Losses from the previous broker", "Verluste vom vorherigen Broker"],
  "Fondo di emergenza": ["Emergency fund", "Notgroschen"],
  "Viaggio in Giappone": ["Trip to Japan", "Reise nach Japan"],
  "Anticipo casa": ["House deposit", "Eigenkapital fürs Haus"],
  "Mutuo casa": ["Home mortgage", "Baufinanzierung"],
  "Prestito auto": ["Car loan", "Autokredit"],
  "Cucina e lavatrice": ["Kitchen and washing machine", "Küche und Waschmaschine"],
  "Piano pensione": ["Pension plan", "Altersvorsorge"],
};

/** The demo text in `language`, or null when `source` is not a demo text (the screenshot capture also uses it). */
export function findDemoText(source: string, language: Language): string | null {
  if (language === "it") return source;
  const entry = DEMO_SEED_TEXTS[source];
  return entry ? entry[language === "en" ? 0 : 1] : null;
}

/** The demo text in `language`; throws on a string without a translation, so a new demo text cannot stay Italian. */
export function demoText(source: string, language: Language): string {
  const text = findDemoText(source, language);
  if (text === null) throw new Error(`Demo text without a translation: ${source}`);
  return text;
}
