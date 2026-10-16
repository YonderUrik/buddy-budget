# Card animation in Categorizza

Date: 2026-10-11

Before, the decided card vanished and the next one appeared abruptly, and it was not clear what had happened. Now the next card already sits below the active one, still and non-interactive, and the new card rises from there: the transition is continuous. The decided card exits in the direction of the choice (right if confirmed, left if another category is chosen) starting from where it was released, and passes over the new one; if skipped it goes down to the bottom of the deck, passing underneath. With «Annulla» ("Undo") the card comes back in from the side it left.

Exit in 280 ms with a decelerating curve, entry with `SPRING_SOFT`, no light effects; with `prefers-reduced-motion` only the fades remain (`MotionConfig reducedMotion="user"`). The active card stays mounted and resets its own state at every card change, so `AnimatePresence` can animate the exit.
