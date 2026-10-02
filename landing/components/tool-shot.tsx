import "./app-shot.css";
import "./tool-shot.css";
import { SCREENS, screenSrc, SCREEN_THEMES, type ScreenId } from "@/content/screens";

export interface ToolShotProps {
  id: ScreenId;
  /** Ingrandimento rispetto alla larghezza del riquadro. */
  zoom?: number;
  /** Punto dell'immagine che sta in alto a sinistra del riquadro, in % della larghezza/altezza dello screenshot. */
  x?: number;
  y?: number;
}

/** Ritaglio di uno screenshot vero dell'app (variante del tema corrente) dentro un riquadro con bordo: mostra la parte che interessa. */
export function ToolShot({ id, zoom = 1.7, x = 0, y = 0 }: ToolShotProps) {
  if (!SCREENS.some((s) => s.id === id)) throw new Error(`Schermata sconosciuta: ${id}`);
  return (
    <div className="ts" aria-hidden="true">
      {SCREEN_THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
        <img key={theme} className={`shot-${theme}`} src={screenSrc(id, theme)} alt="" loading="lazy" decoding="async" style={{ width: `${zoom * 100}%`, transform: `translate(-${x}%, -${y}%)` }} />
      ))}
    </div>
  );
}
