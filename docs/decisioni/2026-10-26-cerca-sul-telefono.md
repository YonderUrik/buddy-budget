# «Cerca» on the phone: field at the top, window back in place (2026-10-26)

Data: 2026-10-26

After #517 Daniele reported that on the phone «Cerca» still jumped a lot and sometimes broke the whole layout, leaving parts of the page out of view and no way to scroll.

- Cause: the field sat at the bottom, above the keyboard. To show it there iOS scrolls the window, and the panel followed the visible area through `visualViewport` one frame late, so it jumped while typing. When the keyboard closed (above all after a pick, which removes the focused field) iOS could leave the window scrolled; since only `<main>` scrolls (`overflow: hidden` on html and body), the user could not bring the top bar and the hidden part back.
- On the phone the field is now at the top of the sheet, where the keyboard never covers it, so iOS never has to move the page. Only the list's bottom padding follows the keyboard. The cover and the field take no drags, and the list always scrolls itself instead of the page. Closing blurs the field at once.
- The shell keeps the window at the top (`useWindowAtTop`): whenever it moved and no text field is focused, it goes back to 0,0. This also covers the «Aggiungi» forms and every other field that opens the keyboard.
- Not reproducible in Chromium (no iOS keyboard): checked with a simulated keyboard and a window scrolled by hand; the iPhone check comes after the release.
