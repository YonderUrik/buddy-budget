# Brand identity + PWA installabile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrare il brand BuddyBudget (logo del designer, palette navy/azzurro/giallo) in tutta l'app e renderla installabile come PWA su desktop/iOS/Android.

**Architecture:** Sostituzione dei valori dei design token CSS esistenti in `app/globals.css` (nessun nuovo token, nessuna nuova architettura), sostituzione degli asset logo/icona nei punti dove oggi compare un placeholder (`Wallet` lucide, lettera "B" testuale), aggiunta di `app/manifest.ts` (Next.js file convention) e metadata PWA in `app/layout.tsx`. Nessuna modifica a DB, API o logica di dominio.

**Tech Stack:** Next.js 16 App Router (file convention `app/manifest.ts`, `app/icon.svg`), Tailwind CSS v4 (`@theme inline` già esistente), asset SVG/PNG statici in `public/`.

**Spec:** `docs/superpowers/specs/2026-09-25-brand-identity-pwa-design.md`

## Global Constraints

- Nessun colore esadecimale o raggio hardcoded nei componenti: solo classi token/`var(--token)` (regola CLAUDE.md già in vigore) — gli hex nuovi vivono **solo** in `app/globals.css`.
- `--pos`/`--pos-soft`/`--neg`/`--neg-soft` restano invariati (semantici, non-brand).
- Nessun service worker, nessuna cache offline, nessun wrapper nativo store — solo manifest + icone.
- Font invariati (Space Grotesk / Hanken Grotesk).
- JSDoc minimo su ogni componente toccato, coerente con lo stile esistente nel file.
- Contrasto testo/sfondo almeno AA (4.5:1 per testo normale) su ogni coppia foreground/background introdotta o modificata.
- Il file `Archive.zip` nella root del repo (consegna del designer, untracked in git) va eliminato a fine Task 1 una volta estratti gli asset necessari — non va committato.

## Review Focus

- **Contrasto testo su superficie**: `--sidebar-foreground` su `--sidebar` navy, `--primary-foreground` su `--primary` azzurro, `--accent-foreground` su `--accent` giallo-soft, in entrambi i temi — un colore scelto "a occhio" può scendere sotto AA e rendere illeggibili menu/bottoni.
- **Icona PWA mancante o rotta**: se un path in `manifest.ts` non corrisponde a un file realmente copiato in `public/icons/`, l'installazione PWA fallisce silenziosamente (nessun errore visibile in UI, solo prompt "Aggiungi a Home" assente) — verificare che ogni path referenziato esista su disco prima di committare.
- **Sidebar navy anche in tema chiaro**: è un cambio di comportamento esplicito (prima la sidebar era chiara in tema chiaro) — un elemento che assumeva sidebar chiara (es. `border-sidebar-border` pensato per essere sottile su sfondo chiaro) potrebbe risultare invisibile o troppo tenue su navy; verificare visivamente hover/active/focus state di ogni voce nav in entrambi i temi.
- **Componente `LoginStory`/`AuthLayout`**: usa `primary-foreground` per quasi tutto il testo del pannello sinistro, assumendo che `--primary` resti uno sfondo sufficientemente scuro/saturo da ospitare testo bianco-quasi-puro — con `--primary` ora azzurro (`#187E98`/`#219EBC`, più chiaro del verde bosco precedente) va controllato che `--primary-foreground` resti leggibile (bianco puro `#FFFFFF` scelto apposta nella spec per questo).
- **Favicon multi-formato**: `app/icon.svg` convive con `app/favicon.ico` preesistente — se un browser richiede `favicon.ico` e Next non lo serve più perché la convention `icon.svg` lo sostituisce silenziosamente, va verificato che entrambi restino raggiungibili (nessuna rimozione del file `.ico` in questo piano, per non rompere client legacy).

---

## Mappa file

**Nuovi:**
- `public/brand/logo-full-navy.svg`, `public/brand/logo-full-white.svg`, `public/brand/logo-mark.svg` — asset logo statici
- `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png` — icone PWA
- `app/icon.svg` — favicon Next.js (Next lo serve automaticamente su `/icon.svg`, convention route)
- `app/manifest.ts` — manifest PWA (Next.js file convention, servito su `/manifest.webmanifest`)

**Modificati:**
- `app/globals.css` — token colore `:root`/`.dark`
- `components/layout/sidebar.tsx` — logomark al posto della lettera "B" testuale (righe 249-261)
- `components/layout/mobile-topbar.tsx` — logomark accanto al testo brand
- `app/(auth)/layout.tsx` — logomark al posto dell'icona `Wallet` (righe 1, 11-16, 40-43)
- `app/layout.tsx` — `viewport`/`themeColor` export, `apple-touch-icon` link

**Rimossi:** nessuno (asset esistenti come `app/favicon.ico` restano, come da Review Focus sopra).

---

### Task 1: Estrazione asset logo

**Files:**
- Create: `public/brand/logo-full-navy.svg`, `public/brand/logo-full-white.svg`, `public/brand/logo-mark.svg`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`
- Delete: `Archive.zip` (root repo, untracked)

**Interfaces:**
- Consumes: nessuna (primo task).
- Produces: i 6 file sopra, referenziati per path esatto da tutti i task successivi.

- [ ] **Step 1: Estrarre lo zip in una cartella temporanea**

```bash
mkdir -p /tmp/bb-logos
unzip -o Archive.zip -d /tmp/bb-logos
find /tmp/bb-logos -type f | grep -v __MACOSX
```

Verificare che l'output includa (tra gli altri):
- `Logo/Source/SVG/buddy budget-01.svg` (wordmark navy)
- `Logo/Source/SVG/buddy budget-02.svg` (logomark "B", 378×464 viewBox)
- `Logo/Source/SVG/buddy budget-03.svg` (wordmark bianco su navy)
- `App Icon/Android/android_192.png`, `android_512.png`
- `App Icon/iOS/ios_180.png`

- [ ] **Step 2: Copiare e rinominare gli asset SVG**

```bash
mkdir -p public/brand public/icons
cp "/tmp/bb-logos/Logo/Source/SVG/buddy budget-01.svg" public/brand/logo-full-navy.svg
cp "/tmp/bb-logos/Logo/Source/SVG/buddy budget-03.svg" public/brand/logo-full-white.svg
cp "/tmp/bb-logos/Logo/Source/SVG/buddy budget-02.svg" public/brand/logo-mark.svg
```

- [ ] **Step 3: Copiare le icone PNG**

```bash
cp "/tmp/bb-logos/App Icon/Android/android_192.png" public/icons/icon-192.png
cp "/tmp/bb-logos/App Icon/Android/android_512.png" public/icons/icon-512.png
cp "/tmp/bb-logos/App Icon/iOS/ios_180.png" public/icons/apple-touch-icon.png
```

- [ ] **Step 4: Verificare i file copiati**

```bash
ls -la public/brand public/icons
file public/icons/icon-512.png
```

Expected: `icon-512.png` riporta dimensioni 512x512 (o vicine — l'output di `file` su PNG mostra "PNG image data, 512 x 512" o simile); tutti e 6 i file esistono e hanno dimensione > 0.

- [ ] **Step 5: Rimuovere lo zip e la cartella temporanea**

```bash
rm -f Archive.zip
rm -rf /tmp/bb-logos
```

- [ ] **Step 6: Commit**

```bash
git add public/brand public/icons
git commit -m "chore(brand): aggiungi asset logo e icone PWA dal pacchetto designer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Nota: `Archive.zip` era untracked, la sua rimozione da disco non produce nulla da committare per quel file.

---

### Task 2: Token colore brand in `globals.css`

**Files:**
- Modify: `app/globals.css:62-155` (blocco `:root`)
- Modify: `app/globals.css:157-249` (blocco `.dark`)

**Interfaces:**
- Consumes: nessuno.
- Produces: nuovi valori per `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` — nomi dei token invariati, solo i valori esadecimali/rgba cambiano. Ogni componente che già consuma questi token (tutta l'app, essendo su Tailwind `@theme inline`) li eredita senza modifiche al proprio codice.

- [ ] **Step 1: Sostituire il blocco `:root` (righe 62-155)**

Sostituire l'intero blocco `:root { ... }` con:

```css
:root {
  /* Design token brand BuddyBudget (palette light) — vedi docs/superpowers/specs/2026-09-25-brand-identity-pwa-design.md */
  --background: #f6f8fa;
  --foreground: #0f0f3f;
  --text-2: #4a4d73;
  --text-3: #8083a3;
  --card: #ffffff;
  --card-foreground: #0f0f3f;
  --popover: #ffffff;
  --popover-foreground: #0f0f3f;
  --primary: #187e98;
  --primary-foreground: #ffffff;
  --secondary: #e9edf2;
  --secondary-foreground: #0f0f3f;
  --muted: #e9edf2;
  --muted-foreground: #4a4d73;
  --accent: rgba(255, 183, 3, 0.14);
  --accent-foreground: #8a5a00;
  --destructive: #b0473b;
  --border: #dde2e9;
  --input: #dde2e9;
  --ring: #187e98;
  --pos: #2f7d57;
  --pos-soft: rgba(47, 125, 87, 0.1);
  --neg: #b0473b;
  --neg-soft: rgba(176, 71, 59, 0.09);
  --chart-1: #1f5141;
  --chart-2: #2f7d57;
  --chart-3: #41705f;
  --chart-4: #739688;
  --chart-5: #b6c4bc;
  --group-dovuta: #dc2626;
  --group-voluta: #d97706;
  --group-futuro: #16a34a;
  --group-saltuaria: #2563eb;
  --group-uncategorized: #94a3b8;
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
  --swatch-pink: #ec4899;
  --swatch-indigo: #6366f1;
  --swatch-cyan: #06b6d4;
  --swatch-lime: #84cc16;
  --swatch-amber: #f59e0b;
  --swatch-rose: #f43f5e;
  --swatch-violet: #8b5cf6;
  --swatch-emerald: #10b981;
  --swatch-slate-light: #cbd5e1;
  --swatch-blue-light: #93c5fd;
  --swatch-green-light: #86efac;
  --swatch-yellow-light: #fde047;
  --swatch-purple-light: #d8b4fe;
  --swatch-orange-light: #fdba74;
  --swatch-red-light: #fca5a5;
  --swatch-teal-light: #5eead4;
  --swatch-pink-light: #f9a8d4;
  --swatch-indigo-light: #a5b4fc;
  --swatch-cyan-light: #67e8f9;
  --swatch-lime-light: #bef264;
  --swatch-amber-light: #fcd34d;
  --swatch-rose-light: #fda4af;
  --swatch-violet-light: #c4b5fd;
  --swatch-emerald-light: #6ee7b7;
  --swatch-slate-dark: #334155;
  --swatch-blue-dark: #1d4ed8;
  --swatch-green-dark: #15803d;
  --swatch-yellow-dark: #a16207;
  --swatch-purple-dark: #7e22ce;
  --swatch-orange-dark: #c2410c;
  --swatch-red-dark: #b91c1c;
  --swatch-teal-dark: #0f766e;
  --swatch-pink-dark: #be185d;
  --swatch-indigo-dark: #4338ca;
  --swatch-cyan-dark: #0e7490;
  --swatch-lime-dark: #4d7c0f;
  --swatch-amber-dark: #b45309;
  --swatch-rose-dark: #be123c;
  --swatch-violet-dark: #6d28d9;
  --swatch-emerald-dark: #047857;
  --radius: 11px;
  --sidebar: #0f0f3f;
  --sidebar-foreground: #ecedf7;
  --sidebar-primary: #219ebc;
  --sidebar-primary-foreground: #0f0f3f;
  --sidebar-accent: rgba(255, 255, 255, 0.08);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.1);
  --sidebar-ring: #219ebc;
}
```

Nota: `--text-2`/`--text-3` non erano nella spec originale con valori espliciti — qui derivati dalla stessa logica del set precedente (testo secondario/terziario, stessa tinta di `--foreground` schiarita), per restare coerenti col resto della palette navy senza introdurre una tinta estranea. `--chart-*`, `--group-*`, `--swatch-*` restano invariati (fuori scope: `--chart-*` non è referenziato da nessun componente, `--group-*`/`--swatch-*` sono palette semantiche/funzionali indipendenti dal brand, già trattate come tali nelle decisioni pregresse del progetto).

- [ ] **Step 2: Sostituire il blocco `.dark` (righe 157-249)**

Sostituire l'intero blocco `.dark { ... }` con:

```css
.dark {
  /* Design token brand BuddyBudget (palette dark) — vedi docs/superpowers/specs/2026-09-25-brand-identity-pwa-design.md */
  --background: #0f0f3f;
  --foreground: #ecedf7;
  --text-2: #a3a6c9;
  --text-3: #6f739c;
  --card: #171a4d;
  --card-foreground: #ecedf7;
  --popover: #1d2159;
  --popover-foreground: #ecedf7;
  --primary: #219ebc;
  --primary-foreground: #0f0f3f;
  --secondary: #1d2159;
  --secondary-foreground: #ecedf7;
  --muted: #1d2159;
  --muted-foreground: #a3a6c9;
  --accent: rgba(255, 183, 3, 0.18);
  --accent-foreground: #ffb703;
  --destructive: #d2887b;
  --border: #2a2e66;
  --input: #2a2e66;
  --ring: #219ebc;
  --pos: #7bb79b;
  --pos-soft: rgba(123, 183, 155, 0.14);
  --neg: #d2887b;
  --neg-soft: rgba(210, 136, 123, 0.14);
  --chart-1: #7bb79b;
  --chart-2: #5fb98a;
  --chart-3: #5b9280;
  --chart-4: #427060;
  --chart-5: #2f4940;
  --group-dovuta: #f87171;
  --group-voluta: #facc15;
  --group-futuro: #4ade80;
  --group-saltuaria: #60a5fa;
  --group-uncategorized: #64748b;
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
  --swatch-pink: #ec4899;
  --swatch-indigo: #6366f1;
  --swatch-cyan: #06b6d4;
  --swatch-lime: #84cc16;
  --swatch-amber: #f59e0b;
  --swatch-rose: #f43f5e;
  --swatch-violet: #8b5cf6;
  --swatch-emerald: #10b981;
  --swatch-slate-light: #cbd5e1;
  --swatch-blue-light: #93c5fd;
  --swatch-green-light: #86efac;
  --swatch-yellow-light: #fde047;
  --swatch-purple-light: #d8b4fe;
  --swatch-orange-light: #fdba74;
  --swatch-red-light: #fca5a5;
  --swatch-teal-light: #5eead4;
  --swatch-pink-light: #f9a8d4;
  --swatch-indigo-light: #a5b4fc;
  --swatch-cyan-light: #67e8f9;
  --swatch-lime-light: #bef264;
  --swatch-amber-light: #fcd34d;
  --swatch-rose-light: #fda4af;
  --swatch-violet-light: #c4b5fd;
  --swatch-emerald-light: #6ee7b7;
  --swatch-slate-dark: #334155;
  --swatch-blue-dark: #1d4ed8;
  --swatch-green-dark: #15803d;
  --swatch-yellow-dark: #a16207;
  --swatch-purple-dark: #7e22ce;
  --swatch-orange-dark: #c2410c;
  --swatch-red-dark: #b91c1c;
  --swatch-teal-dark: #0f766e;
  --swatch-pink-dark: #be185d;
  --swatch-indigo-dark: #4338ca;
  --swatch-cyan-dark: #0e7490;
  --swatch-lime-dark: #4d7c0f;
  --swatch-amber-dark: #b45309;
  --swatch-rose-dark: #be123c;
  --swatch-violet-dark: #6d28d9;
  --swatch-emerald-dark: #047857;
  --sidebar: #0b0b2e;
  --sidebar-foreground: #ecedf7;
  --sidebar-primary: #219ebc;
  --sidebar-primary-foreground: #0f0f3f;
  --sidebar-accent: rgba(255, 255, 255, 0.06);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: #219ebc;
}
```

- [ ] **Step 3: Verificare il contrasto delle coppie chiave (calcolo manuale, nessun tool grafico disponibile)**

Calcolare il rapporto di contrasto WCAG (luminanza relativa) per:
- `--primary-foreground` (`#ffffff`) su `--primary` chiaro (`#187e98`) → atteso ≥ 4.5:1
- `--sidebar-foreground` (`#ecedf7`) su `--sidebar` (`#0f0f3f`) → atteso ≥ 4.5:1 (praticamente bianco su navy quasi-nero, ampiamente sopra soglia)
- `--accent-foreground` chiaro (`#8a5a00`) su `--background` chiaro (`#f6f8fa`), assumendo il testo compaia su un badge con sfondo `--accent` composito su `--background` → atteso ≥ 4.5:1
- `--foreground` (`#0f0f3f`) su `--background` chiaro (`#f6f8fa`) → atteso ≥ 4.5:1 (quasi nero su quasi bianco, ampio margine)

Se un valore risulta sotto soglia, scurire/schiarire quel colore specifico (senza cambiare la tinta) finché non supera la soglia, poi ripetere lo Step 1 o 2 con il valore corretto.

- [ ] **Step 4: Verificare che il progetto compili**

```bash
pnpm tsc --noEmit
```

Expected: nessun errore (questo task non tocca codice TypeScript, solo CSS — il comando verifica che non ci siano regressioni accidentali).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(brand): sostituisci palette colori con brand navy/azzurro/giallo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Logomark in sidebar e topbar mobile

**Files:**
- Modify: `components/layout/sidebar.tsx:249-261`
- Modify: `components/layout/mobile-topbar.tsx:59-62`

**Interfaces:**
- Consumes: `public/brand/logo-mark.svg` (Task 1).
- Produces: nessuna nuova interfaccia pubblica — sostituzione visiva interna ai due componenti, nessuna prop nuova.

- [ ] **Step 1: Sostituire il monogramma testuale in `AppSidebar` (righe 249-261)**

In `components/layout/sidebar.tsx`, sostituire:

```tsx
        {isCollapsed ? (
          /* Monogramma quando collapsed */
          <span
            className="font-heading text-lg font-bold text-sidebar-primary"
            aria-label="BuddyBudget"
          >
            B
          </span>
        ) : (
          <span className="font-heading text-base font-bold text-sidebar-foreground truncate">
            BuddyBudget
          </span>
        )}
```

con:

```tsx
        {isCollapsed ? (
          <Image
            src="/brand/logo-mark.svg"
            alt="BuddyBudget"
            width={28}
            height={34}
            className="h-8 w-auto"
          />
        ) : (
          <span className="flex items-center gap-2 min-w-0">
            <Image
              src="/brand/logo-mark.svg"
              alt=""
              width={24}
              height={29}
              className="h-6 w-auto shrink-0"
              aria-hidden="true"
            />
            <span className="font-heading text-base font-bold text-sidebar-foreground truncate">
              BuddyBudget
            </span>
          </span>
        )}
```

`Image` da `next/image` è già importato in cima al file (riga 23). Le dimensioni `width`/`height` riflettono il rapporto d'aspetto reale del logomark (viewBox `378.1462 463.8719` ≈ 0.815:1).

- [ ] **Step 2: Sostituire il testo brand in `MobileTopbar` (righe 59-62)**

In `components/layout/mobile-topbar.tsx`, sostituire:

```tsx
      {/* Brand */}
      <span className="font-heading text-base font-bold text-sidebar-foreground">
        {brandName}
      </span>
```

con:

```tsx
      {/* Brand */}
      <span className="flex items-center gap-2 font-heading text-base font-bold text-sidebar-foreground">
        <Image
          src="/brand/logo-mark.svg"
          alt=""
          width={22}
          height={27}
          className="h-6 w-auto"
          aria-hidden="true"
        />
        {brandName}
      </span>
```

e aggiungere l'import in cima al file (dopo la riga 18 `import { Menu } from "lucide-react";`):

```tsx
import Image from "next/image";
```

- [ ] **Step 3: Verificare che il progetto compili**

```bash
pnpm tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Avviare il dev server e controllare visivamente**

```bash
pnpm dev
```

Aprire `/panoramica` (richiede login — se non disponibile in questo ambiente, verificare almeno che non ci siano errori console/build; la verifica visiva completa resta comunque a carico della verifica manuale utente finale). Controllare: sidebar espansa mostra logomark + "BuddyBudget", sidebar collassata mostra solo logomark leggibile su sfondo navy, topbar mobile (`<768px`) mostra logomark + testo.

- [ ] **Step 5: Commit**

```bash
git add components/layout/sidebar.tsx components/layout/mobile-topbar.tsx
git commit -m "feat(brand): logomark in sidebar e topbar mobile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Logomark nel pannello di login

**Files:**
- Modify: `app/(auth)/layout.tsx:1, 11-16, 40-43`

**Interfaces:**
- Consumes: `public/brand/logo-mark.svg` (Task 1).
- Produces: nessuna — sostituzione visiva interna.

- [ ] **Step 1: Rimuovere l'import di `Wallet` e aggiungere quello di `Image`**

In `app/(auth)/layout.tsx`, sostituire la riga 1:

```tsx
import { Wallet } from "lucide-react";
```

con:

```tsx
import Image from "next/image";
```

- [ ] **Step 2: Sostituire il badge icona nel pannello desktop (righe 11-16)**

Sostituire:

```tsx
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          {BRAND_NAME}
        </div>
```

con:

```tsx
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground p-1.5">
            <Image src="/brand/logo-mark.svg" alt="" width={24} height={29} className="h-full w-auto" aria-hidden="true" />
          </span>
          {BRAND_NAME}
        </div>
```

(il badge quadrato bianco `bg-primary-foreground` resta come cornice, il logomark a colori sostituisce l'icona `Wallet` monocromatica al suo interno — coerente col fatto che il logomark ha i propri colori e non usa `currentColor`.)

- [ ] **Step 3: Sostituire l'header mobile (righe 40-43, numerazione originale — dopo lo Step 2 sono shiftate di poche righe, cercare per contenuto)**

Sostituire:

```tsx
        <div className="flex items-center gap-2 p-6 font-heading text-lg font-bold text-primary lg:hidden">
          <Wallet className="size-5" aria-hidden="true" />
          {BRAND_NAME}
        </div>
```

con:

```tsx
        <div className="flex items-center gap-2 p-6 font-heading text-lg font-bold text-primary lg:hidden">
          <Image src="/brand/logo-mark.svg" alt="" width={20} height={24} className="h-5 w-auto" aria-hidden="true" />
          {BRAND_NAME}
        </div>
```

- [ ] **Step 4: Verificare che il progetto compili**

```bash
pnpm tsc --noEmit
```

Expected: nessun errore, nessun import inutilizzato (`Wallet` non più referenziato nel file).

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/layout.tsx"
git commit -m "feat(brand): logomark nel pannello di login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Favicon SVG

**Files:**
- Create: `app/icon.svg`

**Interfaces:**
- Consumes: `public/brand/logo-mark.svg` (Task 1).
- Produces: favicon servita automaticamente da Next.js su `/icon.svg` e referenziata nei `<link>` generati nell'head.

- [ ] **Step 1: Copiare il logomark come favicon**

```bash
cp public/brand/logo-mark.svg app/icon.svg
```

Next.js riconosce `app/icon.svg` come file convention e genera automaticamente il tag `<link rel="icon">` corrispondente, in aggiunta al preesistente `app/favicon.ico` (che resta invariato, vedi Review Focus). Nessuna modifica di codice necessaria in `app/layout.tsx` per questo step.

- [ ] **Step 2: Verificare che il progetto compili**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: build pulita, nessun errore. Il build log elenca `/icon.svg` tra le route generate.

- [ ] **Step 3: Commit**

```bash
git add app/icon.svg
git commit -m "feat(brand): favicon SVG dal logomark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Manifest PWA e metadata

**Files:**
- Create: `app/manifest.ts`
- Modify: `app/layout.tsx:1-26`

**Interfaces:**
- Consumes: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png` (Task 1).
- Produces: `/manifest.webmanifest` servito automaticamente da Next.js; `themeColor`/`viewport` esportati da `app/layout.tsx` seguendo la convenzione Next.js `generateViewport`/`viewport`.

- [ ] **Step 1: Scrivere `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

/**
 * Manifest PWA di BuddyBudget: rende l'app installabile su desktop, iOS e Android
 * ("Aggiungi a Home"/"Installa app"). Nessun service worker: l'app resta un client
 * che richiede rete, non funziona offline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuddyBudget",
    short_name: "BuddyBudget",
    description: "Gestione finanziaria personale — patrimonio, spese, investimenti.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f3f",
    theme_color: "#0f0f3f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- [ ] **Step 2: Aggiungere `viewport` e `apple-touch-icon` a `app/layout.tsx`**

In `app/layout.tsx`, dopo l'import `import type { Metadata } from "next";` (riga 1), aggiungere:

```tsx
import type { Metadata, Viewport } from "next";
```

(sostituisce la riga 1 esistente, aggiungendo `Viewport` all'import).

Dopo il blocco `export const metadata: Metadata = { ... };` (righe 23-26), aggiungere:

```tsx
export const viewport: Viewport = {
  themeColor: "#0f0f3f",
  viewportFit: "cover",
};
```

E aggiornare `metadata` per includere l'icona Apple touch (sostituire il blocco righe 23-26):

```tsx
export const metadata: Metadata = {
  title: "BuddyBudget",
  description: "Gestione finanziaria personale — patrimonio, spese, investimenti.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BuddyBudget",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};
```

`appleWebApp` è il campo tipizzato di Next.js `Metadata` che genera sia `apple-mobile-web-app-capable` sia `apple-mobile-web-app-status-bar-style` sia `apple-mobile-web-app-title`; non serve scrivere i tag `<meta>` a mano.

- [ ] **Step 3: Verificare che il progetto compili**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: build pulita. Il log del build elenca `/manifest.webmanifest` tra le route generate.

- [ ] **Step 4: Verificare manualmente il manifest servito**

```bash
pnpm dev
curl -s http://localhost:3000/manifest.webmanifest
```

Expected: JSON valido con `"name":"BuddyBudget"`, 4 entry in `icons`, ognuna con `src` che risponde 200:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/icon-192.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/icon-512.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/apple-touch-icon.png
```

Expected: `200` per tutti e tre.

- [ ] **Step 5: Commit**

```bash
git add app/manifest.ts app/layout.tsx
git commit -m "feat(pwa): manifest installabile + meta apple-web-app

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Verifica finale

**Files:** nessuno (solo verifica, nessuna modifica).

**Interfaces:**
- Consumes: l'intero lavoro dei Task 1-6.
- Produces: conferma che il branch è pronto per la review finale/merge.

- [ ] **Step 1: Build e typecheck completi**

```bash
pnpm tsc --noEmit
pnpm build
pnpm lint
```

Expected: tutti e tre puliti (nessun nuovo errore rispetto a quelli pre-esistenti già noti in CLAUDE.md — verificare che eventuali errori residui siano solo quelli già documentati, es. `react-hooks/set-state-in-effect` in `theme-toggle.tsx`/`CategoryLegendRow`).

- [ ] **Step 2: Grep di sicurezza — nessun hex hardcoded introdotto fuori da `globals.css`**

```bash
grep -rn "#0f0f3f\|#219ebc\|#ffb703\|#187e98" --include="*.tsx" --include="*.ts" app components | grep -v globals.css
```

Expected: nessun risultato (tutti i riferimenti colore nei componenti passano da token, come richiesto dalle Global Constraints).

- [ ] **Step 3: Verifica visiva delle schermate principali (dev server)**

```bash
pnpm dev
```

Controllare in entrambi i temi (chiaro/scuro, toggle in sidebar): `/panoramica`, `/conti`, `/transazioni`, `/cash-flow`, `/categorie`, pagina di login (`/login`), `/style-guide`. Verificare in particolare (Review Focus): leggibilità testo su sidebar navy, leggibilità pannello login, nessun elemento che assumeva sfondo chiaro sidebar risulti ora invisibile.

- [ ] **Step 4: Aggiornare CLAUDE.md**

Aggiungere una voce nel log delle decisioni (`CLAUDE.md`, sezione "Log delle decisioni") che descrive: sostituzione palette con brand navy/azzurro/giallo dal pacchetto logo del designer, cambio comportamentale sidebar navy fissa in entrambi i temi, PWA installabile via `app/manifest.ts` (nessun service worker/offline), asset in `public/brand/`+`public/icons/`. Aggiornare "Stato del progetto" se cambia lo stato generale.

- [ ] **Step 5: Commit finale**

```bash
git add CLAUDE.md
git commit -m "docs: aggiorna CLAUDE.md con brand identity + PWA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
