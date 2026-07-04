# Schermata Conti (v1)

**Data**: 2026-07-04
**Stato**: approvato

## Contesto

Design system, layout shell e autenticazione sono completi (vedi log decisioni in `CLAUDE.md`). Questa è la prima schermata di dominio reale dell'app. `docs/functional-spec.md` (sezione 2, "Conti") definisce già cosa il mockup fa e le decisioni per il prodotto reale; questo spec le traduce in un design tecnico implementabile.

## Cosa questo spec copre

- API (Route Handlers) per CRUD conti, scoped per utente
- Layer di data fetching/mutation client (TanStack Query, nuova dipendenza)
- Validazione input (Zod, nuova dipendenza)
- Componenti UI in `components/domain/accounts/` e pagina `app/(app)/conti/page.tsx`
- Gestione conti "Auto" (sola lettura + azione "Scollega") accanto ai conti manuali
- Stati vuoto/caricamento/errore, conferma su azioni distruttive
- Strategia di testing

## Cosa NON copre (fuori scope)

- **Integrazione bancaria reale** (Open Banking/PSD2): resta fuori scope per intero. I conti "Auto" nella v1 non hanno alcun modo di essere creati automaticamente — la UI per gestirli (badge, sola lettura, "Scollega") viene costruita in anticipo, pronta per quando un'integrazione reale esisterà, ma nel frattempo un conto "Auto" può esistere solo se inserito manualmente nel DB (es. per test).
- **KPI "Patrimonio netto"**: rimandato a quando esistono le entità Investimenti, Debiti e Immobile. La v1 mostra "Patrimonio netto (solo liquidità)" come sostituto esplicitamente etichettato, per non promettere una cifra che non è ancora reale.
- Ricerca/paginazione/filtri sulla lista conti: non necessari al volume atteso (pochi conti per utente).
- Modifica di banca/tipo per conti Auto: restano derivati dalla fonte, non modificabili (solo "Scollega").

---

## 1. Modello dati

Nessuna modifica allo schema. `lib/db/schema/accounts.ts` copre già tutti i campi necessari:

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | text, FK → `auth_user.id`, cascade | |
| `name` | text, not null | |
| `institution` | text, nullable | usato per iniziali visualizzate in UI |
| `type` | text, not null | testo libero; UI propone una select con opzioni comuni + input libero |
| `balance` | numeric(12,2), not null, default 0 | |
| `source` | enum `manuale` / `auto`, default `manuale` | |
| `created_at` / `updated_at` | timestamp | |

Le iniziali mostrate in UI (es. "BN" per "Banca Nazionale") sono derivate client-side da `institution` (o da `name` se `institution` è vuoto) — non serve una colonna dedicata.

## 2. API — Route Handlers

Pattern seguito: `app/api/user/onboarding/route.ts` (sessione via `auth.api.getSession`, scoping per `userId`, nessun trust sui dati del body oltre l'id di sessione).

**`app/api/accounts/route.ts`**
- `GET`: lista conti dell'utente autenticato, ordinati per `createdAt` ascendente. 401 se non autenticato.
- `POST`: crea conto manuale (`source` sempre `manuale`, non impostabile dal client). Valida body con Zod (`createAccountSchema`). 400 su validazione fallita, 401 su sessione mancante.

**`app/api/accounts/[id]/route.ts`**
- `PATCH`: aggiorna `name`/`institution`/`type`/`balance`. Se il conto è `source: auto`, rifiuta con 403 (nessun campo modificabile su un conto Auto — solo l'eliminazione/scollega è permessa). Verifica che il conto appartenga all'utente (404 altrimenti, non 403, per non rivelare l'esistenza di conti altrui).
- `DELETE`: elimina il conto (usato sia per "elimina conto manuale" sia per "scollega conto auto" — stessa operazione lato dati, wording diverso solo in UI). Verifica ownership.

Validazione condivisa in `lib/validation/accounts.ts` (Zod), usata sia nei Route Handlers sia (stessi schema) per la validazione client prima dell'invio.

## 3. Data layer client — TanStack Query

Nuova dipendenza (`@tanstack/react-query`), da aggiungere: era già prevista nell'architettura di `2026-07-03-tech-stack-architecture-design.md` ma non ancora installata.

- `QueryClientProvider` montato in `app/layout.tsx` (root, sopra `ThemeProvider`).
- `lib/queries/accounts.ts`:
  - `useAccountsQuery()` → `GET /api/accounts`
  - `useCreateAccountMutation()` → `POST /api/accounts`, invalida la query lista al successo
  - `useUpdateAccountMutation()` → `PATCH /api/accounts/:id`, invalida la query lista
  - `useDeleteAccountMutation()` → `DELETE /api/accounts/:id`, invalida la query lista

Nessun optimistic update per la v1: la lista è piccola, un refetch dopo mutazione è istantaneo (YAGNI — si introduce ottimistic update solo se la latenza percepita diventa un problema reale).

## 4. Componenti UI

Layer `domain` (logica di dominio, compone primitive `ui`), pagina in `app/(app)/conti/`.

- **`components/domain/accounts/accounts-kpi.tsx`** — 2 card KPI: "Liquidità totale" (somma balance), "Patrimonio netto (solo liquidità)" (stesso valore, etichetta esplicita), calcolate client-side con `useMemo` dalla lista già in cache. Conteggio "Conti collegati" come terzo valore (numero di righe).
- **`components/domain/accounts/account-row.tsx`** — riga singola: iniziali istituto, nome, "banca · tipo", badge Auto/Manuale (`components/ui/badge.tsx` già esistente), saldo formattato secondo `authUser.currency` (`Intl.NumberFormat`). Conto manuale → nome/istituto/tipo/saldo editabili inline (salvataggio `onBlur` se il valore è cambiato ed è valido). Conto Auto → campi in sola lettura, bottone "Scollega" al posto del salvataggio inline.
- **`components/domain/accounts/add-account-form.tsx`** — form "+ Aggiungi conto": nome, istituto (opzionale), tipo (select + libero), saldo iniziale. Submit → `useCreateAccountMutation`.
- **`components/ui/alert-dialog.tsx`** — nuovo, da aggiungere via `pnpm dlx shadcn@latest add alert-dialog`. Riusato per conferma su "elimina conto manuale" e "scollega conto auto".
- **`app/(app)/conti/page.tsx`** — orchestra: `useAccountsQuery`, rendering KPI + lista + form, stati loading/error/empty. Nessuna logica di business qui (solo composizione), coerente con la regola di `CLAUDE.md` su file di route.

## 5. Stati e validazione

- **Loading**: skeleton per le righe conto (no spinner a pagina intera).
- **Empty** (nessun conto): messaggio esplicativo sopra il form "+ Aggiungi conto", che resta comunque visibile e utilizzabile.
- **Errore** (fetch o mutation fallita): banner inline con testo errore + azione "Riprova". Nessun sistema di toast globale (non presente nello stack; da valutare se emerge un bisogno trasversale in più schermate).
- **Validazione**: saldo/importi accettano sia virgola che punto come separatore decimale, convertiti prima dell'invio; nome non vuoto; tipo non vuoto (da select o libero). Stessa validazione Zod lato client (feedback immediato, prima della chiamata di rete) e lato server (fonte di verità, non bypassabile).
- **Conferma obbligatoria** (via `alert-dialog`) prima di: eliminare un conto manuale, scollegare un conto Auto. Stesso componente, testo diverso.

## 6. Testing

- **Unit**: schema Zod di `lib/validation/accounts.ts` (casi validi/invalidi: saldo negativo permesso o no, nome vuoto, tipo vuoto); funzione di calcolo KPI (`accounts-kpi`).
- **Integration**: Route Handlers con DB reale, pattern già in uso in `lib/db/integration.test.ts` — copre: 401 senza sessione, scoping per utente (un utente non vede/modifica conti di un altro), CRUD completo su conto manuale, rifiuto di `PATCH` su conto Auto (403), `DELETE` funzionante sia su manuale che su auto.
- **E2E**: non previsto per questa fase (nessun framework E2E nello stack attuale).

## Implicazioni per fasi successive

- Quando Investimenti/Debiti/Immobile esisteranno, il calcolo "Patrimonio netto" reale sostituirà l'attuale "(solo liquidità)" — probabilmente in un motore di calcolo condiviso (vedi `docs/functional-spec.md`, sezione "Implicazioni per il modello dati reale"), non ricalcolato localmente in questa schermata.
- Quando arriverà un'integrazione bancaria reale, il flusso di creazione dei conti "Auto" (oggi assente) andrà definito: questo spec garantisce solo che la UI di consumo (badge, sola lettura, scollega) sia già pronta.
