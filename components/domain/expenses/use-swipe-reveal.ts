"use client";

/**
 * Stato e gestori di un gesto "scorri per svelare azioni" su una riga: trascinando a sinistra si mostrano
 * le azioni di destra, trascinando a destra quelle di sinistra. Solo touch e penna (con il mouse restano
 * i pulsanti visibili). Lo scorrimento verticale della pagina non viene mai bloccato: il gesto parte solo
 * quando il movimento è prevalentemente orizzontale. Ogni azione ha comunque un equivalente a pulsante.
 */

import * as React from "react";

export type SwipeSide = "closed" | "left" | "right";

/** Movimento minimo (px) prima di decidere se il gesto è orizzontale. */
const SWIPE_START_DISTANCE = 8;
/** Frazione della larghezza delle azioni oltre cui il gesto si completa. */
const SWIPE_COMMIT_RATIO = 0.4;

export interface UseSwipeRevealOptions {
  /** Larghezza (px) delle azioni a destra, svelate scorrendo a sinistra. 0 = nessuna. */
  rightWidth: number;
  /** Larghezza (px) delle azioni a sinistra, svelate scorrendo a destra. 0 = nessuna. */
  leftWidth: number;
}

export interface SwipeReveal {
  side: SwipeSide;
  /** Spostamento corrente della riga in px (negativo = verso sinistra). */
  offset: number;
  dragging: boolean;
  close: () => void;
  /** Da spalmare sull'elemento che scorre. */
  handlers: Pick<React.HTMLAttributes<HTMLElement>, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onClickCapture">;
}

export function useSwipeReveal({ rightWidth, leftWidth }: UseSwipeRevealOptions): SwipeReveal {
  const [side, setSide] = React.useState<SwipeSide>("closed");
  const [dragOffset, setDragOffset] = React.useState<number | null>(null);
  const start = React.useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null);
  const moved = React.useRef(false);

  const restingOffset = side === "left" ? -rightWidth : side === "right" ? leftWidth : 0;

  const clamp = React.useCallback((value: number) => Math.max(-rightWidth, Math.min(leftWidth, value)), [leftWidth, rightWidth]);

  const finish = React.useCallback(
    (offset: number) => {
      if (offset <= -rightWidth * SWIPE_COMMIT_RATIO && rightWidth > 0) setSide("left");
      else if (offset >= leftWidth * SWIPE_COMMIT_RATIO && leftWidth > 0) setSide("right");
      else setSide("closed");
    },
    [leftWidth, rightWidth]
  );

  const handlers: SwipeReveal["handlers"] = {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return;
      start.current = { x: event.clientX, y: event.clientY, base: restingOffset, horizontal: null };
      moved.current = false;
    },
    onPointerMove: (event) => {
      const s = start.current;
      if (!s) return;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      if (s.horizontal === null) {
        if (Math.abs(dx) < SWIPE_START_DISTANCE && Math.abs(dy) < SWIPE_START_DISTANCE) return;
        s.horizontal = Math.abs(dx) > Math.abs(dy);
        if (s.horizontal) event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (!s.horizontal) return;
      moved.current = true;
      setDragOffset(clamp(s.base + dx));
    },
    onPointerUp: () => {
      const s = start.current;
      start.current = null;
      if (s?.horizontal && dragOffset !== null) finish(dragOffset);
      setDragOffset(null);
    },
    onPointerCancel: () => {
      start.current = null;
      setDragOffset(null);
    },
    // Dopo un trascinamento il "click" sintetico non deve aprire il dettaglio.
    onClickCapture: (event) => {
      if (moved.current) {
        event.stopPropagation();
        event.preventDefault();
        moved.current = false;
      } else if (side !== "closed") {
        event.stopPropagation();
        event.preventDefault();
        setSide("closed");
      }
    },
  };

  return {
    side,
    offset: dragOffset ?? restingOffset,
    dragging: dragOffset !== null,
    close: () => setSide("closed"),
    handlers,
  };
}
