# Categorie: icone/colori + gestione completa — Design

Data: 2026-07-19
Stato: approvato, in attesa di piano di implementazione.

## Contesto

Deciso il 2026-07-19 (dopo il completamento della schermata Spese) di affrontare due follow-up rimandati durante il piano Spese: (1) una sezione Budget separata (oggi il budget-per-categoria vive dentro Spese e "prende troppo spazio"), (2) icone/colori per le categorie di spesa. Questo documento copre il secondo punto, scelto come primo sotto-progetto perché più piccolo e propedeutico (Budget vorrà mostrare le categorie con le loro icone).

Oggi le categorie sono gestite solo da seed automatico (`DEFAULT_CATEGORIES` in `lib/db/schema/categories.ts`, seminate da `databaseHooks.user.create.after` alla creazione utente): nessuna UI di creazione/modifica/eliminazione, solo lettura (`GET /api/categories`). Questo design introduce gestione completa (CRUD) più icona/colore personalizzabili, ricalcando il pattern già validato per i conti (`lib/validation/accounts.ts`, `account-avatar.tsx`, `account-icon-color-picker.tsx`).

## Decisioni prese durante il brainstorming

- Icona/colore **personalizzabili** dall'utente (non solo default fissi) → richiede un picker, come per i conti.
- Insieme all'icona/colore, **gestione completa categorie** (crea/rinomina/elimina), non solo icona/colore su categorie esistenti.
- La UI di gestione vive in una **pagina dedicata e indipendente da Budget** (`/categorie`), consegnabile in questo sotto-progetto senza aspettare il design della sezione Budget.
- **Nessuna nuova voce in sidebar**: la pagina è raggiungibile da un link "Gestisci categorie" nell'header di Spese (e in futuro Budget).
- Eliminazione categoria con transazioni/budget collegati: **riassegna a "Da categorizzare"** (non blocca), poi elimina il budget associato e la categoria.
- Palette icone **dedicata alle spese** (non lo stesso set dei conti), ma **stessi 8 colori** dei conti per coerenza tema.

## Modello dati

Migration su `categories` (`lib/db/schema/categories.ts`). Coerente con `lib/db/schema/accounts.ts` (dove `color`/`icon` sono già `text` con default, validati solo a livello Zod, non enum Postgres): niente `pgEnum` nuovo, stesso pattern.

```ts
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    color: text("color").notNull().default("slate"),
    icon: text("icon").notNull().default("package"),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("categories_user_name_unique").on(table.userId, table.name)]
);
```

`isFallback`: true solo per la categoria "Da categorizzare" seminata dal seed. Non esposto/editabile via API pubblica (solo settato dal seed), usato come guardia sull'eliminazione. Non basarsi sul nome stringa per riconoscerla (il nome è rinominabile), da qui la necessità del flag.

Backfill per utenti già esistenti (categorie create prima di questa feature, senza color/icon/isFallback): mapping per nome esatto contro `DEFAULT_CATEGORIES`, poi default `package`/`slate`/`isFallback=false` per tutto il resto (categorie custom che un utente avesse eventualmente già, ipotesi non applicabile oggi visto che non esiste ancora creazione manuale, ma la migration deve essere comunque totale/non fallire su righe impreviste):

| Nome (seed) | icon | color | isFallback |
|---|---|---|---|
| Affitto | home | slate | false |
| Bollette & casa | zap | yellow | false |
| Abbonamenti | tv | purple | false |
| Spesa alimentare | shopping-cart | green | false |
| Ristoranti | utensils | orange | false |
| Altro | package | slate | false |
| Svago | film | teal | false |
| Trasporti | car | blue | false |
| Da categorizzare | help-circle | red | true |

`DEFAULT_CATEGORIES` in `categories.ts` va esteso con `icon`/`color` letterali corrispondenti, così il seed per i nuovi utenti applica direttamente questi valori (nessuna migration necessaria per utenti creati dopo il deploy).

## Palette

**Colori** (`CATEGORY_COLORS`, in un nuovo `lib/validation/categories.ts`): stessi 8 valori di `ACCOUNT_COLORS` — `slate, blue, green, yellow, purple, orange, red, teal`.

**Icone** (`CATEGORY_ICONS`, 28, tutte verificate presenti in `lucide-react`):
`utensils, shopping-cart, home, zap, droplet, wifi, tv, smartphone, car, bus, plane, fuel, film, gamepad-2, music, heart, stethoscope, dumbbell, graduation-cap, baby, paw-print, shirt, scissors, gift, briefcase, wrench, package, help-circle`.

**Refactor condiviso**: la mappa colore→classi Tailwind (`bg`/`fg` per ciascuno dei valori di `ACCOUNT_COLORS`/`CATEGORY_COLORS`, identici) oggi vive solo dentro `account-avatar.tsx` (`COLOR_MAP`). Va estratta in `components/domain/shared/color-swatches.ts` (`SWATCH_COLORS` + `COLOR_SWATCH_MAP`), riusata sia da `account-avatar.tsx` che dal nuovo `category-avatar.tsx`, invece di duplicare la stessa mappa bg/fg due volte. `account-avatar.tsx` viene aggiornato per importare da lì (nessun cambio di comportamento visibile).

## API

Route esistente `app/api/categories/route.ts` (solo `GET` oggi) e nuova `app/api/categories/[id]/route.ts`:

- `GET /api/categories` — invariata nel contratto, i nuovi campi (`color`, `icon`, `isFallback`) compaiono automaticamente nella risposta.
- `POST /api/categories` — crea categoria. Body: `{ name, type, icon?, color? }` (icon/color opzionali, default `package`/`slate` se omessi). Validazione Zod: `name` non vuoto, unique per utente (409 se duplicato), `type` in `["fissa","variabile"]`, `icon`/`color` negli enum.
- `PATCH /api/categories/[id]` — rinomina / cambia `type` / `icon` / `color`. Ownership check (categoria deve appartenere all'utente autenticato, altrimenti 404 — stesso pattern IDOR-safe già usato per transazioni/conti). `isFallback` non accettato in input (ignorato o 400 se presente).
- `DELETE /api/categories/[id]` — ownership check. Se `isFallback === true` → 409 con messaggio ("la categoria di fallback non può essere eliminata"). Altrimenti, in una transazione DB: (1) tutte le transazioni con questo `categoryId` vengono riassegnate alla categoria `isFallback` dell'utente, (2) il budget collegato (se esiste) viene eliminato, (3) la categoria viene eliminata.

## Componenti

Nuova cartella `components/domain/categories/` con barrel `index.ts`:

- `category-avatar.tsx` — icona Lucide su cerchio colorato, mirror di `account-avatar.tsx` ma con `ICON_MAP` sulle 28 icone spese e colori da `COLOR_SWATCH_MAP` condiviso.
- `category-icon-color-picker.tsx` — popover selezione colore/icona, mirror di `account-icon-color-picker.tsx` (stessa struttura, dataset diverso).
- `category-row.tsx` — riga della pagina gestione: `CategoryAvatar` cliccabile (apre picker), nome editabile inline (onBlur commit, stesso pattern validazione di `category-breakdown.tsx`), select tipo fissa/variabile, bottone elimina con `AlertDialog` di conferma (disabilitato, con tooltip esplicativo, se `isFallback`).
- `add-category-form.tsx` — form "+ Nuova categoria" (nome + tipo; icona/colore restano ai default finché non aperti dal picker dopo la creazione).

Altri file toccati:

- `lib/validation/categories.ts` (nuovo) — `CATEGORY_ICONS`, `CATEGORY_COLORS`, tipi `CategoryIcon`/`CategoryColor`, schemi Zod per create/update.
- `lib/queries/categories.ts` — aggiunta `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation` (stesso pattern di `lib/queries/budgets.ts`).
- `app/(app)/categorie/page.tsx` (nuova) — orchestrazione: lista `CategoryRow` + `AddCategoryForm`, nessuna logica di business nella pagina.
- `app/(app)/spese/page.tsx` — aggiunto link "Gestisci categorie" → `/categorie` nell'header.
- `components/domain/expenses/category-breakdown.tsx` — ogni riga mostra `CategoryAvatar` (16px) accanto al nome categoria.
- `components/domain/expenses/transaction-row.tsx` — `SelectValue` del select categoria mostra `CategoryAvatar` + nome invece del solo nome.
- `components/domain/accounts/account-avatar.tsx` — importa `COLOR_SWATCH_MAP` da `components/domain/shared/color-swatches.ts` invece di definire `COLOR_MAP` localmente.

## Edge case

- Rename a un nome già usato dallo stesso utente → 409, messaggio "Categoria già esistente".
- Cambio `type` di una categoria con transazioni storiche → nessun blocco: il motore di calcolo (`lib/calc/expenses.ts`) legge `category.type` al momento del calcolo, nessuna migrazione dati richiesta.
- `isFallback` è read-only via API; solo il seed lo imposta a `true` per "Da categorizzare".
- Eliminazione con budget collegato: budget cancellato nella stessa transazione DB della riassegnazione transazioni, mai lasciato orfano.
- Rinominare la categoria fallback resta permesso (solo l'eliminazione è bloccata) — utile in vista di i18n futura.

## Testing

- **Unit**: validazione Zod (`name` vuoto, `type` invalido, `icon`/`color` fuori enum).
- **Integration**: `POST`/`PATCH`/`DELETE` con ownership cross-utente (pattern già in uso per transazioni/conti — vedi nota su IDOR nel changelog GoCardless/Spese); `DELETE` con transazioni collegate verifica la riassegnazione a `isFallback`; `DELETE` su categoria `isFallback` → 409.
- **Component**: cambio icona/colore dal picker si riflette nell'avatar; rename on-blur in `category-row.tsx`; creazione da `add-category-form.tsx`.

## Fuori scope (esplicitamente rimandato)

- Sezione Budget separata (secondo sotto-progetto, non ancora brainstormato).
- Colori delle categorie usati nei grafici di Spese (oggi il donut "Fisse vs variabili" non è per-categoria; un eventuale grafico per-categoria è materia del design della pagina Budget).
- i18n dei nomi categoria (fuori scope finché l'infrastruttura i18n non esiste, vedi CLAUDE.md).
