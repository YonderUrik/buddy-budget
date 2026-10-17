# 2026-10-17 — Smooth rolling numbers

Rolling amounts (`AnimatedNumber`, NumberFlow) looked stuck for a moment, mostly on the decimals. Two causes: NumberFlow rolls digits by animating a registered CSS custom property, which runs on the main thread, so the roll froze while the page rendered the new data and then jumped; and its fade is sized for the big digits, so next to the small muted decimals the digits above and below stayed visible for most of its 900 ms tail.

Decided: the new value reaches NumberFlow only when the main thread is idle (`useSettledValue`, at most 300 ms later), rolls and widths use `SPRING_SOFT` (about 530 ms, within the "numbers under 600 ms" rule), and each decimal digit gets its own fade mask. No change to callers.
