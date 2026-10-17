/**
 * Page title styles shared by every screen: the tall condensed display face (the same as the landing and the login),
 * light weight and tight leading. `PAGE_TITLE` carries the default size; `PAGE_TITLE_FACE` is only the face, for titles
 * that set their own size (the Panoramica greeting, a goal name).
 */
export const PAGE_TITLE_FACE = "font-display font-light leading-[0.95] text-foreground";

/** Default page title: face plus size, for a plain `<h1>` at the top of a screen. */
export const PAGE_TITLE = `${PAGE_TITLE_FACE} text-[2.5rem] sm:text-[2.75rem]`;

/** Section title inside a screen (the heading next to a section's icon, a simulator, a step): same face, smaller. */
export const SECTION_TITLE = `${PAGE_TITLE_FACE} text-[1.75rem]`;
