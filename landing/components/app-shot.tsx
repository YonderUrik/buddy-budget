import "./app-shot.css";
import { SCREEN_SMALL_WIDTH, SCREENS, screenSmallSrc, screenSrc, type ScreenId } from "@/content/screens";
import { screenSize } from "@/lib/screen-size";
import { screenVariants } from "@/lib/screen-variants";

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
 * Real app screenshot in a browser frame. Renders every version (light and dark, in each language) and the CSS shows
 * the one of the landing's theme and the visitor's language, so switching theme reloads nothing.
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
        {screenVariants(priority).map(({ language, theme, className, eager }) => (
          // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
          <img
            key={`${language}-${theme}`}
            className={className}
            src={screenSmallSrc(screen.id, theme, language)}
            // Phones download and decode the 1x version; the 1.5x only where it pays off (wide, dense screens).
            srcSet={size.width > SCREEN_SMALL_WIDTH ? `${screenSmallSrc(screen.id, theme, language)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(screen.id, theme, false, language)} ${size.width}w` : undefined}
            sizes={sizes}
            alt={screen.alt}
            width={size.width}
            height={size.height}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
      </div>
    </figure>
  );
}
