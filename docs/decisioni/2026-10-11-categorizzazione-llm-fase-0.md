# Categorizzazione con LLM (Jev): piano e Fase 0

- **Decisione (2026-10-11)**: la categorizzazione si ricostruisce attorno a Jev (`typesafe/jev-1.13` su OpenRouter), un classificatore che restituisce una probabilità per ogni categoria. Ogni proposta va confermata dall'utente; scegliere una categoria non crea una regola (solo con «Ricorda per questo esercente»); le regole passate si eliminano in una fase finale (export, backup, dry-run, conferma digitata); le categorie già assegnate restano. Piano completo: Claude Doc «Categorizzazione con LLM: piano di sviluppo».
- **Fase 0 (questa PR)**: client Jev (`lib/llm/jev.ts`, richiesta con ZDR e senza importi/identificativi), metriche di valutazione e script locale `pnpm eval:categorization` (`extract` + `run`). Nessun cambio al comportamento dell'app.
- **Da fare prima della Fase 1**: eseguire lo script sui propri movimenti, confermare per iscritto la non conservazione dei dati da parte di Jev (API in alpha), scegliere la soglia di confidenza.
- **Rimandato**: ricerca web (Jev non cerca), cache fra utenti, pagina Categorizza rivista (Fase 2).
- **Nessun impatto sulla landing**; nessun nuovo segnale in produzione (script solo locale).
