/**
 * Categorie proposte da BuddyBudget a ogni nuovo utente, facoltative dell'onboarding e nomi storici. Modulo puro, senza
 * dipendenze da DB o React: lo usano il seed, il reset e il passo «Categorie» dell'onboarding.
 */
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import type { CategoryType } from "./groups";

/** Categoria proposta da BuddyBudget: `key` è stabile nel codice (non salvata), il nome si può cambiare. */
export interface DefaultCategory {
  key: string;
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
  /** Cosa ci va, in poche parole: la vede l'utente e la riceve l'assistente come guida della scelta. */
  description?: string;
  isFallback?: boolean;
}

/** Categorie create per ogni nuovo utente (lista rivista il 2026-10-11: 23 più la fallback). */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // --- DOVUTE ---
  { key: "affitto", name: "Affitto & Mutuo", type: "dovuta", icon: "home", color: "slate", description: "Affitto, rata del mutuo, condominio" },
  { key: "bollette", name: "Bollette & Telefono", type: "dovuta", icon: "zap", color: "yellow", description: "Luce, gas, acqua, internet, cellulare" },
  { key: "spesa", name: "Spesa", type: "dovuta", icon: "shopping-cart", color: "green", description: "Supermercato, alimentari, casalinghi" },
  { key: "trasporti", name: "Trasporti", type: "dovuta", icon: "car", color: "blue", description: "Carburante, mezzi pubblici, pedaggi, parcheggi, officina" },
  { key: "salute", name: "Salute", type: "dovuta", icon: "pill", color: "rose", description: "Farmacia, visite, dentista, analisi" },
  { key: "assicurazioni", name: "Assicurazioni", type: "dovuta", icon: "shield", color: "indigo", description: "Auto, casa, vita, salute" },
  { key: "rate", name: "Rate & Prestiti", type: "dovuta", icon: "credit-card", color: "red", description: "Finanziamenti, prestiti, acquisti a rate" },

  // --- VOLUTE ---
  { key: "ristoranti", name: "Ristoranti & Bar", type: "voluta", icon: "utensils", color: "orange", description: "Pranzi e cene fuori, bar, caffè, consegne a domicilio" },
  { key: "abbonamenti", name: "Abbonamenti", type: "voluta", icon: "tv", color: "purple", description: "Streaming, musica, app, software, giornali" },
  { key: "svago", name: "Svago", type: "voluta", icon: "gamepad-2", color: "teal", description: "Cinema, concerti, hobby, giochi, libri" },
  { key: "benessere", name: "Sport & Benessere", type: "voluta", icon: "dumbbell", color: "lime", description: "Palestra, sport, parrucchiere, estetista" },
  { key: "shopping", name: "Shopping", type: "voluta", icon: "shopping-bag", color: "pink", description: "Vestiti, scarpe, elettronica, acquisti online" },
  { key: "viaggi", name: "Viaggi", type: "voluta", icon: "plane", color: "cyan", description: "Voli, treni per le vacanze, hotel, case vacanza" },
  { key: "contanti", name: "Contanti", type: "voluta", icon: "wallet", color: "emerald", description: "Prelievi al bancomat" },

  // --- TE FUTURO ---
  { key: "risparmio", name: "Risparmio", type: "futuro", icon: "piggy-bank", color: "green", description: "Versamenti sul conto deposito o sul salvadanaio" },
  { key: "investimenti", name: "Investimenti", type: "futuro", icon: "coins", color: "teal", description: "Versamenti al broker, piani di accumulo" },

  // --- SALTUARIE ---
  { key: "tasse", name: "Tasse & Bolli", type: "saltuaria", icon: "receipt", color: "slate", description: "F24, IMU, TARI, bollo auto, canone" },
  { key: "casa", name: "Casa & Arredamento", type: "saltuaria", icon: "sofa", color: "amber", description: "Mobili, elettrodomestici, lavori in casa" },
  { key: "regali", name: "Regali & Donazioni", type: "saltuaria", icon: "gift", color: "pink", description: "Regali, ricorrenze, beneficenza" },

  // --- FALLBACK (nessun gruppo reale: il type è solo un valore non-null) ---
  { key: "da-categorizzare", name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true },

  // --- ENTRATE ---
  { key: "stipendio", name: "Stipendio", type: "entrata", icon: "banknote", color: "emerald", description: "Stipendio, pensione, tredicesima" },
  { key: "interessi", name: "Interessi & Dividendi", type: "entrata", icon: "trending-up", color: "teal", description: "Interessi del conto deposito, dividendi e cedole" },
  { key: "rimborsi", name: "Rimborsi", type: "entrata", icon: "calculator", color: "cyan", description: "Resi, rimborsi del 730, soldi restituiti da amici" },
  { key: "altre-entrate", name: "Altre entrate", type: "entrata", icon: "package", color: "slate", description: "Tutto ciò che non rientra nelle altre entrate" },
];

/** Categorie proposte spente nell'onboarding: servono solo ad alcuni, l'utente le accende con un tocco. */
export const OPTIONAL_DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: "figli", name: "Figli & Scuola", type: "dovuta", icon: "graduation-cap", color: "violet", description: "Scuola, libri, mensa, attività dei figli" },
  { key: "animali", name: "Animali", type: "dovuta", icon: "paw-print", color: "amber", description: "Cibo, veterinario, accessori" },
  { key: "pensione", name: "Pensione integrativa", type: "futuro", icon: "landmark", color: "indigo", description: "Versamenti al fondo pensione" },
  { key: "imprevisti", name: "Imprevisti", type: "saltuaria", icon: "alert-triangle", color: "yellow", description: "Spese che non avevi previsto" },
  { key: "lavoro-autonomo", name: "Lavoro autonomo", type: "entrata", icon: "briefcase", color: "blue", description: "Fatture, prestazioni occasionali" },
];

/**
 * Nomi di categorie di default delle versioni precedenti → nome attuale. Usato dal reset categorie
 * per aggiornare (preservandone l'id e quindi transazioni/regole/budget) le categorie solo rinominate.
 * Copre tutte le liste di default storicamente sedute (dallo schema iniziale fissa/variabile del
 * 2026-07-03 fino agli ultimi default a gruppi di spesa), non solo l'ultima prima di questa lista.
 * "Altro" (default storico fino al 2026-07-21) resta deliberatamente NON mappato: non ha un
 * equivalente naturale nella nuova lista, quindi il reset la elimina come categoria personalizzata
 * (le sue transazioni finiscono su "Da categorizzare" per essere ricategorizzate).
 */
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  // --- default storici pre-icone/colori (2026-07-03 → 2026-07-21, fissa/variabile) ---
  "Affitto": "Affitto & Mutuo",
  "Bollette & casa": "Bollette & Telefono",
  "Ristoranti": "Ristoranti & Bar",
  // --- default 2026-07-26 (icone/colori, poi entrate) ---
  "Assicurazioni & Tasse": "Assicurazioni",
  "Risparmi & Investimenti": "Investimenti",
  "Trasporti & Auto": "Trasporti",
  "Salute & Cura": "Salute",
  "Svago & Hobbies": "Svago",
  "Regali": "Regali & Donazioni",
  // --- prima versione dei gruppi di spesa (2026-09-22, prima dell'estensione a 33 default) ---
  "Manutenzione auto/casa": "Trasporti",
  "Sport & Palestra": "Sport & Benessere",
  // --- 33 default a gruppi di spesa (2026-09-23 → 2026-10-11): rinominate o accorpate ---
  "Bollette & Utenze": "Bollette & Telefono",
  "Internet & Telefono": "Bollette & Telefono",
  "Spesa alimentare": "Spesa",
  "Trasporti & Carburante": "Trasporti",
  "Manutenzione auto": "Trasporti",
  "Salute & Farmaci": "Salute",
  "Rate & Finanziamenti": "Rate & Prestiti",
  "Abbonamenti & Streaming": "Abbonamenti",
  "Svago & Hobby": "Svago",
  "Abbigliamento": "Shopping",
  "Shopping & Tecnologia": "Shopping",
  "Cura personale": "Sport & Benessere",
  "Viaggi & Vacanze": "Viaggi",
  "Fondo emergenza": "Risparmio",
  "Risparmio per obiettivi": "Risparmio",
  "Regali & Ricorrenze": "Regali & Donazioni",
  "Dividendi e interessi": "Interessi & Dividendi",
};
