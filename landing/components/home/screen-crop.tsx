import "../app-shot.css";
import { SCREEN_SMALL_WIDTH, SCREENS, SCREEN_THEMES, screenSmallSrc, screenSrc, type ScreenId } from "@/content/screens";
import { screenSize } from "@/lib/screen-size";

/** Size of the `<id>-top.jpg` captures (the top of the screen at the capture viewport). */
const TOP_SIZE = { width: 1280, height: 800 } as const;

export interface ScreenCropProps {
  /** Id of a screen in `content/screens.ts`. */
  id: ScreenId;
  /** Use the `-top.jpg` capture (only for screens with `topCrop`). */
  top?: boolean;
  /** Aspect ratio of the window (CSS value); the screenshot fills it from the top and the rest is cropped. */
  ratio?: string;
  /** Above the fold: loaded eagerly instead of lazily. */
  priority?: boolean;
  /** `sizes` attribute, so the browser picks the light version on phones. */
  sizes?: string;
  className?: string;
}

/**
 * Real screenshot of the app in a browser-like window of fixed proportions: the image is anchored to the top and
 * cropped at the bottom, so the part that matters (title, figure, first chart) always shows and the layout never
 * jumps. Both themes are rendered and the CSS shows the current one (like `AppShot`).
 */
export function ScreenCrop({ id, top = false, ratio = "16 / 10", priority = false, sizes = "(max-width: 1000px) 100vw, 640px", className }: ScreenCropProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  if (top && !("topCrop" in screen && screen.topCrop)) throw new Error(`Schermata senza versione alta: ${id}`);
  const full = screenSize(screen.id);
  const size = top ? TOP_SIZE : { width: SCREEN_SMALL_WIDTH, height: Math.round((full.height * SCREEN_SMALL_WIDTH) / full.width) };
  return (
    <figure className={`win${className ? ` ${className}` : ""}`}>
      <div className="win-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>app.buddybudget.io{screen.route}</span>
      </div>
      <div className="win-img" style={{ aspectRatio: ratio }}>
        {SCREEN_THEMES.map((theme) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
          <img
            key={theme}
            className={`shot-img shot-${theme}`}
            src={top ? screenSrc(screen.id, theme, true) : screenSmallSrc(screen.id, theme)}
            srcSet={top ? undefined : `${screenSmallSrc(screen.id, theme)} ${SCREEN_SMALL_WIDTH}w, ${screenSrc(screen.id, theme)} ${full.width}w`}
            sizes={top ? undefined : sizes}
            alt={screen.alt}
            width={size.width}
            height={size.height}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
          />
        ))}
      </div>
    </figure>
  );
}
