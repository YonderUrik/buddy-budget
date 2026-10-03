/**
 * Pagine di contenuto per la ricerca organica (calcolatori, guide, pagine funzione). Pubblicate per scelta dell'utente
 * (2026-10-02) con un avviso "solo a scopo informativo" in ogni pagina. Rimettere `CONTENT_DRAFT` a true le toglie
 * dall'indice e dal sitemap (utile se un testo fiscale va ritirato in attesa di verifica).
 */
export const CONTENT_DRAFT = false;

export const CONTENT_PATHS = {
  zainetto: "/strumenti/zainetto-fiscale",
  ammortamento: "/strumenti/piano-ammortamento",
  guidaZainetto: "/guide/zainetto-fiscale",
  funzioneInvestimenti: "/funzioni/investimenti",
  funzioni: "/funzioni",
  schermate: "/schermate",
} as const;

export interface Source {
  label: string;
  href: string;
}

/** Fonti citate nelle pagine. Controllate il 2026-10-02: quando una norma cambia si aggiorna la voce e il testo che la usa. */
export const SOURCES_CHECKED = "2 ottobre 2026";
export const SOURCES = {
  tuir68: { label: "Art. 68 del TUIR (D.P.R. 917/1986), plusvalenze e minusvalenze: compensazione e riporto \"non oltre il quarto\" anno", href: "https://brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art68.html" },
  circolare19e: { label: "Agenzia delle Entrate, Circolare 19/E del 27 giugno 2014: tassazione dei redditi finanziari (aliquota 26%, titoli di Stato al 12,5%)", href: "https://www.agenziaentrate.gov.it/portale/documents/20143/298850/Circolare+n19E+del+27+giugno+2014_Cir19e+del+27+06+14.pdf/429c76f6-6236-4071-79ae-65af4aadd134" },
  quadroRt: { label: "Agenzia delle Entrate, Quadro RT: plusvalenze e minusvalenze nella dichiarazione dei redditi", href: "https://infoprecompilata.agenziaentrate.gov.it/portale/quadro-rt" },
  guidaMutuo: { label: "Banca d'Italia, Il mutuo ipotecario in parole semplici: estinzione anticipata senza compensi né penali per i mutui sull'abitazione", href: "https://www.bancaditalia.it/pubblicazioni/guide-bi/guida-mutuo/Le-guide-della-Banca-d-Italia_Comprare-una-casa_Il-mutuo-ipotecario-in-parole-semplici.pdf" },
  prestitoPersonale: { label: "Banca d'Italia, Economia per tutti: prestito personale e rimborso anticipato", href: "https://economiapertutti.bancaditalia.it/aree-tematiche/prestiti/prestito-personale/" },
} as const satisfies Record<string, Source>;
