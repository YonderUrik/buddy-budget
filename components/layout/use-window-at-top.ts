"use client";

/**
 * useWindowAtTop
 *
 * In the app only `<main>` scrolls: the window itself stays at 0,0 (`overflow: hidden` on html and body in
 * `app/globals.css`). iOS still scrolls the window to show a field above its keyboard, and after the keyboard closes it
 * can leave the window there: the top bar and part of the page stay out of view and, with the window not scrollable,
 * the user cannot bring them back. While `enabled` (the default), the window goes back to the top whenever it moved and
 * no field is being typed into (a field with the keyboard open keeps the place iOS gave it).
 */

import { useEffect } from "react";

/** Input types that open no keyboard: focus on one of them does not hold the window where it is. */
const NO_KEYBOARD_INPUTS = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/** The bits of the focused element that tell whether the on-screen keyboard is open for it. */
export interface FocusedField {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
}

/** True when `element` opens the on-screen keyboard (text inputs, text areas, editable content). */
export function opensKeyboard(element: FocusedField | null | undefined): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === "TEXTAREA") return !element.readOnly;
  if (element.tagName === "INPUT") return !element.readOnly && !NO_KEYBOARD_INPUTS.has((element.type ?? "text").toLowerCase());
  return false;
}

/** True when the window has moved from the top and nobody is typing, so it should go back. */
export function windowNeedsReset(scroll: { x: number; y: number }, focused: FocusedField | null | undefined): boolean {
  return (scroll.x !== 0 || scroll.y !== 0) && !opensKeyboard(focused);
}

export function useWindowAtTop(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const check = () => {
      if (frame) return;
      // After the frame: focus has moved on (blur, then focus) and iOS has finished closing the keyboard.
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (windowNeedsReset({ x: window.scrollX, y: window.scrollY }, document.activeElement as HTMLInputElement | null)) window.scrollTo(0, 0);
      });
    };
    const viewport = window.visualViewport;
    window.addEventListener("scroll", check, { passive: true });
    document.addEventListener("focusout", check);
    viewport?.addEventListener("resize", check);
    check();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check);
      document.removeEventListener("focusout", check);
      viewport?.removeEventListener("resize", check);
    };
  }, [enabled]);
}
