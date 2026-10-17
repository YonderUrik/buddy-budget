import "./app-shot.css";
import { SCREEN_THEMES, SCREENS, screenPhoneSrc, type ScreenId } from "@/content/screens";
import { screenText } from "@/content/screen-text";
import type { Locale } from "@/lib/i18n";
import { PHONE_SHOT_SIZE } from "@/lib/screen-size";
import { PhoneFrame } from "./phone-frame";

export interface PhoneShotProps {
  /** Id of a screen in `content/screens.ts` that has the phone version (`phone`). */
  id: ScreenId;
  /** Screen height (see `PhoneFrame`). */
  height?: string;
  /** Above-the-fold image: loaded eagerly instead of lazily. */
  priority?: boolean;
  /** Language of the alt text. */
  locale?: Locale;
  className?: string;
}

/**
 * Real phone-size screenshot of the app inside the phone frame. Renders both the light and the dark version and the
 * CSS shows the one of the current theme (like `AppShot`).
 */
export function PhoneShot({ id, height, priority = false, locale = "it", className }: PhoneShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen || !("phone" in screen && screen.phone)) throw new Error(`Schermata senza versione da telefono: ${id}`);
  return (
    <PhoneFrame height={height} className={className}>
      {SCREEN_THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
        <img
          key={theme}
          className={`shot-img shot-${theme}`}
          src={screenPhoneSrc(screen.id, theme)}
          alt={screenText(screen.id, locale).alt}
          width={PHONE_SHOT_SIZE.width}
          height={PHONE_SHOT_SIZE.height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </PhoneFrame>
  );
}
