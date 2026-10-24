# Compact bottom bar while scrolling (2026-10-24)

Daniele asked for the phone bottom bar to take less room once the user starts scrolling. The floating capsule now
drops from 64 to 48 px and folds its labels away (icons stay, 48 px is still a full touch target) while the page
scrolls down, and grows back on a 16 px scroll up, at the top of the page and on every page change, like the iOS 26
tab bar. The logic is a pure function (`lib/navigation/compact-on-scroll.ts`, tested); the bounce at the bottom edge
changes nothing. After the first video Daniele asked for a smoother movement and a more transparent «Liquid Glass» bar: the size now follows one 280 ms iOS-like ease (the sheets' curve) with the labels fading and blurring out, and the capsule is a translucent glass (theme tokens `--glass*`) over a blurred, more saturated page, opaque where `backdrop-filter` is missing. Reduced motion swaps the animation for an instant change. The capsule also keeps clear of the side safe areas, and the mobile top bar pads below the notch/camera cutout (as already done in the native-app PR). The content keeps the full bar's bottom space,
so nothing jumps. Same behaviour in the browser and in the Capacitor app (safe area unchanged). No new signal: no new
action or outcome to observe.
