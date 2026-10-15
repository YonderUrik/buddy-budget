"use client";
import { t as trLanding, PROFILE } from "@/lib/localization";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HERO, REAL_TOGGLE } from "@/content/story";
import { SCREEN_SMALL_WIDTH, SCREEN_THEMES, SCREENS, screenPhoneSrc, screenSmallSrc, screenSrc, type ScreenId } from "@/content/screens";
import { PHONE_SHOT_SIZE, screenSize } from "@/lib/screen-size";
import { MovementsPanel, MovementsPhonePanel } from "./live-movements";
import { DebtPanel, FirePanel, PerformancePanel, TaxPanel } from "./live-panels";
import { shotShown, STAGE_SHOTS, type ActiveId, type StageView } from "./story-views";

/** Larghezza (px) a cui sono catturate le schermate: i riquadri `focus` sono in queste coordinate. */
const SHOT_WIDTH = 1920;
/** Quanto si avvicina la camera a un riquadro. */
const ZOOM = 1.25;
/** Centro verticale di ripiego (px dello screenshot) quando non c'è un riquadro. */
const DEFAULT_CENTER_Y = 600;
/** Dopo quanto (ms) si caricano le schermate non ancora richieste, se chi legge resta sull'apertura. */
const PRELOAD_AFTER_MS = 2000;
/** Larghezza mostrata della finestra sul desktop (per `sizes`); sul telefono la finestra non esiste. */
const VIEW_SIZES = "(max-width: 1000px) 1px, 900px";
const PHONE_SIZES = "200px";

export interface StoryStageProps {
  active: ActiveId;
  view: StageView;
  /** «Vedi la schermata vera» acceso: al posto del pannello vivo si vede lo screenshot. */
  real: boolean;
  onToggleReal: () => void;
}

/**
 * La finestra dell'app che resta ferma mentre si scorre: pannelli vivi e schermate vere, con la camera che si avvicina
 * al riquadro del passo. Sul telefono diventa un telefono fissato in alto, con le versioni a misura di telefono.
 */
export function StoryStage({ active, view, real, onToggleReal }: StoryStageProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState("");
  const [preloaded, setPreloaded] = useState(false);
  // Le schermate oltre alla prima si caricano quando servono (si scorre o si chiede quella vera), o comunque dopo poco.
  useEffect(() => {
    const timer = setTimeout(() => setPreloaded(true), PRELOAD_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const armed = preloaded || active !== "hero" || real;

  const updateCamera = useCallback(() => {
    const el = viewRef.current;
    if (!el || (view.live && !real)) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!W || !H) return;
    const s = W / SHOT_WIDTH;
    const f = view.focus;
    const z = f ? ZOOM : 1;
    const ih = screenSize(view.shot).height;
    const cx = f ? f[0] + f[2] / 2 : SHOT_WIDTH / 2;
    const cy = f ? f[1] + f[3] / 2 : DEFAULT_CENTER_Y;
    const vw = SHOT_WIDTH / z;
    const vh = H / s / z;
    const x0 = Math.max(0, Math.min(SHOT_WIDTH - vw, f ? cx - vw / 2 : 0));
    const y0 = Math.max(0, Math.min(ih - vh, f ? cy - vh / 2 : 0));
    setCamera(`translate(${-x0 * s * z}px, ${-y0 * s * z}px) scale(${z})`);
  }, [view, real]);

  useLayoutEffect(() => {
    updateCamera();
    window.addEventListener("resize", updateCamera);
    return () => window.removeEventListener("resize", updateCamera);
  }, [updateCamera]);

  const hasReal = Boolean(view.live);
  const alt = (id: ScreenId) => SCREENS.find((s) => s.id === id)?.alt ?? "";

  return (
    <div className="stage-col">
      <div className={`stage${hasReal ? " has-real" : ""}${real ? " real" : ""}`}>
        <div className="frame">
          <div className="bar" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>{trLanding(view.url)}</span>
          </div>
          <div className="view" ref={viewRef}>
            <MovementsPanel on={active === "soldi"} />
            <PerformancePanel on={active === "investimenti"} />
            {PROFILE.country === "IT" && <TaxPanel on={active === "tasse"} />}
            <DebtPanel on={active === "mutuo"} />
            {PROFILE.country === "IT" && <FirePanel on={active === "futuro"} />}
            {STAGE_SHOTS.map((shot) => {
              const size = screenSize(shot.id);
              const shown = shotShown(view, shot.id, real);
              const load = shot.id === HERO.shot || armed;
              return SCREEN_THEMES.map((theme) => (
                // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
                <img
                  key={`${shot.id}-${theme}`}
                  className={`shot shot-${theme}${shot.real ? " real" : ""}${shown ? " on" : ""}`}
                  src={load ? screenSmallSrc(shot.id, theme) : undefined}
                  srcSet={load ? `${screenSmallSrc(shot.id, theme)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(shot.id, theme)} ${size.width}w` : undefined}
                  sizes={VIEW_SIZES}
                  width={size.width}
                  height={size.height}
                  alt={trLanding(alt(shot.id))}
                  aria-hidden={!shown}
                  loading={shot.id === HERO.shot ? "eager" : "lazy"}
                  decoding="async"
                  style={{ transform: camera }}
                />
              ));
            })}
          </div>
        </div>
        <div className="phone">
          <div>
            <MovementsPhonePanel on={active === "soldi"} />
            <PerformancePanel on={active === "investimenti"} />
            {PROFILE.country === "IT" && <TaxPanel on={active === "tasse"} />}
            <DebtPanel on={active === "mutuo"} />
            {PROFILE.country === "IT" && <FirePanel on={active === "futuro"} />}
            {STAGE_SHOTS.map((shot) => {
              const shown = shotShown(view, shot.id, real);
              const load = shot.id === HERO.shot || armed;
              return SCREEN_THEMES.map((theme) => (
                // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
                <img
                  key={`${shot.id}-${theme}-phone`}
                  className={`shot shot-${theme}${shot.real ? " real" : ""}${shown ? " on" : ""}`}
                  src={load ? screenPhoneSrc(shot.id, theme) : undefined}
                  sizes={PHONE_SIZES}
                  width={PHONE_SHOT_SIZE.width}
                  height={PHONE_SHOT_SIZE.height}
                  alt={trLanding(alt(shot.id))}
                  aria-hidden={!shown}
                  loading={shot.id === HERO.shot ? "eager" : "lazy"}
                  decoding="async"
                />
              ));
            })}
          </div>
        </div>
        <div className="stage-cap">
          <p>{trLanding(view.caption)}</p>
          <button type="button" className="real-btn" aria-pressed={real} onClick={onToggleReal}>
            {trLanding(real ? REAL_TOGGLE.hide : REAL_TOGGLE.show)}
          </button>
        </div>
      </div>
    </div>
  );
}
