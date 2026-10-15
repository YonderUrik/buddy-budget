import "./app-shot.css";
import { SCREEN_THEMES, SCREENS, screenPhoneSrc, type ScreenId } from "@/content/screens";
import { PHONE_SHOT_SIZE } from "@/lib/screen-size";
import { PhoneFrame } from "./phone-frame";

export interface PhoneShotProps {
  /** Id di una schermata di `content/screens.ts` con la versione da telefono (`phone`). */
  id: ScreenId;
  /** Altezza dello schermo (vedi `PhoneFrame`). */
  height?: string;
  /** Immagine sopra la piega: caricata subito invece che in lazy. */
  priority?: boolean;
  className?: string;
}

/**
 * Screenshot vero dell'app a misura di telefono, nella cornice da telefono. Rende la versione chiara e quella scura e
 * il CSS mostra quella del tema corrente (come `AppShot`).
 */
export function PhoneShot({ id, height, priority = false, className }: PhoneShotProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen || !("phone" in screen && screen.phone)) throw new Error(`Schermata senza versione da telefono: ${id}`);
  return (
    <PhoneFrame height={height} className={className}>
      {SCREEN_THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
        <img
          key={theme}
          className={`shot-img shot-${theme}`}
          src={screenPhoneSrc(screen.id, theme)}
          alt={screen.alt}
          width={PHONE_SHOT_SIZE.width}
          height={PHONE_SHOT_SIZE.height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </PhoneFrame>
  );
}
