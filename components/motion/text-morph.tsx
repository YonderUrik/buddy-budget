"use client";

/**
 * Testo che si trasforma: quando cambia, le lettere in comune scivolano nella nuova posizione, le nuove compaiono e le
 * altre spariscono, e la larghezza segue con una molla (es. "Salva" → "Salvataggio…" → "Salvato"). Idea di Text Morph
 * di Motion Primitives (MIT), riscritta senza `motion`: da fermo è testo normale, le lettere diventano elementi
 * separati solo durante l'animazione, così non costa nulla nelle liste e non perde la crenatura.
 */

import * as React from "react";
import { prefersReducedMotion, springEasing } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

export interface TextMorphProps {
  children: string;
  className?: string;
}

interface Snapshot {
  /** Posizione orizzontale di ogni lettera, per chiave, rispetto al contenitore. */
  lefts: Map<string, number>;
  width: number;
}

const MOVE = springEasing(420, 34, 0.8);
const ENTER_MS = 260;
const ENTER_DELAY_MS = 60;
const LEAVE_MS = 180;
const NBSP = " ";

/** Chiave stabile di ogni lettera: il carattere (senza maiuscole) e quante volte è già comparso. */
function keyedChars(text: string): { char: string; key: string }[] {
  const seen: Record<string, number> = {};
  return [...text].map((char) => {
    const lower = char.toLowerCase();
    seen[lower] = (seen[lower] ?? 0) + 1;
    return { char, key: `${lower}${seen[lower]}` };
  });
}

/** Posizioni attuali delle lettere, sia che il testo sia normale sia che sia già diviso (animazione in corso). */
function measure(element: HTMLElement, text: string): Snapshot {
  const base = element.getBoundingClientRect();
  const lefts = new Map<string, number>();
  const spans = [...element.querySelectorAll<HTMLElement>("[data-morph-key]")].filter((span) => !span.dataset.leaving);
  if (spans.length > 0) {
    spans.forEach((span) => lefts.set(span.dataset.morphKey!, span.getBoundingClientRect().left - base.left));
  } else if (element.firstChild?.nodeType === Node.TEXT_NODE) {
    const node = element.firstChild;
    const range = document.createRange();
    let offset = 0;
    for (const { char, key } of keyedChars(text)) {
      range.setStart(node, offset);
      range.setEnd(node, offset + char.length);
      lefts.set(key, range.getBoundingClientRect().left - base.left);
      offset += char.length;
    }
  }
  return { lefts, width: base.width };
}

/** Testo che si trasforma lettera per lettera quando cambia (vedi intestazione del file). */
export class TextMorph extends React.Component<TextMorphProps> {
  private ref = React.createRef<HTMLSpanElement>();
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  getSnapshotBeforeUpdate(prev: TextMorphProps): Snapshot | null {
    const element = this.ref.current;
    if (!element || prev.children === this.props.children || prefersReducedMotion()) return null;
    return measure(element, prev.children);
  }

  componentDidUpdate(_prev: TextMorphProps, _state: unknown, snapshot: Snapshot | null) {
    const element = this.ref.current;
    if (!element || !snapshot) return;
    clearTimeout(this.settleTimer);
    const text = this.props.children;

    // React ha già scritto il nuovo testo: lo dividiamo in lettere per animarle.
    element.textContent = "";
    const spans = keyedChars(text).map(({ char, key }) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? NBSP : char;
      span.dataset.morphKey = key;
      span.style.display = "inline-block";
      element.appendChild(span);
      return span;
    });
    const base = element.getBoundingClientRect();
    const nextKeys = new Set(spans.map((span) => span.dataset.morphKey));

    for (const span of spans) {
      const from = snapshot.lefts.get(span.dataset.morphKey!);
      if (from === undefined) {
        span.animate(
          [
            { opacity: 0, filter: "blur(4px)", transform: "translateY(4px)" },
            { opacity: 1, filter: "blur(0)", transform: "none" },
          ],
          { duration: ENTER_MS, delay: ENTER_DELAY_MS, easing: "ease-out", fill: "backwards" }
        );
      } else {
        const dx = from - (span.getBoundingClientRect().left - base.left);
        if (Math.abs(dx) > 0.5) span.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], MOVE);
      }
    }

    // Le lettere che spariscono restano un attimo dov'erano, sopra il testo nuovo.
    const previousChars = keyedChars(_prev.children);
    for (const { char, key } of previousChars) {
      if (nextKeys.has(key)) continue;
      const left = snapshot.lefts.get(key);
      if (left === undefined) continue;
      const ghost = document.createElement("span");
      ghost.textContent = char === " " ? NBSP : char;
      ghost.dataset.morphKey = key;
      ghost.dataset.leaving = "true";
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, { position: "absolute", left: `${left}px`, top: "0", display: "inline-block" });
      element.appendChild(ghost);
      ghost.animate([{ opacity: 1 }, { opacity: 0, filter: "blur(4px)" }], { duration: LEAVE_MS, easing: "ease-in", fill: "forwards" }).onfinish =
        () => ghost.remove();
    }

    element.animate([{ width: `${snapshot.width}px` }, { width: `${base.width}px` }], MOVE);

    // A fine animazione torna testo semplice (stessa forma che React si aspetta di trovare).
    this.settleTimer = setTimeout(() => {
      if (this.ref.current) this.ref.current.textContent = this.props.children;
    }, Math.max(MOVE.duration, ENTER_MS + ENTER_DELAY_MS, LEAVE_MS) + 20);
  }

  componentWillUnmount() {
    clearTimeout(this.settleTimer);
  }

  render() {
    return (
      <span ref={this.ref} className={cn("relative inline-block whitespace-pre", this.props.className)}>
        {this.props.children}
      </span>
    );
  }
}
