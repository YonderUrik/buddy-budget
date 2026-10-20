import "../app-shot.css";
import { SCREEN_SMALL_WIDTH, SCREENS, screenSmallSrc, screenSrc, type ScreenId } from "@/content/screens";
import { screenText } from "@/content/screen-text";
import type { Locale } from "@/lib/i18n";
import { screenSize } from "@/lib/screen-size";
import { screenVariants } from "@/lib/screen-variants";

/** Size of the `<id>-top.webp` captures (the top of the screen at the capture viewport). */
const TOP_SIZE = { width: 1280, height: 800 } as const;

export interface ScreenCropProps {
  /** Id of a screen in `content/screens.ts`. */
  id: ScreenId;
  /** Use the `-top.webp` capture (only for screens with `topCrop`). */
  top?: boolean;
  /** Aspect ratio of the window (CSS value); the screenshot fills it from the top and the rest is cropped. */
  ratio?: string;
  /** Above the fold: loaded eagerly instead of lazily. */
  priority?: boolean;
  /** `sizes` attribute, so the browser picks the light version on phones. */
  sizes?: string;
  /** Language of the alt text. */
  locale?: Locale;
  className?: string;
}

/**
 * Real screenshot of the app at fixed proportions, with no browser chrome around it: the image is anchored to the top and
 * cropped at the bottom, so the part that matters (title, figure, first chart) always shows and the layout never
 * jumps. Every theme and language is rendered and the CSS shows the current one (like `AppShot`).
 */
export function ScreenCrop({ id, top = false, ratio = "16 / 10", priority = false, sizes = "(max-width: 1000px) 100vw, 640px", locale = "it", className }: ScreenCropProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  if (top && !("topCrop" in screen && screen.topCrop)) throw new Error(`Schermata senza versione alta: ${id}`);
  const full = screenSize(screen.id);
  const size = top ? TOP_SIZE : { width: SCREEN_SMALL_WIDTH, height: Math.round((full.height * SCREEN_SMALL_WIDTH) / full.width) };
  return (
    <figure className={`win${className ? ` ${className}` : ""}`}>
      <div className="win-img" style={{ aspectRatio: ratio }}>
        {screenVariants(priority).map(({ language, theme, className, eager }) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
          <img
            key={`${language}-${theme}`}
            className={className}
            src={top ? screenSrc(screen.id, theme, true, language) : screenSmallSrc(screen.id, theme, language)}
            srcSet={top ? undefined : `${screenSmallSrc(screen.id, theme, language)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(screen.id, theme, false, language)} ${full.width}w`}
            sizes={top ? undefined : sizes}
            alt={screenText(screen.id, locale).alt}
            width={size.width}
            height={size.height}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            decoding="async"
          />
        ))}
      </div>
    </figure>
  );
}
