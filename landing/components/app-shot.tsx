import "./app-shot.css";
import { SCREEN_SMALL_WIDTH, SCREENS, screenSmallSrc, screenSrc, SCREEN_THEMES, type ScreenId } from "@/content/screens";
import manifest from "@/public/screens/manifest.json";

/** Dimensioni di ripiego, quelle della finestra di cattura (1280×800 a 1,5x). */
const DEFAULT_SIZE = { width: 1920, height: 1200 } as const;

/** Dimensioni in pixel dell'immagine intera, lette dal manifest della cattura: servono a riservare lo spazio. */
function screenSize(id: ScreenId): { width: number; height: number } {
  const entry = (manifest.screens as { id: string; width?: number; height?: number }[]).find((s) => s.id === id);
  return entry?.width && entry.height ? { width: entry.width, height: entry.height } : DEFAULT_SIZE;
}

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
        <span>{url ?? `app.buddybudget.io${screen.route}`}</span>
      </div>
      <div className="shot-imgs" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        {SCREEN_THEMES.map((theme) => (
          // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
          <img
            key={theme}
            className={`shot-img shot-${theme}`}
            src={screenSmallSrc(screen.id, theme)}
            // I telefoni scaricano e decodificano la versione a 1x; la 1,5x solo dove serve (schermi larghi e densi).
            srcSet={`${screenSmallSrc(screen.id, theme)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(screen.id, theme)} ${size.width}w`}
            sizes={sizes}
            alt={screen.alt}
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
