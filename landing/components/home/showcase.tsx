"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SHOWCASE, type ShowcaseId } from "@/content/home";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { track } from "@/lib/analytics";
import { MOTION_OK } from "@/lib/motion/motion-ok";
import { PhoneShot } from "../phone-shot";
import { TrackedSection } from "../tracked-section";
import { ScreenCrop } from "./screen-crop";
import { SectionHead } from "./section-head";

/** How long a programmatic scroll (tab tap) is allowed to move the track before swipes count as the reader's again (ms). */
const SETTLE_MS = 700;

/**
 * «Cosa ti dice, ogni giorno»: five tabs like the app's segmented control, each with the real screen (window on
 * desktop, phone on the phone), the figure and the hook. The panels sit in a native scroll-snap track: a tap on a
 * tab scrolls to the panel, a swipe on the phone moves the tabs along. Every choice sends `showcase_tab_selected`.
 */
export function Showcase() {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const programmatic = useRef(false);

  const show = (index: number, reason: "tab" | "swipe") => {
    if (index === activeRef.current) return;
    activeRef.current = index;
    setActive(index);
    track("showcase_tab_selected", { tab: SHOWCASE.tabs[index].id });
    if (reason === "tab") {
      const panel = trackRef.current?.children[index] as HTMLElement | undefined;
      if (panel && trackRef.current) {
        programmatic.current = true;
        trackRef.current.scrollTo({ left: panel.offsetLeft, behavior: window.matchMedia(MOTION_OK).matches ? "smooth" : "auto" });
        window.setTimeout(() => {
          programmatic.current = false;
        }, SETTLE_MS);
      }
    }
    tabRefs.current[index]?.scrollIntoView({ inline: "center", block: "nearest" });
  };

  // A swipe (or any scroll of the track) selects the nearest panel.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (programmatic.current) return;
        const panels = Array.from(el.children) as HTMLElement[];
        let best = 0;
        let distance = Number.POSITIVE_INFINITY;
        panels.forEach((panel, i) => {
          const d = Math.abs(panel.offsetLeft - el.scrollLeft);
          if (d < distance) {
            distance = d;
            best = i;
          }
        });
        if (best !== activeRef.current) {
          activeRef.current = best;
          setActive(best);
          track("showcase_tab_selected", { tab: SHOWCASE.tabs[best].id });
          tabRefs.current[best]?.scrollIntoView({ inline: "center", block: "nearest" });
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = SHOWCASE.tabs.length - 1;
    const next = e.key === "ArrowRight" ? Math.min(last, active + 1) : e.key === "ArrowLeft" ? Math.max(0, active - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    show(next, "tab");
    tabRefs.current[next]?.focus();
  };

  const panelId = (id: ShowcaseId) => `dentro-${id}`;

  return (
    <TrackedSection id="dentro" section="dentro" className="sec show" aria-labelledby="dentro-t">
      <div className="wrap">
        <SectionHead id="dentro-t" title={SHOWCASE.title} />
        <div className="tabs" role="tablist" aria-label="Schermate">
          {SHOWCASE.tabs.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${panelId(tab.id)}-tab`}
              className="tab"
              aria-selected={i === active}
              aria-controls={panelId(tab.id)}
              tabIndex={i === active ? 0 : -1}
              onClick={() => show(i, "tab")}
              onKeyDown={onKey}
            >
              {tab.tab}
            </button>
          ))}
        </div>
        <div className="track" ref={trackRef}>
          {SHOWCASE.tabs.map((tab) => (
            <article key={tab.id} id={panelId(tab.id)} className="panel" role="tabpanel" aria-labelledby={`${panelId(tab.id)}-tab`}>
              <div>
                <h3>{tab.title}</h3>
                <p className={`fig amt${tab.figure.tone ? ` ${tab.figure.tone}` : ""}`}>
                  {tab.figure.value}
                  {tab.figure.small ? <small>{tab.figure.small}</small> : null}
                </p>
                <p className="fig-cap">{tab.figure.caption}</p>
                <p>{tab.text}</p>
                {tab.more ? <Link className="more" href={tab.more.href}>{tab.more.label}</Link> : null}
              </div>
              <div>
                <ScreenCrop id={tab.shot} ratio="16 / 11" />
                <PhoneShot id={tab.shot} />
              </div>
            </article>
          ))}
        </div>
        <Link className="more all" href={CONTENT_PATHS.schermate}>{SHOWCASE.all}</Link>
      </div>
    </TrackedSection>
  );
}
