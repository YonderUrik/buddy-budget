/** Open Base UI popups that the Android back button should close before leaving the page (dialogs, sheets, menus, lists). */
const OPEN_LAYER_SELECTOR = ['[role="dialog"][data-open]', '[role="alertdialog"][data-open]', '[role="menu"][data-open]', '[role="listbox"][data-open]'].join(", ");

/**
 * Closes the topmost open popup the same way the Escape key does, and returns true; false when nothing is open.
 * The Android back button calls it first, so a sheet closes instead of the app going to the previous page.
 */
export function closeTopLayer(root: Pick<Document, "querySelectorAll" | "activeElement"> = document): boolean {
  const layers = root.querySelectorAll<HTMLElement>(OPEN_LAYER_SELECTOR);
  const top = layers[layers.length - 1];
  if (!top) return false;
  const target = root.activeElement && top.contains(root.activeElement) ? (root.activeElement as HTMLElement) : top;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  return true;
}
