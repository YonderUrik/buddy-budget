import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
import type { SwatchColor } from "@/lib/validation/shared-colors";

/**
 * Assegna un colore a ciascun id categoria (nell'ordine passato, tipicamente createdAt asc)
 * pescando dal pool di 48 colori senza ripetizioni finché possibile. Oltre i 48 elementi il
 * pool si ripete ciclicamente, ma non assegna mai lo stesso colore a due elementi adiacenti.
 */
export function distributeColors(categoryIds: string[]): Record<string, SwatchColor> {
  const assignment: Record<string, SwatchColor> = {};
  const poolSize = SWATCH_COLORS.length;
  let previousColor: SwatchColor | null = null;

  categoryIds.forEach((id, index) => {
    let color = SWATCH_COLORS[index % poolSize];
    if (color === previousColor) {
      color = SWATCH_COLORS[(index + 1) % poolSize];
    }
    assignment[id] = color;
    previousColor = color;
  });

  return assignment;
}
