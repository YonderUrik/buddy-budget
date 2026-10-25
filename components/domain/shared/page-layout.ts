/**
 * Page layout shared by every app screen, so titles, back button and blocks line up the same way on every page and
 * the layout follows the room the page really has (window minus sidebar), not the window width.
 *
 * - `PAGE_FRAME`: the one page column. Same width, padding and rhythm everywhere; a screen with narrower content keeps
 *   this frame and narrows its blocks with `PAGE_READABLE`, so its left edge never moves.
 * - `PAGE_SPLIT` + `PAGE_SPLIT_MAIN` / `PAGE_SPLIT_SIDE`: the main 3/5 + 2/5 split under a page's opening. The split
 *   uses container queries on the scrolling `<main>` (`@container/main` in `AppShell`): two columns only when the
 *   content area is at least 56rem wide, whatever the sidebar takes.
 * - `PAGE_BLEED`: a hero chart (or a banded list) reaching the screen edges on the phone; from the sidebar breakpoint on it stays
 *   inside the page column (bleeding there would run it into the sidebar islands).
 */
export const PAGE_FRAME = "mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6";

/** Added to `PAGE_FRAME` on screens that read better narrow (forms, help): every block stays within 48rem, left-aligned. */
export const PAGE_READABLE = "*:max-w-3xl";

/** Two-column area under a page's opening: stacked until the content area is 56rem wide. */
export const PAGE_SPLIT = "grid min-w-0 grid-cols-1 items-start gap-10 @4xl/main:grid-cols-5";

/** Wide column of `PAGE_SPLIT` (three fifths). */
export const PAGE_SPLIT_MAIN = "flex min-w-0 flex-col gap-10 @4xl/main:col-span-3";

/** Narrow column of `PAGE_SPLIT` (two fifths). */
export const PAGE_SPLIT_SIDE = "flex min-w-0 flex-col gap-10 @4xl/main:col-span-2";

/** Hero charts and banded lists: edge to edge on the phone, inside the page column from the sidebar breakpoint on. */
export const PAGE_BLEED = "-mx-4 sm:-mx-6 md:mx-0";
