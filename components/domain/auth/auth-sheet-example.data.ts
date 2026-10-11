/**
 * Righe dell'esempio animato del foglio di accesso: la stessa voce com'era nel foglio fatto a mano e come la tiene
 * BuddyBudget. Sono gli stessi numeri d'esempio della landing (patrimonio 29.343,45 €), non dati di nessuno.
 */

export interface AuthSheetExampleRow {
  /** Voce, come nella colonna A di un foglio dei conti. */
  name: string;
  /** Valore nel foglio fatto a mano: spesso vecchio o un errore di formula. */
  sheetValue: string;
  /** Perché il valore del foglio non è affidabile. */
  sheetNote: string;
  /** `true` se `sheetValue` è un errore di formula (#VALORE!, #RIF!). */
  sheetError?: boolean;
  /** Valore che mostra BuddyBudget. */
  appValue: string;
  /** Da dove arriva il valore in BuddyBudget. */
  appNote: string;
}

export const AUTH_SHEET_EXAMPLE_ROWS: readonly AuthSheetExampleRow[] = [
  { name: "Conto corrente", sheetValue: "4.812,30 €", sheetNote: "copiato a mano il 2 luglio", appValue: "5.130,82 €", appNote: "dalla banca, stamattina" },
  { name: "ETF mondo", sheetValue: "19.207,05 €", sheetNote: "prezzo di quando?", appValue: "19.768,40 €", appNote: "chiusura di ieri" },
  { name: "Tasse se vendo", sheetValue: "#RIF!", sheetNote: "zainetto??", sheetError: true, appValue: "142,60 €", appNote: "con le minus da recuperare" },
  { name: "Mutuo residuo", sheetValue: "27.433,58 €", sheetNote: "piano in PDF", appValue: "27.433,58 €", appNote: "prossima rata il 5 novembre" },
  { name: "Patrimonio", sheetValue: "#VALORE!", sheetNote: "formula rotta", sheetError: true, appValue: "29.343,45 €", appNote: "si aggiorna da solo" },
];
