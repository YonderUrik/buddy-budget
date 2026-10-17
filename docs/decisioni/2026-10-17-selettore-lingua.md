# Language chooser with flags and preview (2026-10-17)

Daniele chose variant C of three mockups, adding flags. The language is no longer a native `<select>`: one `LanguageSelect` (`components/domain/locale/`) shows the current flag and language and opens a list (popover on desktop, bottom sheet on the phone) with flag, name in its own language and a preview of today's date and an amount in that language. Languages not available for the chosen country stay visible but greyed out («Disponibile col paese Germania»).

- Sign-in: the chooser moved from next to the logo to the end of the footer links (cookie only, as before).
- Onboarding and Impostazioni › Aspetto e uso: «Paese» and «Lingua» are two normal settings rows (country uses the app `Select` with a flag); in onboarding they now sit after the currency cards.
- Flags are inline SVGs (`Flag`), because emoji flags show as two letters on Windows; English uses the British flag, matching the en-GB formats.
- Umami: `language_changed` with `from` (login/settings) and `language`.

Deferred: a language chooser on the landing (it is Italian only today).
