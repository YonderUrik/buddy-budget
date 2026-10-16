# Importa operazioni (Import operations): new flow and copy

Date: 2026-10-09

The «Importa operazioni» dialog (Investimenti) is redesigned in the style of Panoramica and Liquidità: open sections with tinted icon, large numbers, no grey boxes. No parser or calculation has changed; presentation, copy and order of information change.

- **Path**: File → Anteprima → Strumenti → Conferma (File → Preview → Instruments → Confirm), always with the same names (previously the second step switched between «Colonne» and «Controllo»). On phone «Passo 2 di 4» ("Step 2 of 4") with a segmented bar, because the labels did not fit.
- **Broker choice**: list of rows (not cards) and, below the chosen row, numbered instructions to export the file (`exportSteps` and `note` in `providers.ts`, instead of `howTo`). The choice stays optional: the format is also recognized from the file.
- **Errors**: `lib/investments/import/messages.ts` rewrites the parsers' messages («Riga 225: amount non valido» → «Alla riga 225 il campo «importo» non contiene un valore valido» ("At row 225 the «importo» field does not contain a valid value") + what to do); the original message remains as «Dettaglio tecnico» ("Technical detail"). Unknown messages pass through unchanged, without invented suggestions.
- **Instruments**: `describeChoice` describes the state (already yours, new linked automatically, to check, broker prices because in another currency, not found, sources unreachable). Instruments that need attention are at the top with search already open; for the others the change is on request.
- **Confirmation and after**: numbers highlighted, rows to fix with their explanation, and when the import is complete «Cosa è successo» ("What happened") and «Cosa fare ora» ("What to do now") with links to Operazioni and (for Trade Republic) to Liquidità.

Choices among alternatives: errors are at the top of the content and are scrolled into view (not at the bottom, where on phone they shrank the scrollable area); rows skipped on purpose (e.g. bollo, stamp duty) are grouped by reason, those to fix listed one by one; the broker choice stays in the first step instead of becoming a step of its own, to keep four steps.

Postponed: moving the choice of destination portfolio for the other brokers too, summary with total amounts per currency, import of several Fineco files together. Before/after screenshots in the project, folder `investimenti-import-flusso`.

## Import management (same PR)

At the user's request («sembra messa lì a caso», "it looks like it was put there at random") the section in Operazioni is redesigned: no longer a collapsed «Gestisci importazioni» with two identical buttons for each row, but an «Importazioni» ("Imports") section that is always visible.

- **List**: grouped by broker; each row has period covered, upload date, details (positions, cash movements) and state (Importato, N avvisi — "Imported, N warnings" — or the state of the personal CSV). After six rows «Mostra tutte» ("Show all"). It lives in `import-history.ts` (pure, tested) and `import-history-list.tsx`.
- **Actions**: removed «Aggiorna CSV» ("Update CSV": it only opened the dialog, without saying what it did); now a single «Importa un file» ("Import a file") and a sentence explaining that a more recent file replaces the overlapping periods. «Elimina» ("Delete") remains per row.
- **Delete confirmation** (`import-delete-dialog.tsx`): «Viene eliminato» ("Will be deleted") with the list of uploads involved (including later ones of the same account) and «Resta com'è» ("Stays as is"), with an explicit button («Elimina 2 importazioni», "Delete 2 imports"). Deletion logic unchanged.
- **Riparti da zero** ("Start from scratch") moved into «Opzioni avanzate» ("Advanced options"), without a box and with the button no longer solid red.

Postponed: number of operations per import and a view of what it contains (they require an extension of the `/api/investments/statements` API), undo of the last import.

## Simplification (user request)

Removed «Altro CSV» ("Other CSV") from the broker list, the downloadable template, the «incolla il contenuto» ("paste the content") field and the repeated sentences (preview, import list). In their place, at the top of the first step, a «Novità» ("What's new") panel that leads to «Crea il tuo formato con l'AI» ("Create your format with AI", `/importazioni`). An unrecognized CSV still goes through column mapping: it is no longer presented as a choice, but remains as a fallback.
