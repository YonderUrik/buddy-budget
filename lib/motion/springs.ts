/**
 * Molle e durate condivise da tutte le animazioni dell'app: chi anima qualcosa usa queste, così ogni movimento ha la
 * stessa fisica. Le transizioni `motion` le usano direttamente; le animazioni WAAPI passano da `springEasing`.
 */

/** Molla rapida e senza rimbalzo visibile: indicatori, lettere che si spostano, liste. */
export const SPRING_SNAPPY = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

/** Molla morbida: contenuti che entrano, testi. */
export const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 28 } as const;

/** Molla con un piccolo rimbalzo: pillole delle schede, isola dei lavori in corso. */
export const SPRING_BOUNCY = { type: "spring", stiffness: 380, damping: 26 } as const;

/** Media query del movimento ridotto chiesto dal sistema. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True se l'utente ha chiesto meno movimento (sempre false sul server). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export interface SpringEasing {
  /** Curva CSS `linear(...)` che riproduce la molla. */
  easing: string;
  /** Durata in millisecondi fino a quando la molla si ferma. */
  duration: number;
}

const FRAME_SECONDS = 1 / 60;
const MAX_FRAMES = 240;
const REST_DISTANCE = 0.0015;
const REST_VELOCITY = 0.01;

/**
 * Simula una molla da 0 a 1 e la restituisce come easing `linear()` per `element.animate`: serve dove non usiamo
 * `motion` (animazioni FLIP fatte a mano), con la stessa sensazione delle molle sopra.
 */
export function springEasing(stiffness: number, damping: number, mass = 1): SpringEasing {
  let position = 0;
  let velocity = 0;
  const points = [0];
  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    const force = -stiffness * (position - 1) - damping * velocity;
    velocity += (force / mass) * FRAME_SECONDS;
    position += velocity * FRAME_SECONDS;
    points.push(Number(position.toFixed(4)));
    if (frame > 10 && Math.abs(position - 1) < REST_DISTANCE && Math.abs(velocity) < REST_VELOCITY) break;
  }
  points[points.length - 1] = 1;
  return { easing: `linear(${points.join(",")})`, duration: Math.round((points.length - 1) * FRAME_SECONDS * 1000) };
}
