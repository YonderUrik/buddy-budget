import "./app-shot.css";
import "./phone-shot.css";
import type { CSSProperties } from "react";
import { SCREENS, screenPhoneSrc, type ScreenId } from "@/content/screens";
import { screenText } from "@/content/screen-text";
import type { Locale } from "@/lib/i18n";
import { PHONE_SHOT_SIZE } from "@/lib/screen-size";
import { screenVariants } from "@/lib/screen-variants";

export interface PhoneShotProps {
  /** Id of a screen in `content/screens.ts` that has the phone version (`phone`). */
  id: ScreenId;
  /** Height of the picture (e.g. `46vh`, `520px`); the width follows the 390×751 capture. Without it, the CSS default applies. */
  height?: string;
  /** Above-the-fold image: loaded eagerly instead of lazily. */
  priority?: boolean;
  /** Language of the alt text. */
  locale?: Locale;
  className?: string;
}

/**
 * Real phone-size screenshot of the app, shown as it is: no device frame around it (taste-skill: pictures need no
 * frame). Renders every theme and language version and the CSS shows the one of the current theme and the visitor's
 * language (like `AppShot`).
 */
export function PhoneShot({ id, height, priority = false, locale = "it", className }: PhoneShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen || !("phone" in screen && screen.phone)) throw new Error(`Schermata senza versione da telefono: ${id}`);
  return (
    <figure className={`ps${className ? ` ${className}` : ""}`} style={height ? ({ "--ps-h": height } as CSSProperties) : undefined}>
      {screenVariants(priority).map(({ language, theme, className, eager }) => (
        // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
        <img
          key={`${language}-${theme}`}
          className={className}
          src={screenPhoneSrc(screen.id, theme, language)}
          alt={screenText(screen.id, locale).alt}
          width={PHONE_SHOT_SIZE.width}
          height={PHONE_SHOT_SIZE.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </figure>
  );
}
