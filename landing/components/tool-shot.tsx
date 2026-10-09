import "./app-shot.css";
import "./tool-shot.css";
import { SCREENS, screenSrc, SCREEN_THEMES, type ScreenId } from "@/content/screens";

/** Larghezza della barra laterale dell'app negli screenshot (1920×1200), in % della larghezza: è la parte che si toglie. */
export const APP_SIDEBAR_PCT = 18.7;
/** Proporzioni degli screenshot dell'app (larghezza / altezza). */
const SCREEN_RATIO = 1920 / 1200;

export interface ToolShotProps {
  id: ScreenId;
  /** Quanta parte sinistra togliere, in % della larghezza dello screenshot (di default la barra laterale). */
  x?: number;
}

/**
 * Schermata vera dell'app (variante del tema corrente) senza la barra laterale, intera in altezza, dentro un riquadro con bordo.
 * Il riquadro prende le proporzioni della parte mostrata, così non si taglia nulla al variare della larghezza.
 */
export function ToolShot({ id, x = APP_SIDEBAR_PCT }: ToolShotProps) {
  if (!SCREENS.some((s) => s.id === id)) throw new Error(`Schermata sconosciuta: ${id}`);
  const shown = 1 - x / 100;
  return (
    <div className="ts" aria-hidden="true" style={{ aspectRatio: `${(SCREEN_RATIO * shown).toFixed(4)}` }}>
      {SCREEN_THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
        <img key={theme} className={`shot-${theme}`} src={screenSrc(id, theme)} alt="" loading="lazy" decoding="async" style={{ width: `${(100 / shown).toFixed(3)}%`, transform: `translateX(-${x}%)` }} />
      ))}
    </div>
  );
}
