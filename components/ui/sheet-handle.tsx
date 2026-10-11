"use client"

import { cn } from "@/lib/utils"

/**
 * Maniglia dei fogli dal basso (solo sotto `sm`): la barretta in cima al pannello da cui si trascina giù per chiudere
 * (vedi `attachSheetSwipe`). Va dentro un pannello `fixed` o `relative`.
 */
function SheetHandle({ className }: { className?: string }) {
  return (
    <div
      data-sheet-drag=""
      aria-hidden="true"
      className={cn("absolute inset-x-0 top-0 z-10 flex h-6 touch-none justify-center pt-2.5 sm:hidden", className)}
    >
      <span className="h-1 w-9 rounded-full bg-border" />
    </div>
  )
}

/**
 * Classi comuni dei fogli dal basso sotto `sm`: agganciati al fondo, angoli arrotondati solo in alto, spazio per la
 * maniglia e per la barra di sistema dell'iPhone, entrata e uscita scorrendo dal basso.
 */
const SHEET_CLASS =
  "max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pt-7 max-sm:duration-200 max-sm:data-open:slide-in-from-bottom-full! max-sm:data-open:zoom-in-100! max-sm:data-closed:slide-out-to-bottom-full! max-sm:data-closed:zoom-out-100! data-swiped:animate-none!"

export { SheetHandle, SHEET_CLASS }
