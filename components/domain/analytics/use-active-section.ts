"use client";

import * as React from "react";

/** Quota alta della finestra in cui una sezione conta come «quella che stai leggendo». */
const ACTIVE_ROOT_MARGIN = "-15% 0px -70% 0px";

/** Id della sezione che sta attraversando la parte alta dello schermo (la prima se nessuna). */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = React.useState(ids[0] ?? "");
  React.useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: ACTIVE_ROOT_MARGIN }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}
