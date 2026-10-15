# Bottom sheets on mobile for popovers, dialogs and confirmations

Date: 2026-10-11

On phone (below `sm`, 640px) popovers, dialogs and confirmations are no longer anchored or centred windows to scroll: they open as a full-width bottom sheet, with a dark backdrop, a handle and closing by dragging down (or tapping outside). It is the default behaviour of `PopoverContent`, `DialogContent` and `AlertDialogContent`, so it applies throughout the app without touching the callers; from `sm` up nothing changes. Long forms remain full screen (`FormDialogContent` passes `mobileLayout="fullscreen"`). Panels that on desktop open below the row (Dividi, editing a transaction) use `InlineOrSheet`: inline from `sm` up, sheet on phone. The gesture is in `lib/motion/sheet.ts`.

Postponed: dropdown menus (`DropdownMenu`) and `Select` stay anchored to the button; the Categorizza cards and the «Quanto rischia» ("How much it risks") card were not touched (work in progress in other threads).
