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

/** Andamento deterministico in [0, 1] al periodo `k`: serve per la finestra iniziale, uguale su server e browser. */
export function baseLevel(k: number): number {
  const level =
    0.5 + 0.2 * Math.sin(k * 0.11 + 0.6) + 0.13 * Math.sin(k * 0.037 + 2) + 0.1 * Math.sin(k * 0.43 + 1) + 0.05 * Math.sin(k * 0.97);
  return Math.min(1, Math.max(0, level));
}

/** Periodo di partenza: quello in cui la finestra iniziale sale di più e chiude in alto, così si parte da una bella salita. */
export const HORIZON_START_K = (() => {
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k <= 400; k++) {
    const score = baseLevel(k + HORIZON_POINTS) * 2 + (baseLevel(k + HORIZON_POINTS) - baseLevel(k));
    if (score > bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return best;
})();

/** Periodi oltre la finestra visibile che la serie tiene già pronti (bordi del tracciato e spline). */
const SERIES_LOOKAHEAD = 4;
/** Limiti della passeggiata casuale (in [0, 1]) e livello verso cui torna. */
const WALK_MIN = 0.1;
const WALK_MAX = 0.9;
const WALK_MEAN = 0.55;
/** Quanto torna verso la media a ogni periodo, ampiezza del passo casuale e leggera spinta verso l'alto. */
const WALK_PULL = 0.1;
const WALK_STEP = 0.2;
const WALK_DRIFT = 0.01;

export interface HorizonSeries {
  /** Livello normalizzato in [0, 1] al periodo intero `k`; i periodi nuovi vengono generati al primo accesso. */
  levelAt(k: number): number;
  /** Livello sulla curva (spline come il tracciato) a una posizione frazionaria `position`. */
  curveAt(position: number): number;
  /** Patrimonio netto di esempio (€) al periodo intero `k`. */
  valueAt(k: number): number;
}

/**
 * Serie del grafico: finestra iniziale deterministica (`baseLevel`), poi passeggiata casuale che torna verso la media
 * e resta in [WALK_MIN, WALK_MAX], così non esce mai di scala. `random` è iniettabile per i test.
 */
export function createHorizonSeries(random: () => number = Math.random): HorizonSeries {
  const levels = new Map<number, number>();
  let last = HORIZON_START_K + HORIZON_POINTS + SERIES_LOOKAHEAD;
  for (let k = HORIZON_START_K - SERIES_LOOKAHEAD; k <= last; k++) levels.set(k, baseLevel(k));

  const levelAt = (k: number): number => {
    const known = levels.get(k);
    if (known !== undefined) return known;
    if (k < HORIZON_START_K - SERIES_LOOKAHEAD) return baseLevel(k);
    while (last < k) {
      const prev = levels.get(last) ?? WALK_MEAN;
      const next = prev + (WALK_MEAN - prev) * WALK_PULL + (random() - 0.5) * WALK_STEP + WALK_DRIFT;
      last += 1;
      levels.set(last, Math.min(WALK_MAX, Math.max(WALK_MIN, next)));
    }
    return levels.get(k) ?? WALK_MEAN;
  };

  const curveAt = (position: number): number => {
    const i = Math.floor(position);
    const t = position - i;
    const p0 = levelAt(i - 1);
    const p1 = levelAt(i);
    const p2 = levelAt(i + 1);
    const p3 = levelAt(i + 2);
    // Stesse maniglie di `smoothPath`: bezier cubica con x lineare in t.
    const c1 = p1 + (p2 - p0) / 6;
    const c2 = p2 - (p3 - p1) / 6;
    const u = 1 - t;
    return u * u * u * p1 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p2;
  };

  return { levelAt, curveAt, valueAt: (k) => Math.round(VALUE_FLOOR + levelAt(k) * VALUE_RANGE) };
}

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
