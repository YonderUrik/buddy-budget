/**
 * Serie del grafico del login: una funzione continua e limitata del "periodo" k, così il grafico può scorrere
 * all'infinito senza cambiare scala (la linea non si alza né si abbassa tutta insieme: scorre e aggiunge un pezzo).
 * Sono dati di esempio, non reali.
 */

/** Periodi visibili nella finestra del grafico (un anno di rilevazioni quindicinali). */
export const HORIZON_POINTS = 24;
/** Quanti periodi al secondo scorrono. */
export const HORIZON_SCROLL_SPEED = 0.45;
/** Intervallo tra due punti annotati, in periodi. */
export const HORIZON_MILESTONE_EVERY = 9;
/** Importo intero con il punto come separatore delle migliaia, identico su server e browser (Intl cambia tra ICU). */
export function formatThousands(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Valori in euro corrispondenti agli estremi della serie normalizzata. */
const VALUE_FLOOR = 20000;
const VALUE_RANGE = 16000;

/** Andamento normalizzato in [0, 1] al periodo `k`: somma di onde lente incommensurabili, senza ripetizioni evidenti. */
export function horizonLevel(k: number): number {
  const level =
    0.5 + 0.2 * Math.sin(k * 0.11 + 0.6) + 0.13 * Math.sin(k * 0.037 + 2) + 0.1 * Math.sin(k * 0.43 + 1) + 0.05 * Math.sin(k * 0.97);
  return Math.min(1, Math.max(0, level));
}

/** Patrimonio netto di esempio (€) al periodo `k`. */
export function horizonValue(k: number): number {
  return Math.round(VALUE_FLOOR + horizonLevel(k) * VALUE_RANGE);
}

/** Periodo di partenza: quello in cui la finestra iniziale sale di più e chiude in alto, così si parte da una bella salita. */
export const HORIZON_START_K = (() => {
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k <= 400; k++) {
    const score = horizonLevel(k + HORIZON_POINTS) * 2 + (horizonLevel(k + HORIZON_POINTS) - horizonLevel(k));
    if (score > bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return best;
})();

/** Tracciato morbido (curve cubiche) per punti già in coordinate dello schermo. */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C${r(p1.x + (p2.x - p0.x) / 6)},${r(p1.y + (p2.y - p0.y) / 6)} ${r(p2.x - (p3.x - p1.x) / 6)},${r(p2.y - (p3.y - p1.y) / 6)} ${r(p2.x)},${r(p2.y)}`;
  }
  return d;
}
