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
 * Movimento dei fogli sotto `sm`: entrata con la curva dei fogli di iOS (parte veloce e si posa piano), uscita più breve.
 * Lo usano sia il pannello sia il suo sfondo, così si muovono insieme.
 */
const SHEET_MOTION_CLASS =
  "max-sm:duration-[280ms] max-sm:ease-[cubic-bezier(0.32,0.72,0,1)] max-sm:data-closed:duration-200"

/**
 * Classi comuni dei fogli dal basso sotto `sm`: agganciati al fondo, angoli arrotondati solo in alto, spazio per la
 * maniglia e per la barra di sistema dell'iPhone, entrata e uscita scorrendo dal basso (senza dissolvenza).
 * `fill-mode-forwards` in chiusura tiene il pannello fuori schermo fino a quando viene tolto dalla pagina: senza, per un
 * istante tornerebbe al suo posto (il «flash» alla chiusura).
 */
const SHEET_CLASS = `max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pt-7 ${SHEET_MOTION_CLASS} max-sm:data-open:slide-in-from-bottom-full! max-sm:data-open:zoom-in-100! max-sm:data-open:fade-in-100! max-sm:data-closed:slide-out-to-bottom-full! max-sm:data-closed:zoom-out-100! max-sm:data-closed:fade-out-100! data-closed:fill-mode-forwards data-swiped:animate-none!`

/**
 * Classi comuni dello sfondo scuro di dialog, conferme e popover: dissolvenza con la stessa durata del pannello, che resta
 * trasparente fino a quando viene tolto (prima finiva prima del foglio e tornava scuro per un istante), e sfocatura solo
 * da `sm` in su (sul telefono costa e non si vede).
 */
const SHEET_BACKDROP_CLASS = `duration-100 sm:supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:fill-mode-forwards ${SHEET_MOTION_CLASS}`

export { SheetHandle, SHEET_BACKDROP_CLASS, SHEET_CLASS }
