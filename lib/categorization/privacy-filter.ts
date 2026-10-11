import { extractMerchantName } from "./merchant-name";

export type BlockReason = "operazione" | "persona";

export interface PreparedMerchant {
  /** Nome pulito, l'unico testo del movimento che può lasciare il server. */
  name: string;
  /** Se presente, il movimento non va inviato a un servizio esterno. */
  blocked: BlockReason | null;
}

/** Operazioni che non descrivono un esercente: trasferimenti, prelievi, imposte, stipendi. */
const NON_MERCHANT = /\b(bonifico|giroconto|giro conto|trasferimento|ricarica|prelievo|prelevamento|bollo|f24|stipendio|versamento)\b/i;

/** Parole tipiche di un'attività: un nome che le contiene non è trattato come persona. */
const BUSINESS_WORDS = new Set([
  "srl", "srls", "snc", "sas", "spa", "sa", "ltd", "inc", "gmbh", "llc", "bv", "ab", "coop", "soc", "societa",
  "bar", "pub", "caffe", "cafe", "pizzeria", "ristorante", "trattoria", "osteria", "pasticceria", "panificio",
  "forno", "macelleria", "gelateria", "birreria", "enoteca", "market", "supermercato", "minimarket", "hotel",
  "farmacia", "parafarmacia", "store", "shop", "negozio", "gestioni", "service", "services", "auto", "garage",
  "tabacchi", "tabaccheria", "edicola", "ferramenta", "lavanderia", "parrucchiere", "barbiere", "estetica",
  "palestra", "club", "studio", "ottica", "libreria", "cartoleria", "fiorista", "ristoro", "autogrill", "distributore",
  "benzina", "carburanti", "autolavaggio", "assicurazioni", "banca", "ufficio", "poste", "comune", "ente",
]);

/** Il testo di una carta arriva come «ESERCENTE CITTÀ PAESE Carta N. ***** Data operazione…»: si taglia lì. */
function cutBankBoilerplate(raw: string): string {
  const cut = raw.split(/\s+(?:Carta\s+N\b|Data\s+op)/i)[0].trim();
  return cut.length > 0 ? cut : raw.trim();
}

/**
 * Prepara un movimento per un servizio esterno: toglie il testo di contorno della banca e blocca ciò che non
 * è un esercente riconoscibile. Il filtro è volutamente prudente: due-quattro parole fatte solo di lettere e
 * senza alcun segno di attività sono trattate come una persona (o una ditta individuale) e restano da
 * categorizzare a mano; meglio qualche esercente in più a mano che un nome di privato verso terzi. I pagamenti
 * con carta (testo «Carta N.») sono sempre commerciali: il nome, anche se di una ditta individuale, è quello
 * pubblico dell'attività, e il controllo sulle persone vale solo per il resto (bonifici, giri, accrediti).
 */
export function prepareMerchantForModel(rawDescription: string): PreparedMerchant {
  const text = cutBankBoilerplate(rawDescription);
  const isCardPayment = /\bCarta\s+N\b/i.test(rawDescription);
  const { name, source } = extractMerchantName({ rawText: text });

  if (NON_MERCHANT.test(text)) return { name, blocked: "operazione" };
  if (source === "alias" || isCardPayment) return { name, blocked: null };

  const words = name.split(/\s+/).filter((word) => word.length > 0);
  const onlyLetters = words.every((word) => /^[A-Za-zÀ-ÿ'.]+$/.test(word));
  const hasBusinessWord = words.some((word) => BUSINESS_WORDS.has(word.toLowerCase().replace(/\./g, "")));
  if (words.length >= 2 && words.length <= 4 && onlyLetters && !hasBusinessWord) {
    return { name, blocked: "persona" };
  }
  return { name, blocked: null };
}
