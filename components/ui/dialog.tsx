"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { animateFromOrigin, trackDialogOrigins } from "@/lib/motion/dialog-origin"
import { attachSheetSwipe, clickSheetClose, isSheetViewport } from "@/lib/motion/sheet"
import { SHEET_CLASS, SheetHandle } from "@/components/ui/sheet-handle"

trackDialogOrigins()

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
  )
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
  )
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/** Come si presenta il dialog sul telefono: foglio dal basso (default) o a tutto schermo (form lunghi, vedi `FormDialogContent`). */
type DialogMobileLayout = "sheet" | "fullscreen"

const MOBILE_CLASS: Record<DialogMobileLayout, string> = {
  sheet: `max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[92dvh] max-sm:overflow-y-auto max-sm:px-4 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] ${SHEET_CLASS}`,
  fullscreen:
    "max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:duration-200 max-sm:data-open:slide-in-from-bottom-6! max-sm:data-open:zoom-in-100! max-sm:data-closed:slide-out-to-bottom-6! max-sm:data-closed:zoom-out-100!",
}

/**
 * Pannello del dialog. Da `sm` in su è una finestra centrata che cresce dall'elemento che l'ha aperta (vedi
 * `animateFromOrigin`); sul telefono è un foglio dal basso che si chiude anche trascinandolo giù, oppure a tutto schermo
 * con `mobileLayout="fullscreen"`.
 */
function DialogContent({
  className,
  ref,
  mobileLayout = "sheet",
  children,
  ...props
}: DialogPrimitive.Popup.Props & { mobileLayout?: DialogMobileLayout }) {
  // Ref a callback: scatta quando il pannello entra nel DOM, cioè all'apertura (il componente esiste anche da chiuso).
  const popupRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
      if (!node) return
      if (mobileLayout === "sheet") attachSheetSwipe(node, () => clickSheetClose(node))
      // `data-origin-animation="none"` per i pannelli con una propria animazione; sul telefono entrano dal basso.
      if (node.dataset.originAnimation !== "none" && !isSheetViewport()) animateFromOrigin(node)
    },
    [ref, mobileLayout]
  )
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={popupRef}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-6 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          MOBILE_CLASS[mobileLayout],
          className
        )}
        {...props}
      >
        {mobileLayout === "sheet" && (
          <>
            <SheetHandle />
            <DialogPrimitive.Close data-sheet-close="" hidden tabIndex={-1} aria-hidden="true" />
          </>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5 text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-lg font-semibold text-foreground leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      {...props}
    />
  )
}

export type { DialogMobileLayout }
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
