/**
 * Dialog che si aprono "dall'elemento che li ha aperti": ricorda l'ultimo elemento cliccato (o attivato da tastiera)
 * e fa crescere il pannello da lì, come una card che si espande nel suo dettaglio. Funziona per tutti i dialog senza
 * cambiare i chiamanti.
 */

import { prefersReducedMotion, springEasing } from "./springs";

/** Oltre questo tempo dal clic il dialog non è più considerato "aperto da lì" (es. aperto da un timer). */
const ORIGIN_MAX_AGE_MS = 800;
/** Scala minima e massima di partenza: un pulsante minuscolo non deve far nascere il pannello da un puntino. */
const MIN_START_SCALE = 0.3;
const MAX_START_SCALE = 0.92;
const OPEN_SPRING = springEasing(320, 30);
const OPACITY_MS = 160;
const INTERACTIVE_SELECTOR = "button, a, [role='button'], [role='menuitem'], [data-dialog-origin]";

interface Origin {
  rect: DOMRect;
  at: number;
}

let lastOrigin: Origin | null = null;
let listening = false;

function remember(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  const element = target.closest(INTERACTIVE_SELECTOR) ?? target;
  lastOrigin = { rect: element.getBoundingClientRect(), at: performance.now() };
}

/** Avvia (una volta sola) l'ascolto dei clic e dei tasti che possono aprire un dialog. */
export function trackDialogOrigins(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("pointerdown", (event) => remember(event.target), { capture: true, passive: true });
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") remember(document.activeElement);
    },
    { capture: true, passive: true }
  );
}

/**
 * Anima l'apertura di `popup` partendo dall'ultimo elemento attivato. Non fa nulla con il movimento ridotto o se
 * l'apertura non viene da un'interazione recente; in quel caso resta l'animazione CSS di default.
 */
export function animateFromOrigin(popup: HTMLElement): void {
  const origin = lastOrigin;
  lastOrigin = null;
  if (!origin || performance.now() - origin.at > ORIGIN_MAX_AGE_MS || prefersReducedMotion()) return;
  const target = popup.getBoundingClientRect();
  if (target.width === 0 || target.height === 0) return;
  const dx = origin.rect.left + origin.rect.width / 2 - (target.left + target.width / 2);
  const dy = origin.rect.top + origin.rect.height / 2 - (target.top + target.height / 2);
  const scale = Math.min(MAX_START_SCALE, Math.max(MIN_START_SCALE, origin.rect.width / target.width));
  popup.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "none" }], {
    duration: OPEN_SPRING.duration,
    easing: OPEN_SPRING.easing,
  });
  popup.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPACITY_MS, easing: "ease-out" });
}
