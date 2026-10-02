/**
 * Pagine di contenuto per la ricerca organica (calcolatori, guide, pagine funzione). BOZZA: finché `CONTENT_DRAFT` è true
 * le pagine sono `noindex` e fuori dal sitemap. I testi fiscali vanno validati da un professionista prima di metterlo a false.
 */
export const CONTENT_DRAFT = true;

export const CONTENT_PATHS = {
  zainetto: "/strumenti/zainetto-fiscale",
  ammortamento: "/strumenti/piano-ammortamento",
  guidaZainetto: "/guide/zainetto-fiscale",
  funzioneInvestimenti: "/funzioni/investimenti",
} as const;
