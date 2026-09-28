"use client";

/** Misura larghezza e altezza di un elemento e le aggiorna quando cambiano (ResizeObserver). Parte da 0×0. */

import * as React from "react";

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, ElementSize] {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState<ElementSize>({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
