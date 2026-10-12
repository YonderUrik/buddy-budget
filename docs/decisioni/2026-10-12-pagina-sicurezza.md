# Pagina «Sicurezza e privacy» e consenso AI spento di default (2026-10-12)

- **Perché**: chi ha provato l'app non si fida a collegare la banca e chiede garanzie sulla privacy.
- **Decisione**: nuova pagina pubblica `/sicurezza` sulla landing (percorso dei dati con diagramma interattivo, cosa si salva e cosa no, controlli, limiti detti apertamente, fonti ufficiali: PSD2, RTS SCA, GoCardless SAS/ACPR n. 17118, GDPR, Cloudflare R2). Testi in `landing/content/security.ts`, verificati nel codice e nel repo infra il 2026-10-12. Il diagramma e i fatti con fonte stanno anche nella sezione Sicurezza della home (chi non apre la pagina li vede lo stesso). Linkata da menu, piè di pagina, home, nota del login e flusso «Collega banca».
- **Regola**: niente promesse non dimostrabili (cifratura end-to-end o del disco, audit, certificazioni, rate limit su Redis). Il punto sul codice aperto compare solo con `NEXT_PUBLIC_SOURCE_URL`.
- **Consenso AI nell'onboarding**: ora spento di default (prima acceso), perché un consenso non può essere pre-selezionato (art. 7 GDPR) e l'informativa dice già «spento finché non lo scegli».
- **Evento Umami**: `security_node_selected` (landing), `cta_click` con `location: "sicurezza"`.
- **Rimandati**: SSH solo con chiave, ruolo DB di sviluppo con accesso ai dati di produzione, `security.txt`, eliminazione per inattività in `execute`.

Aggiunta dello stesso giorno: due sezioni in `/sicurezza`, «Cosa tiene GoCardless» (cosa conserva, per cosa lo usa, con chi lo condivide, tempi, dove, cosa succede se scolleghi), riassunta dalle condizioni UE (art. 4) e dall'informativa privacy di GoCardless, e «Statistiche d'uso» (cosa conta Umami e cosa non riceve mai). GoCardless non pubblica un numero di anni di conservazione: la pagina lo dice invece di inventarlo.

Semplificazione (stesso giorno, feedback dei tester: «troppe informazioni»): in home restano solo diagramma, tre fatti con fonte e il link; in `/sicurezza` restano in vista diagramma e tabella, il resto (GoCardless, statistiche, cancellazione, limiti) sta in quattro domande a tendina. Il codice aperto non è più presentato come argomento di sicurezza.
Codice aperto: tolti dalla home il blocco «Codice aperto» e il fatto nella testata (a chi non è tecnico «il codice è pubblico» suona come una porta aperta); resta il link in fondo alla chiusura. Il repository resta pubblico: segreti e chiavi non sono nel codice e l'accesso alle banche è in sola lettura.
