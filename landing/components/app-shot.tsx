import "./app-shot.css";
import { SCREEN_SMALL_WIDTH, SCREENS, screenSmallSrc, screenSrc, type ScreenId } from "@/content/screens";
import { screenText } from "@/content/screen-text";
import type { Locale } from "@/lib/i18n";
import { screenSize } from "@/lib/screen-size";
import { screenVariants } from "@/lib/screen-variants";

export interface AppShotProps {
  /** Id of a screen in `content/screens.ts`. */
  id: ScreenId;
  /** Width it is shown at (`sizes` attribute): helps the browser pick the light version. */
  sizes?: string;
  /** Above-the-fold image: loaded eagerly instead of lazily. */
  priority?: boolean;
  /** Language of the alt text. */
  locale?: Locale;
  className?: string;
}

/**
 * Real app screenshot, shown as it is (no browser frame, taste-skill: pictures need no frame). Renders every version (light and dark, in each language) and the CSS shows
 * the one of the landing's theme and the visitor's language, so switching theme reloads nothing.
 */
export function AppShot({ id, sizes = "(max-width: 860px) 100vw, 900px", priority = false, locale = "it", className }: AppShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  const size = screenSize(screen.id);
  return (
    <figure className={`shot${className ? ` ${className}` : ""}`}>
      <div className="shot-imgs" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        {screenVariants(priority).map(({ language, theme, className, eager }) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
          <img
            key={`${language}-${theme}`}
            className={className}
            src={screenSmallSrc(screen.id, theme, language)}
            // Phones download and decode the 1x version; the 1.5x only where it pays off (wide, dense screens).
            srcSet={size.width > SCREEN_SMALL_WIDTH ? `${screenSmallSrc(screen.id, theme, language)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(screen.id, theme, false, language)} ${size.width}w` : undefined}
            sizes={sizes}
            alt={screenText(screen.id, locale).alt}
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
