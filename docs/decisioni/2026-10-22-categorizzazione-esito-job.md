# Categorizzazione AI: completamento reale e filtro esercenti

Il pulsante manuale rispondeva sempre `started`; il client cercava di dedurre la fine dall'arrivo di proposte. Con soli nomi bloccati dal filtro privacy il server terminava senza chiamare il modello, ma la pagina restava «In corso» per quattro minuti.

La richiesta avvia ora un job per utente su Redis (TTL 24 ore), deduplicato atomicamente fra schede e pod. La stessa route espone lo stato autenticato: fine, errore e contatori reali, anche senza proposte. Il client interroga solo i job attivi, riprende lo stato al ritorno sulla pagina e comunica l'esito zero invece di un successo fittizio. Heartbeat e limite assoluto rendono ritentabili le esecuzioni interrotte; un callback precedente non può sovrascrivere un nuovo job o riaprire quello concluso.

Il filtro riconosce Ticketraus e parole commerciali specifiche (hostel, pizza, burger, baklava, museo, mobilità), normalizzando accenti e apostrofi. Non considera PayPal una prova di attività: nomi personali ambigui e bonifici restano bloccati. Alcune ditte individuali resteranno volutamente da categorizzare a mano. Nessuna modifica alla soglia di applicazione automatica, né migration.

Ambito deliberato: l'indicatore rimane in Categorizza, con stato recuperabile dopo navigazione/ricaricamento. L'indicatore globale dello standard dei job è rimandato per tenere questa correzione fuori dal layout condiviso. Nessun impatto sul catalogo o sui messaggi della landing; gli screenshot ordinari restano aggiornati dal workflow giornaliero.

Verifica: test di filtro, runner, store Redis e route autenticata, inclusi tutti bloccati, fallimento parziale, isolamento utente, click concorrenti e callback obsoleti. Build di produzione e verifica browser con soli dati sintetici: `docs/testing/categorization-ai-2026-10-22/README.md`.

In produzione: cercare `categorization.ai.generate.requested`, `categorization.ai.skipped` e `categorization.ai.generation.finished`/`failed` correlati da request/job. Con soli bloccati l'esito deve essere `nothing_to_do`, count zero e nessuna richiesta al modello; il pulsante torna disponibile al primo poll. Le metriche `buddybudget_categorization_ai_requests_total`/suggerimenti continuano a contare soltanto il lavoro reale; Umami registra avvio ed esito (`ai_suggestions_generate_finished`) con soli contatori, mai testi o identificativi personali.
