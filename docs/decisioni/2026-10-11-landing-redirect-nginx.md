# 2026-10-11 — Redirect della landing senza porta interna

Dall'esportazione di Search Console: i redirect delle cartelle (`/guide` → `/guide/`) uscivano dal nginx della landing con `:3000` nell'URL, e `/funzioni/` dava 403.
Scelta: `absolute_redirect off`, slash finale tolto con un 301 (`/funzioni/` → `/funzioni`), `try_files` senza listing di cartelle.
Il `noindex` segnalato da Google riguarda le pagine legali in bozza (oggi indicizzabili) e il login dell'app (voluto); `www` → apice e `/login` → app restano redirect voluti.
