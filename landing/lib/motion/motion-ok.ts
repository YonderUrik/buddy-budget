/** Media query under which animations run: with `prefers-reduced-motion: reduce` the page stays still and readable. Kept apart from `gsap.ts` so a small component can read it without loading GSAP. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
