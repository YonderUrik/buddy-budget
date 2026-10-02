import "./app-shot.css";
import { SCREENS, screenSrc, SCREEN_THEMES, type ScreenId } from "@/content/screens";

/** Dimensioni intrinseche degli screenshot (vedi `scripts/capture-screens.mjs`): servono a riservare lo spazio. */
const SHOT_WIDTH = 1920;
const SHOT_HEIGHT = 1200;

export interface AppShotProps {
  /** Id di una schermata di `content/screens.ts`. */
  id: ScreenId;
  /** Indirizzo mostrato nella barra del finto browser (default: dominio dell'app + route reale). */
  url?: string;
  /** Immagine sopra la piega: caricata subito invece che in lazy. */
  priority?: boolean;
  className?: string;
}

/**
 * Screenshot vero dell'app in una cornice da browser. Rende entrambe le versioni (chiara e scura) e il CSS mostra
 * quella che corrisponde al tema della landing, così il cambio tema non ricarica nulla.
 */
export function AppShot({ id, url, priority = false, className }: AppShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  return (
    <figure className={`shot${className ? ` ${className}` : ""}`}>
      <div className="shot-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{url ?? `app.buddybudget.io${screen.route}`}</span>
      </div>
      <div className="shot-imgs">
        {SCREEN_THEMES.map((theme) => (
          // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
          <img
            key={theme}
            className={`shot-img shot-${theme}`}
            src={screenSrc(screen.id, theme)}
            alt={screen.alt}
            width={SHOT_WIDTH}
            height={SHOT_HEIGHT}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
      </div>
    </figure>
  );
}
