import type { ScreenId } from "@/content/screens";
import manifest from "@/public/screens/manifest.json";

/** Dimensioni di ripiego, quelle della finestra di cattura (1280×800 a 1,5x). */
const DEFAULT_SIZE = { width: 1920, height: 1200 } as const;

export interface ScreenSize {
  width: number;
  height: number;
}

/**
 * Dimensioni in pixel dell'immagine intera di una schermata, lette dal manifest della cattura: servono a riservare lo
 * spazio (niente salti di layout) e alla camera della home, che ragiona in pixel dello screenshot.
 */
export function screenSize(id: ScreenId): ScreenSize {
  const entry = (manifest.screens as { id: string; width?: number; height?: number }[]).find((s) => s.id === id);
  return entry?.width && entry.height ? { width: entry.width, height: entry.height } : DEFAULT_SIZE;
}

/** Dimensioni delle versioni a misura di telefono (`-phone.jpg`): viewport del telefono per la densità di cattura. */
export const PHONE_SHOT_SIZE: ScreenSize = { width: manifest.phone.width * manifest.phoneScale, height: manifest.phone.height * manifest.phoneScale };
