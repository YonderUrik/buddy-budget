# Animazione delle carte in Categorizza

Data: 2026-10-11

Prima la carta decisa spariva e la successiva compariva di colpo, e non si capiva cosa fosse successo. Ora la carta esce nella direzione della scelta (a destra se confermata, a sinistra se si sceglie un'altra categoria) e passa sopra la nuova; se saltata scende in fondo al mazzo, passando sotto. La carta successiva sale dal mazzo, che si intravede sotto quella attiva, e con «Annulla» la carta tolta torna da davanti.

Uscita in 260 ms, entrata con `SPRING_SOFT`, nessun effetto di luce; con `prefers-reduced-motion` restano solo le dissolvenze (`MotionConfig reducedMotion="user"`). La carta attiva resta montata e azzera il proprio stato a ogni cambio di carta, così `AnimatePresence` può animare l'uscita.
