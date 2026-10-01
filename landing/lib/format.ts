/**
 * Numero intero con il punto come separatore delle migliaia, sempre (anche sotto 10.000).
 * Fatto a mano e non con `toLocaleString`: Node e il browser raggruppano diversamente le cifre a 4 cifre e
 * la differenza rompe l'idratazione del testo renderizzato su server.
 */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Importo in euro, arrotondato all'unità, con separatore italiano delle migliaia. */
export function eur(n: number): string {
  return `${groupThousands(n)} €`;
}
