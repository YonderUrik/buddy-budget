import { SCREENS, screenSrc, SCREEN_THEMES, type ScreenId } from "@/content/screens";

export interface ShotCropProps {
  id: ScreenId;
  /** Punto dell'immagine che resta in vista (CSS `object-position`). */
  position?: string;
  /** Ingrandimento (1 = tutta la schermata): sopra 1 mostra un dettaglio. */
  zoom?: number;
}

/** Dettaglio di uno screenshot vero dell'app (ritagliato), nella variante del tema corrente. Decorativo: il testo sta nella card. */
export function ShotCrop({ id, position = "left top", zoom = 1.5 }: ShotCropProps) {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) throw new Error(`Schermata sconosciuta: ${id}`);
  return (
    <div className="crop" aria-hidden="true">
      {SCREEN_THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
        <img
          key={theme}
          className={`shot-${theme}`}
          src={screenSrc(id, theme)}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ width: `${zoom * 100}%`, objectPosition: position }}
        />
      ))}
    </div>
  );
}
