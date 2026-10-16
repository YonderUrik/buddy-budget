# Theme and «Nascondi importi» ("Hide amounts") move to the user menu (2026-10-10)

- Removed the button (sun/moon toggle) from the bottom of the sidebar and from the mobile header: it took up fixed space in two places.
- New «Tema» ("Theme") item in the avatar menu (desktop sidebar and mobile drawer) with submenu Chiaro · Scuro · Sistema (Light · Dark · System); the current choice is shown next to the item and exposed as a radio.
- Unchanged: «Altro» on mobile (bottom bar) and Impostazioni → Preferenze, which already had the three-way choice, and the `next-themes` logic (persistence in localStorage, «Sistema» follows the device, no flash on load).
- Landing and login do not use this component: not touched. `ThemeToggle` remains only in the style guide.
- New Umami event `theme_changed` (`choice`, `source`); `more_menu_clicked: tema` remains.
- Postponed: keyboard shortcut to change theme.
- Same for «Nascondi gli importi»: removed the eye button from the sidebar footer and from the mobile header (`PrivacyToggle` component removed), new checkable item in the avatar menu; the eye of the «Oggi» ("Today") summary and the row in «Altro» on mobile remain. Umami event `amounts_hidden_toggled`.
