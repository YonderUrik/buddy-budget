# Contribuire

Grazie dell'interesse. Il progetto è sviluppato da una persona sola: prima di scrivere codice per una modifica grande, apri una issue per parlarne.

## Prima di iniziare

- Partecipando accetti il [Codice di condotta](CODE_OF_CONDUCT.md).
- Le regole di architettura (layer dei componenti, osservabilità, design token, job in background) sono in [`CLAUDE.md`](CLAUDE.md). Valgono anche per chi non usa un assistente AI.
- Interfaccia e documentazione sono in italiano; i messaggi di commit e le issue possono essere anche in inglese.

## Flusso

1. Forka il repository e crea un branch dedicato.
2. Avvia l'ambiente seguendo il [README](README.md#avvio-in-locale).
3. Prima di aprire la PR: `pnpm lint`, `pnpm test`, `pnpm exec tsc --noEmit`.
4. Una modifica allo schema richiede `pnpm db:generate` e la migration committata. Non si modifica il database a mano.
5. Compila il modello della PR: dì cosa cambia per chi usa l'app e come l'hai verificato.
6. Il titolo della PR segue i Conventional Commits (`feat: …` nuova funzione, `fix: …` correzione, `chore:`/`docs:` senza effetto sulla versione): da lì release-please calcola la versione. Vedi [docs/rilasci.md](docs/rilasci.md).

## Convenzioni in breve

- Colori, font e raggi vengono solo dai token in `app/globals.css`, mai valori hardcoded.
- Il codice server non usa `console.*`: si logga con `lib/observability`, senza dati personali (email, IBAN, importi, descrizioni).
- La logica di calcolo vive in `lib/calc/` come funzioni pure, con test.
- L'interfaccia deve restare accessibile (tastiera, etichette, contrasto, movimento ridotto): la checklist è in [`ACCESSIBILITY.md`](ACCESSIBILITY.md).
- Una nuova funzione si aggiunge a `lib/features/catalog.ts`.

## Licenza dei contributi

Contribuendo accetti che il tuo contributo sia rilasciato con la stessa licenza del progetto (AGPL-3.0, vedi [`LICENSE`](LICENSE)).
