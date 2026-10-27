# Accessibility

BuddyBudget aims to be usable by anyone, including with a keyboard, screen reader, zoom or reduced motion. This document says where we stand, without promising more than has been verified.

## Goal and status

- **Goal**: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA for the app (`app.buddybudget.io`) and for the landing page (`buddybudget.io`).
- **Status**: it is a goal, **not a certified conformance**. No external audit or full screen reader check has been carried out.
- Last review of this document: 2026-10-10.

## What is there today

Verified by reading the code, not through an audit:

- **Components**: the primitives in `components/ui/` are shadcn on [Base UI](https://base-ui.com/), which handles roles, ARIA states, focus trapping and closing with `Esc` in dialogs, menus, popovers, selects and sliders.
- **Visible focus**: buttons and controls have a `focus-visible` style (ring with the `ring` token).
- **Language**: the page declares `lang` from the user's language (`it`, `en` or `de`).
- **Main content**: `<main id="main-content">` can receive programmatic focus.
- **Labels**: controls without text (icons) use `aria-label`; screen-reader-only text uses `sr-only`; decorations are `aria-hidden`.
- **Theme**: light and dark, with colors from tokens in `app/globals.css`. Income and expenses also have a sign and text, not just color.
- **Reduced motion**: animations (rolling numbers, changing text, the sign-in chart) respect `prefers-reduced-motion`: the Motion provider uses `reducedMotion="user"` and the most eye-catching components stay still.
- **Mobile**: bottom navigation bar and «Altro» ("More") menu with touch targets of at least 44 px in the main places (`min-h-11`).
- **Hidden amounts**: the «nascondi importi» ("hide amounts") button is a toggle with exposed state.
- **Charts**: Recharts with `accessibilityLayer`, at least in the net worth chart.

## Known limitations

Things we do **not** know to be fine, or that we know are missing:

- There is no visible «Vai al contenuto» ("Skip to content") link: `main` is ready to receive it, but the link does not exist yet.
- A full pass with VoiceOver, NVDA, JAWS or TalkBack has never been done.
- Token contrast has not been systematically measured in both themes (in particular `text-2`/`text-3` and text on tinted backgrounds).
- Charts convey data mostly visually: not all of them have a table or an alternative text summary.
- Drag & drop (e.g. the categories board): it has not been verified that a complete keyboard alternative exists.
- 200% zoom and reflow at 320 px have not been checked on all screens.
- There are no automated accessibility tests in CI (neither axe nor Lighthouse); ESLint only applies the `jsx-a11y` rules included in `eslint-config-next`.
- Linked external pages (e.g. the bank consent flow, Google sign-in) depend on third parties.

## Reporting a problem

If something is not usable, say so: it is a defect to fix, not a request for a favor.

- From the app: the **Aiuto** ("Help") page (`/aiuto`), choose the report type.
- On GitHub: [open an issue](https://github.com/YonderUrik/buddy-budget/issues/new/choose) and write "accessibility" in the title, with the browser, device and assistive technology used.
- By email: support@buddybudget.io.

Say which page, what you wanted to do and what happened. Accessibility reports have the same priority as bugs.

## For contributors

Every PR that changes the interface checks these points (they are also in the PR template):

1. **Keyboard**: everything can be reached and used with `Tab`, `Shift+Tab`, `Enter`, `Space`, arrows and `Esc`; focus order follows visual order; focus is always visible and never gets trapped.
2. **Names and roles**: every control has an accessible name (visible text or `aria-label`); native elements (`button`, `a`, `label`) are used before a `div` with `role`; headings follow a sensible hierarchy.
3. **Contrast**: text at least 4.5:1 (3:1 for large text and components), in light **and** dark theme; use only theme tokens. Never color alone to convey meaning (green/red → also sign or text).
4. **Reduced motion**: every new animation stops or simplifies with `prefers-reduced-motion` (`useReducedMotion` or `MotionConfig`).
5. **Touch targets**: targets of at least 24×24 px (WCAG 2.2, 2.5.8), preferably 44 px on mobile.
6. **Errors and states**: form errors associated with the field (`aria-describedby`/`aria-invalid`), dynamic updates announced (`role="status"`/`aria-live`) when needed.
7. **Charts and images**: a text alternative (key value, table or description); decorative images `alt=""`/`aria-hidden`.
8. **Zoom and reflow**: no horizontal scrolling at 320 px and at 200% zoom.
9. **Screen reader**: for changes touching main flows, a test with VoiceOver (macOS/iOS), NVDA (Windows) or TalkBack (Android), noted in the PR. If it was not done, say so.

### Recommended tools

- The [axe DevTools](https://www.deque.com/axe/devtools/) extension or the Lighthouse Accessibility tab in Chrome.
- Keyboard-only navigation and 200% zoom.
- VoiceOver (`Cmd+F5`), NVDA, TalkBack.
- Emulation of `prefers-reduced-motion` and `prefers-color-scheme` in the developer tools.
- Contrast checkers (e.g. [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)).

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Base UI](https://base-ui.com/)
- [Adding an accessibility page to a repository (GitHub)](https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions/adding-an-accessibility-page-to-your-repository)
