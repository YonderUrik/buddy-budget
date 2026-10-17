# 2026-10-17 — The landing in English under /en, with a demo button

**Decision.** Ahead of the international launch, buddybudget.io gets a real English version under `/en`: home, `/en/security`, `/en/features`, `/en/features/investments` and `/en/screens`. The Italian pages stay at the root, unchanged apart from the new demo button. Two root layouts (`app/(it)/layout.tsx` with `lang="it"`, `app/en/layout.tsx` with `lang="en" data-screens="en"` so the screenshots follow the page language once #409 is in); the 404 moved to `app/global-not-found.tsx` (`experimental.globalNotFound`) because there is no shared root layout any more. English copy is written for the page (`content/en/`, `content/ui.ts`, `content/screen-text.ts`, `en` texts in `lib/features/catalog.ts`), not translated line by line.

**SEO.** Every page pair sets canonical and hreflang it/en with `x-default` on English (international visitors are the new audience; Italian browsers find the Italian page through hreflang); og:locale en_US with it_IT as alternate; the sitemap lists the English URLs with their alternates; `llms.txt` has an «In English» section.

**Switching.** «IT / EN» in the nav, phone menu and footer goes to the same page in the other language. The Italian home shows a dismissible navy bar «This page is also available in English» to browsers that don't prefer Italian (decided before paint, no layout shift, dismissal in localStorage). No automatic redirect: the visitor chooses.

**Demo.** «Prova la demo» / «Try the demo» next to «Inizia gratis» in the opening and the closing (also on content pages), pointing to the app's public `/demo` (`?lang=en` from English pages). Umami: `demo_click {location, lang}`, `language_switch_click {from, to, location}`, `language_hint_dismissed`, and `lang` on `cta_click`.

**Italian only, labelled as such.** Calculators (`/strumenti/*`), guides, Privacy, Terms, Cookies and the 404. **Deferred:** an English OG image, English calculators and legal pages, the app reading `?lang=en` on sign-in links (today the app proposes the browser language by itself), German pages.
