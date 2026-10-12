# 2026-10-12 — Errori del browser registrati senza servizi esterni

Fino a oggi l'app non aveva `error.tsx` né `global-error.tsx`: una pagina che si rompeva mostrava l'errore generico di Next e non lasciava traccia. Ora le schermate dell'app hanno una pagina d'errore con «Riprova» e «Segnala questo problema», e ogni errore va a `POST /api/client-errors`, che lo scrive nei log (`client.error.reported`, livello `error`) e nella metrica `buddybudget_client_errors_total{kind,area,outcome}`.

Scelte: niente Sentry o GlitchTip per ora. Sentry cloud manderebbe fuori gli errori di un'app finanziaria, Sentry self-host chiede 16 GB e GlitchTip circa 0,5 GB sulla VPS. Si manda solo l'area (primo segmento del percorso, enum chiuso), mai il percorso intero, e il messaggio passa dalla redazione del logger. Niente stack trace, perché senza source map è illeggibile. Limite di 20 errori ogni 10 minuti per utente. La route richiede la sessione, quindi gli errori della pagina di login non arrivano.

Rimandati: GlitchTip, se gli errori diventano tanti da dover essere raggruppati; source map. Analisi completa: https://claude.ai/code/artifact/85881df9-9aa1-43b9-88f4-6b75499ab133
