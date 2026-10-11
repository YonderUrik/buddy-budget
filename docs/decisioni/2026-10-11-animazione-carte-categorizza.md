# Animazione delle carte in Categorizza

Data: 2026-10-11

Prima la carta decisa spariva e la successiva compariva di colpo, e non si capiva cosa fosse successo. Ora sotto la carta attiva c'è già la successiva, ferma e non interattiva, e la nuova carta sale da lì: il passaggio è continuo. La carta decisa esce nella direzione della scelta (a destra se confermata, a sinistra se si sceglie un'altra categoria) partendo dal punto in cui la si è lasciata, e passa sopra la nuova; se saltata scende in fondo al mazzo, passando sotto. Con «Annulla» la carta rientra dal lato da cui era uscita.

Uscita in 280 ms con una curva che rallenta, entrata con `SPRING_SOFT`, nessun effetto di luce; con `prefers-reduced-motion` restano solo le dissolvenze (`MotionConfig reducedMotion="user"`). La carta attiva resta montata e azzera il proprio stato a ogni cambio di carta, così `AnimatePresence` può animare l'uscita.
