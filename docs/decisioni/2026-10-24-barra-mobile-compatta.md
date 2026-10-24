# Compact bottom bar while scrolling (2026-10-24)

Daniele asked for the phone bottom bar to take less room once the user starts scrolling. The floating capsule now
drops from 64 to 48 px and folds its labels away (icons stay, 48 px is still a full touch target) while the page
scrolls down, and grows back on a 16 px scroll up, at the top of the page and on every page change, like the iOS 26
tab bar. The logic is a pure function (`lib/navigation/compact-on-scroll.ts`, tested); the bounce at the bottom edge
changes nothing; reduced motion swaps the spring for an instant change. The content keeps the full bar's bottom space,
so nothing jumps. Same behaviour in the browser and in the Capacitor app (safe area unchanged). No new signal: no new
action or outcome to observe.
