# Paese del prodotto e lingua separati

- Profilo persistente con `productCountry` e `language`: Italia it/en, Germania de/en. Migration 0036 mantiene IT/it per gli account esistenti.
- Onboarding e Preferenze permettono la scelta; la lingua governa testi e formati, il paese governa le capacità finanziarie. Cataloghi sorgente in italiano con traduzioni inglesi e tedesche.
- Germania: disabilitati pensione/TFR, calcoli fiscali italiani, proventi previsionali, Analitiche/FIRE e inflazione italiana, con controlli su navigazione, proxy, API e caricamento dati. Costi e imposte realmente registrati restano disponibili.
- Cambiare paese o lingua non cancella né rinomina dati dell'utente. Solo le categorie iniziali durante l'onboarding ricevono nomi e descrizioni localizzati.
- Da integrare in seguito: modelli fiscali, previdenziali e inflazione per la Germania, con fonti e verifiche dedicate. Traduzione delle comunicazioni email e revisione delle informative legali sono lavori separati dalla lingua dell'interfaccia.
- Verifica: build di produzione, test combinazioni/capacità, guardie API, persistenza e categorie iniziali; catalogo landing sincronizzato. Verifica browser del prodotto DE in de/en, blocco pensione e passaggio a IT/en con ripristino dei moduli. Nessun deploy incluso.
