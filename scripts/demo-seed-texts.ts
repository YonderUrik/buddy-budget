/**
 * Texts of the landing demo data (`demo-seed.ts`) in every interface language. The seed is written in Italian and
 * passes every user-facing string through `demoText`, so each language gets plausible names: account and merchant
 * names, raw bank descriptions, securities, goals and debts. Amounts and dates are the same in every language.
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
  "Luce e gas": ["Electricity and gas", "Strom und Gas"],
  "SDD ENERGIA PIU SPA FATT 2291": ["DIRECT DEBIT ENERGIA PIU INV 2291", "LASTSCHRIFT STADTWERKE ENERGIE RG 2291"],
  "Fibra e mobile": ["Broadband and mobile", "Internet und Handy"],
  "ADDEBITO TELCO SRL CANONE": ["DIRECT DEBIT TELCO LTD MONTHLY FEE", "LASTSCHRIFT TELCO GMBH GRUNDGEBUEHR"],
  "Supermercato": ["Supermarket", "Supermarkt"],
  "PAGAMENTO POS SUPERMERCATO CENTRO 0412": ["CARD PAYMENT SUPERMARKET CENTRE 0412", "KARTENZAHLUNG SUPERMARKT ZENTRUM 0412"],
  "Carburante": ["Fuel", "Tanken"],
  "PAGAMENTO POS STAZIONE DI SERVIZIO": ["CARD PAYMENT SERVICE STATION", "KARTENZAHLUNG TANKSTELLE"],
  "Ristorante": ["Restaurant", "Restaurant"],
  "PAGAMENTO POS TRATTORIA DA MARIO": ["CARD PAYMENT TRATTORIA DA MARIO", "KARTENZAHLUNG GASTHAUS ZUM LOEWEN"],
  "Streaming video": ["Video streaming", "Video-Streaming"],
  "PAGAMENTO ONLINE STREAMINGCO": ["ONLINE PAYMENT STREAMINGCO", "ONLINEZAHLUNG STREAMINGCO"],
  "Musica": ["Music", "Musik"],
  "PAGAMENTO ONLINE MUSICAPP": ["ONLINE PAYMENT MUSICAPP", "ONLINEZAHLUNG MUSICAPP"],
  "Palestra": ["Gym", "Fitnessstudio"],
  "ADDEBITO SDD FITNESS CLUB": ["DIRECT DEBIT FITNESS CLUB", "LASTSCHRIFT FITNESS CLUB"],
  "Acquisto online": ["Online purchase", "Online-Einkauf"],
  "PAGAMENTO ONLINE MARKETPLACE": ["ONLINE PAYMENT MARKETPLACE", "ONLINEZAHLUNG MARKETPLACE"],
  "Negozio abbigliamento": ["Clothing store", "Modegeschäft"],
  "PAGAMENTO POS MODA STORE": ["CARD PAYMENT MODA STORE", "KARTENZAHLUNG MODE STORE"],
  "Farmacia": ["Pharmacy", "Apotheke"],
  "PAGAMENTO POS FARMACIA COMUNALE": ["CARD PAYMENT CITY PHARMACY", "KARTENZAHLUNG STADT-APOTHEKE"],
  "Viaggio": ["Trip", "Reise"],
  "PAGAMENTO ONLINE AGENZIA VIAGGI": ["ONLINE PAYMENT TRAVEL AGENCY", "ONLINEZAHLUNG REISEBUERO"],
  "Stipendio": ["Salary", "Gehalt"],
  "BONIFICO A VOSTRO FAVORE ACME SRL STIPENDIO": ["CREDIT TRANSFER ACME LTD SALARY", "GUTSCHRIFT ACME GMBH GEHALT"],
  "Consulenza": ["Consulting", "Beratung"],
  "BONIFICO FATT 12/26": ["CREDIT TRANSFER INV 12/26", "GUTSCHRIFT RG 12/26"],
  "Archivio cloud": ["Cloud storage", "Cloud-Speicher"],
  "PAGAMENTO ONLINE CLOUDBOX STORAGE": ["ONLINE PAYMENT CLOUDBOX STORAGE", "ONLINEZAHLUNG CLOUDBOX STORAGE"],
  "Giornale online": ["Online newspaper", "Online-Zeitung"],
  "PAGAMENTO ONLINE IL QUOTIDIANO DIGITALE": ["ONLINE PAYMENT THE DIGITAL DAILY", "ONLINEZAHLUNG DIE DIGITALE ZEITUNG"],
  "Assicurazione auto": ["Car insurance", "Kfz-Versicherung"],
  "ADDEBITO SDD ASSICURAZIONI SICURA RCA": ["DIRECT DEBIT SICURA MOTOR INSURANCE", "LASTSCHRIFT SICHER VERSICHERUNG KFZ"],
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
  "ETF Azionario Globale Demo": ["Global Equity ETF Demo", "Aktien Welt ETF Demo"],
  "Energia Italia S.p.A.": ["Energia Italia S.p.A.", "Energie Süd AG"],
  "BTP Valore 2030": ["BTP Valore 2030", "Bundesanleihe 2030"],
  "Tecnologia Futura S.p.A.": ["Tecnologia Futura S.p.A.", "Zukunft Technologie AG"],
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
