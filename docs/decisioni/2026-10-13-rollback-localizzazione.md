# Rollback della localizzazione (#361)

- Su richiesta dell'utente viene ritirata la localizzazione introdotta dalla PR #361: interfaccia e comportamento tornano al prodotto italiano precedente, senza selettori paese/lingua né moduli tedeschi attivi.
- La migration additiva 0036 e i campi paese/lingua restano nello schema, inutilizzati, per preservare dati e cronologia delle migration eventualmente già applicate. Nessun DROP e nessuna modifica diretta al database di produzione.
- Conservate solo due correzioni di build indipendenti: costanti finanziarie senza dipendenze dal database nei componenti browser e rimozione dell'export non supportato dalla route auto-categorized.
- Il successivo lavoro non pubblicato su registro paesi/inflazione tedesca resta nel branch `codex/germany-inflation`; non viene integrato da questo rollback. Riprendere la localizzazione solo dopo nuova verifica e richiesta dell'utente.
