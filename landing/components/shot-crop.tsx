import "./app-shot.css";
import "./shot-crop.css";
import { SCREENS, SCREEN_THEMES, screenSrc, type ScreenId } from "@/content/screens";

/** Dimensioni intrinseche degli screenshot (vedi `scripts/capture-screens.mjs`). */
const SHOT_SIZE = { width: 1920, height: 1200 } as const;

/**
 * Schermata vera dell'app senza la barra laterale (ritaglio in CSS), in entrambe le versioni: il tema della landing
 * decide quale si vede. Senza cornice da browser: va dentro un riquadro che ha già i suoi bordi.
 */
export function ShotCrop({ id, className }: { id: ScreenId; className?: string }) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  return (
    <div className={`crop${className ? ` ${className}` : ""}`}>
      {SCREEN_THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
        <img key={theme} className={`shot-img shot-${theme}`} src={screenSrc(screen.id, theme)} alt={screen.alt} width={SHOT_SIZE.width} height={SHOT_SIZE.height} loading="lazy" decoding="async" />
      ))}
    </div>
  );
}
