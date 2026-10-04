# CI più veloce con molti merge ravvicinati

Data: 2026-10-04

Misurato sui run veri: la check dell'app durava ~165 s, di cui ~90 s di test (un file alla volta, su un Postgres reale). Ora lint e tipi girano in un job a parte e i test si dividono in 2 shard con un database ciascuno; la check obbligatoria "Lint, tipi e test" resta, come riepilogo dei tre job. Gli screenshot della landing non si rigenerano più a ogni merge (5 run da ~3 minuti in un'ora, più la CI della PR del bot): partono ogni giorno, se cambiano elenco screen/script/dati demo, o a mano. Proposte che toccano il flusso di merge o il deploy (merge queue, concurrency dei run su `main`, saltare la CI sul commit di release, decision log per file) restano da decidere: vedi il report nel thread.
