/**
 * The glass of «Cerca», as macOS and iOS Spotlight: the page shows through, blurred, and a crisp edge, a light on the
 * top edge and a deep shadow keep the panel apart from it. Tokens in `app/globals.css` (`--spotlight*`), both themes.
 */

/** Desktop capsule and round filter buttons: translucent over a strong blur (opaque where backdrop-filter is missing). */
export const SPOTLIGHT_GLASS =
  "border border-spotlight-edge bg-popover shadow-[inset_0_1px_0_var(--spotlight-highlight),0_40px_100px_-24px_var(--spotlight-shadow),0_12px_32px_-12px_var(--spotlight-shadow)] supports-backdrop-filter:bg-spotlight supports-backdrop-filter:backdrop-blur-[44px] supports-backdrop-filter:backdrop-saturate-[1.8]";

/** Phone: the page behind blurred until only its colours are left, like the home screen under iOS Spotlight. */
export const SPOTLIGHT_COVER =
  "bg-background supports-backdrop-filter:bg-background/35 supports-backdrop-filter:backdrop-blur-[40px] supports-backdrop-filter:backdrop-saturate-[1.6]";

/** Phone cards and field over that cover: the same glass, without a second blur (one is enough, and cheaper). */
export const SPOTLIGHT_CARD =
  "border border-spotlight-edge bg-spotlight shadow-[inset_0_1px_0_var(--spotlight-highlight),0_10px_30px_-14px_var(--spotlight-shadow)]";
