import "./app-shot.css";
import { SCREENS, screenPhoneSrc, type ScreenId } from "@/content/screens";
import { PHONE_SHOT_SIZE } from "@/lib/screen-size";
import { screenVariants } from "@/lib/screen-variants";
import { PhoneFrame } from "./phone-frame";

export interface PhoneShotProps {
  /** Id of a screen in `content/screens.ts` that has the phone version (`phone`). */
  id: ScreenId;
  /** Screen height (see `PhoneFrame`). */
  height?: string;
  /** Above-the-fold image: loaded eagerly instead of lazily. */
  priority?: boolean;
  className?: string;
}

/**
 * Real phone-size screenshot of the app inside the phone frame. Renders every theme and language version and the CSS
 * shows the one of the current theme and the visitor's language (like `AppShot`).
 */
export function PhoneShot({ id, height, priority = false, className }: PhoneShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen || !("phone" in screen && screen.phone)) throw new Error(`Schermata senza versione da telefono: ${id}`);
  return (
    <PhoneFrame height={height} className={className}>
      {screenVariants(priority).map(({ language, theme, className, eager }) => (
        // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
        <img
          key={`${language}-${theme}`}
          className={className}
          src={screenPhoneSrc(screen.id, theme, language)}
          alt={screen.alt}
          width={PHONE_SHOT_SIZE.width}
          height={PHONE_SHOT_SIZE.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </PhoneFrame>
  );
}
