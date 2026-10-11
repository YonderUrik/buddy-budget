/**
 * Fogli dal basso: sul telefono popover, dialog e conferme si aprono come un pannello agganciato al fondo dello schermo
 * (niente finestre da centrare scorrendo). Qui la media query condivisa e il gesto «trascina giù per chiudere»: si
 * trascina dalla maniglia o dall'intestazione, oltre una soglia (o con un colpo veloce) il foglio esce e si chiude.
 */

import { prefersReducedMotion, springEasing } from "./springs";

/** Sotto il breakpoint `sm` (640px) popover e dialog diventano fogli dal basso. */
export const SHEET_QUERY = "(max-width: 639.98px)";

/** Trascinamento oltre il quale il foglio si chiude al rilascio. */
const CLOSE_DISTANCE_PX = 80;
/** Velocità (px/ms) oltre la quale anche un trascinamento breve chiude il foglio. */
const CLOSE_VELOCITY = 0.6;
const EXIT_MS = 180;
const SNAP_BACK = springEasing(420, 34);
/** Dove si può iniziare il trascinamento: la maniglia e le intestazioni. */
const DRAG_SELECTOR = "[data-sheet-drag], [data-slot$='-header']";
/** Elementi interattivi da cui il trascinamento non parte (un tocco su un pulsante resta un tocco). */
const INTERACTIVE_SELECTOR = "button, a, input, textarea, select, [role='slider'], [contenteditable='true']";

/** True se lo schermo è abbastanza stretto da mostrare i fogli (sempre false sul server). */
export function isSheetViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(SHEET_QUERY).matches;
}

/**
 * Collega al pannello `popup` il gesto di chiusura trascinando verso il basso. `close` chiude davvero il pannello (di
 * solito cliccando il suo pulsante di chiusura nascosto). Non fa nulla sugli schermi larghi.
 */
export function attachSheetSwipe(popup: HTMLElement, close: () => void): void {
  popup.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || !isSheetViewport()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(DRAG_SELECTOR) || target.closest(INTERACTIVE_SELECTOR)) return;

    const startY = event.clientY;
    let lastY = startY;
    let lastAt = event.timeStamp;
    let velocity = 0;
    let dragging = false;

    function onMove(move: PointerEvent) {
      if (move.pointerId !== event.pointerId) return;
      const dy = Math.max(0, move.clientY - startY);
      if (!dragging && dy < 4) return;
      dragging = true;
      const dt = Math.max(1, move.timeStamp - lastAt);
      velocity = (move.clientY - lastY) / dt;
      lastY = move.clientY;
      lastAt = move.timeStamp;
      popup.style.transform = `translateY(${dy}px)`;
    }

    function onEnd(end: PointerEvent) {
      if (end.pointerId !== event.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (!dragging) return;
      const dy = Math.max(0, end.clientY - startY);
      const from = `translateY(${dy}px)`;
      popup.style.transform = "";
      if (end.type !== "pointercancel" && (dy > CLOSE_DISTANCE_PX || velocity > CLOSE_VELOCITY)) {
        // Il foglio esce da dove l'ha lasciato il dito; l'animazione d'uscita CSS va spenta, o ripartirebbe da zero.
        popup.dataset.swiped = "";
        if (prefersReducedMotion()) return close();
        popup
          .animate([{ transform: from }, { transform: "translateY(100%)" }], { duration: EXIT_MS, easing: "ease-in", fill: "forwards" })
          .finished.then(close, close);
        return;
      }
      if (!prefersReducedMotion()) popup.animate([{ transform: from }, { transform: "none" }], { duration: SNAP_BACK.duration, easing: SNAP_BACK.easing });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  });
}

/** Chiude il pannello cliccando il suo pulsante di chiusura nascosto (`data-sheet-close`), se c'è. */
export function clickSheetClose(popup: HTMLElement): void {
  popup.querySelector<HTMLElement>("[data-sheet-close]")?.click();
}
