/** Le aree dell'app elencate nella scheda «Cosa c'è dentro» del login: nome e frase corta, come nella sidebar. */

export interface LoginArea {
  name: string;
  description: string;
}

export const LOGIN_AREAS: readonly LoginArea[] = [
  { name: "Liquidità", description: "Movimenti dalla banca, già categorizzati" },
  { name: "Investimenti", description: "Rendimento vero e tasse italiane" },
  { name: "Pensione", description: "Fondo e TFR a confronto" },
  { name: "Debiti", description: "Rate ed estinzione anticipata" },
  { name: "Analitiche", description: "L'anno in cui puoi smettere di lavorare" },
];
