"use client";

import { useEffect, useState } from "react";
import { APP_LINKS } from "@/content/site";
import { CtaLink } from "../cta-link";

/** The two anchors that decide when the bar shows: after the opening's button has scrolled away, until the closing is in view. */
const HERO_CTA_ID = "hero-cta";
const CLOSING_ID = "fine";

/**
 * Phone-only bar fixed at the bottom with the main button: it appears once the opening's button has scrolled past
 * and goes away when the closing (which has the same button) comes into view. Hidden above 1000px by CSS.
 */
export function MobileCta({ label, login }: { label: string; login: string }) {
  const [pastHero, setPastHero] = useState(false);
  const [atClosing, setAtClosing] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const hero = document.getElementById(HERO_CTA_ID);
    const closing = document.getElementById(CLOSING_ID);
    const heroObserver = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    const closingObserver = new IntersectionObserver(([entry]) => setAtClosing(entry.isIntersecting), { threshold: 0.1 });
    if (hero) heroObserver.observe(hero);
    if (closing) closingObserver.observe(closing);
    return () => {
      heroObserver.disconnect();
      closingObserver.disconnect();
    };
  }, []);

  const on = pastHero && !atClosing;
  return (
    <div className={`mcta${on ? "" : " off"}`} aria-hidden={!on}>
      <CtaLink className="btn ghost" href={APP_LINKS.login} location="mobile_bar" target="login">{login}</CtaLink>
      <CtaLink className="btn main" href={APP_LINKS.signup} location="mobile_bar" target="signup" arrow>{label}</CtaLink>
    </div>
  );
}
