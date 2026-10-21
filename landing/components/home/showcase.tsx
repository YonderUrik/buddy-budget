"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ShowcaseId, ShowcaseText } from "@/content/home";
import { track } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";
import { MOTION_OK } from "@/lib/motion/motion-ok";
import { rise } from "@/lib/motion/rise";
import { needsAttr } from "@/lib/visitor-country";
import { PhoneShot } from "../phone-shot";
import { TrackedSection } from "../tracked-section";
import { ScreenCrop } from "./screen-crop";

/** Whether a tab or panel is shown: those hidden by the visitor's rules (`data-needs`) are `display: none`. */
function isShown(el: Element | null | undefined): el is HTMLElement {
  return !!el && (el as HTMLElement).offsetParent !== null;
}

/** How long a programmatic scroll (tab tap) is allowed to move the track before swipes count as the reader's again (ms). */
const SETTLE_MS = 700;

/**
 * «Cosa ti dice, ogni giorno»: four tabs set as plain words, each with the real screen (the desktop capture on
 * desktop, the phone capture on the phone, no frames), the figure and the hook. The panels sit in a native scroll-snap track: a tap on a
 * tab scrolls to the panel, a swipe on the phone moves the tabs along. Every choice sends `showcase_tab_selected`.
 * Tabs on rules the visitor's country lacks are hidden with their panel, and swipes and arrow keys skip them.
 */
export function Showcase({ text, locale }: { text: ShowcaseText; locale: Locale }) {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const programmatic = useRef(false);

  const show = (index: number, reason: "tab" | "swipe") => {
    if (index === activeRef.current) return;
    activeRef.current = index;
    setActive(index);
    track("showcase_tab_selected", { tab: text.tabs[index].id });
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
          if (!isShown(panel)) return;
          const d = Math.abs(panel.offsetLeft - el.scrollLeft);
          if (d < distance) {
            distance = d;
            best = i;
          }
        });
        if (best !== activeRef.current) {
          activeRef.current = best;
          setActive(best);
          track("showcase_tab_selected", { tab: text.tabs[best].id });
          tabRefs.current[best]?.scrollIntoView({ inline: "center", block: "nearest" });
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [text.tabs]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const shown = text.tabs.map((_, i) => i).filter((i) => isShown(tabRefs.current[i]));
    const at = Math.max(0, shown.indexOf(active));
    const last = shown.length - 1;
    const pos = e.key === "ArrowRight" ? Math.min(last, at + 1) : e.key === "ArrowLeft" ? Math.max(0, at - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (pos === null) return;
    const next = shown[pos];
    e.preventDefault();
    show(next, "tab");
    tabRefs.current[next]?.focus();
  };

  const panelId = (id: ShowcaseId) => `dentro-${id}`;

  return (
    <TrackedSection id="dentro" section="dentro" className="sec show" field="alt" aria-labelledby="dentro-t">
      <div className="wrap">
        <h2 id="dentro-t" data-rise>{text.title}</h2>
        <div className="tabs" data-rise style={rise(1)} role="tablist" aria-label={text.tabsLabel}>
          {text.tabs.map((tab, i) => (
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
              data-needs={needsAttr(tab.needs)}
            >
              {tab.tab}
            </button>
          ))}
        </div>
        <div className="track" ref={trackRef}>
          {text.tabs.map((tab) => (
            <article key={tab.id} id={panelId(tab.id)} className="panel" role="tabpanel" aria-labelledby={`${panelId(tab.id)}-tab`} data-needs={needsAttr(tab.needs)}>
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
                <ScreenCrop id={tab.shot} ratio="16 / 11" locale={locale} sizes="(max-width: 1000px) 100vw, 760px" />
                <PhoneShot id={tab.shot} locale={locale} />
              </div>
            </article>
          ))}
        </div>
        <Link className="more all" href={text.allHref}>{text.all}</Link>
      </div>
    </TrackedSection>
  );
}
