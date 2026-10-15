import { t as trLanding } from "@/lib/localization";
import "./app-shot.css";
import { SCREEN_SMALL_WIDTH, SCREENS, screenSmallSrc, screenSrc, SCREEN_THEMES, type ScreenId } from "@/content/screens";
import { screenSize } from "@/lib/screen-size";

export interface AppShotProps {
  /** Id di una schermata di `content/screens.ts`. */
  id: ScreenId;
  /** Indirizzo mostrato nella barra del finto browser (default: dominio dell'app + route reale). */
  url?: string;
  /** Larghezza a cui viene mostrata (attributo `sizes`): aiuta il browser a scegliere la versione leggera. */
  sizes?: string;
  /** Immagine sopra la piega: caricata subito invece che in lazy. */
  priority?: boolean;
  className?: string;
}

/**
 * Screenshot vero dell'app in una cornice da browser. Rende entrambe le versioni (chiara e scura) e il CSS mostra
 * quella che corrisponde al tema della landing, così il cambio tema non ricarica nulla.
 */
export function AppShot({ id, url, sizes = "(max-width: 860px) 100vw, 900px", priority = false, className }: AppShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  const size = screenSize(screen.id);
  return (
    <figure className={`shot${className ? ` ${className}` : ""}`}>
      <div className="shot-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{trLanding(url ?? `app.buddybudget.io${screen.route}`)}</span>
      </div>
      <div className="shot-imgs" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        {SCREEN_THEMES.map((theme) => (
          // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
          <img
            key={theme}
            className={`shot-img shot-${theme}`}
            src={screenSmallSrc(screen.id, theme)}
            // I telefoni scaricano e decodificano la versione a 1x; la 1,5x solo dove serve (schermi larghi e densi).
            srcSet={size.width > SCREEN_SMALL_WIDTH ? `${screenSmallSrc(screen.id, theme)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(screen.id, theme)} ${size.width}w` : undefined}
            sizes={sizes}
            alt={trLanding(screen.alt)}
            width={size.width}
            height={size.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
      </div>
    </figure>
  );
}
