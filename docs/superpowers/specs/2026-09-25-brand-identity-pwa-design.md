# Brand identity + PWA installabile — design

Data: 2026-09-25

## Contesto e obiettivo

Il designer ha consegnato il pacchetto loghi definitivo di BuddyBudget (`Archive.zip`, ricevuto e spacchettato in questa sessione): wordmark completo, logomark (la "B" a tre forme sovrapposte azzurro/navy/giallo), varianti chiare/scure/monocromatiche, sorgenti vettoriali (SVG/EPS/AI/PDF) e icone app pre-renderizzate per iOS/Android in tutte le taglie standard.

Obiettivo: integrare questo brand nell'app (sostituendo l'attuale palette verde-bosco/crema, estratta a suo tempo dal mockup Claude Design, mai pensata come brand definitivo) e rendere l'app installabile come PWA su desktop, iOS e Android, cosicché l'icona/nome che compaiono su home screen e app switcher riflettano il nuovo brand.

## Fuori scope (deciso in brainstorming)

- App native pubblicate su App Store / Play Store (nessun wrapper Capacitor/Expo). Solo PWA installabile via browser.
- Service worker / funzionamento offline. La PWA è installabile (manifest + icone) ma non cachea risorse per l'uso offline — l'app resta un client che richiede rete, come oggi.
- i18n del brand (nome "BuddyBudget" resta invariato in ogni lingua quando l'i18n sarà implementato).

## 1. Palette colori — brand pieno

Sostituzione completa dei token colore in `app/globals.css` (sia `:root` sia `.dark`), estratti dai valori esatti nei file SVG sorgente del logo (`#0f0f3f` navy, `#219ebc` azzurro, `#ffb703` giallo).

| Token | Chiaro | Scuro | Note |
|---|---|---|---|
| `--background` | `#F6F8FA` | `#0F0F3F` | Chiaro: grigio-blu freddo neutro (non bianco puro, per far respirare le card). Scuro: navy del logo. |
| `--foreground` | `#0F0F3F` | `#ECEDF7` | |
| `--card` | `#FFFFFF` | `#171A4D` | |
| `--card-foreground` | `#0F0F3F` | `#ECEDF7` | |
| `--primary` | `#187E98` | `#219EBC` | Chiaro: azzurro brand scurito per contrasto AA su bianco (`#219EBC` puro è ~3.4:1 su bianco, insufficiente per testo; `#187E98` è ~4.6:1). Scuro: azzurro brand puro (su navy scuro il contrasto è già sufficiente). |
| `--primary-foreground` | `#FFFFFF` | `#0F0F3F` | |
| `--accent` | `rgba(255,183,3,0.14)` | `rgba(255,183,3,0.18)` | Giallo brand come accento soft (badge, evidenze), non come superficie piena. |
| `--accent-foreground` | `#8A5A00` | `#FFB703` | Chiaro: giallo scurito per leggibilità testo-su-soft; scuro: giallo puro. |
| `--ring` | `#187E98` | `#219EBC` | Allineato a `--primary`. |
| `--pos` / `--pos-soft` | invariati | invariati | Verde entrate — resta semantico, non-brand. |
| `--neg` / `--neg-soft` | invariati | invariati | Rosso uscite — resta semantico, non-brand. |
| `--sidebar` | `#0F0F3F` | `#0B0B2E` | **Cambio comportamentale**: la sidebar diventa navy fissa in entrambi i temi (oggi è chiara in tema chiaro), perché il logomark è disegnato per stare su sfondo navy/scuro in tutte le varianti fornite. |
| `--sidebar-foreground` | `#ECEDF7` | `#ECEDF7` | |
| `--sidebar-primary` | `#219EBC` | `#219EBC` | Colore della voce attiva/icona attiva. |
| `--sidebar-primary-foreground` | `#0F0F3F` | `#0F0F3F` | |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.06)` | Hover/attivo su superficie navy. |
| `--sidebar-accent-foreground` | `#FFFFFF` | `#FFFFFF` | |
| `--sidebar-border` | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.08)` | |
| `--sidebar-ring` | `#219EBC` | `#219EBC` | |

Tutti gli altri token esistenti (`--muted`, `--destructive`, `--border`, `--input`, `--text-2`, `--text-3`, ecc.) restano concettualmente gli stessi ma vengono ritinti in tonalità navy/blu-grigio invece di verde/crema, per coerenza (stesso schema chiaro/scuro attuale, nuova tinta). Nessun nuovo token introdotto: si tratta di una sostituzione di valori, non di struttura.

Font invariati: `font-heading` (Space Grotesk), `font-sans` (Hanken Grotesk) — il logo non introduce un font proprietario (è disegnato, non tipografico in modo da richiedere un font specifico).

## 2. Asset logo

Sorgenti nello zip (in `Archive.zip`, root del repo — da spostare/rimuovere dopo l'estrazione) copiate in `public/brand/` (solo i formati usati a runtime; SVG sorgenti EPS/AI/PDF restano fuori dal repo pubblico, archiviati altrove o scartati — non servono al codice):

- `public/brand/logo-full-navy.svg` — wordmark completo, testo navy (da `buddy budget-01.svg`) → per sfondi chiari.
- `public/brand/logo-full-white.svg` — wordmark completo, testo bianco (da `buddy budget-03.svg`) → per sfondi navy/scuri.
- `public/brand/logo-mark.svg` — solo logomark "B" (da `buddy budget-02.svg`) → icona standalone, sidebar, favicon sorgente.

Le icone app pre-renderizzate (`App Icon/iOS/*.png`, `App Icon/Android/*.png` nello zip) vanno copiate in `public/icons/` con nomi normalizzati:
- `public/icons/icon-192.png`, `icon-512.png` (da `android_192.png`, `android_512.png`) → manifest PWA, incluse varianti `maskable`.
- `public/icons/apple-touch-icon.png` (da `ios_180.png`) → home screen iOS.
- Le altre taglie (36/48/72/96/144 Android, 20-167 iOS) non sono strettamente necessarie ai browser moderni (che scalano da 512), ma vengono comunque copiate in `public/icons/` per completezza/uso futuro senza essere referenziate esplicitamente, tranne le due sopra.

## 3. Dove compare il logo

| Punto | Cosa | Come |
|---|---|---|
| Sidebar espansa (desktop) | logomark + wordmark "BuddyBudget" | `logo-mark.svg` (24px) + testo, sostituisce la sola lettera "B" font-heading attuale in `AppSidebar` |
| Sidebar collassata (desktop/tablet) | solo logomark | sostituisce la `<span>B</span>` font-heading attuale |
| Topbar mobile | solo logomark (+ nome testuale come oggi, invariato) | `MobileTopbar`: logomark accanto al testo `brandName` |
| Login — pannello `LoginStory` | logomark come header/watermark | piccolo, sopra il titolo "I tuoi movimenti, finalmente leggibili." |
| Favicon | logomark | `app/icon.svg` (Next.js file convention — sostituisce `app/favicon.ico`) |
| PWA home screen / app switcher | icone PNG pre-renderizzate | via manifest, vedi sotto |

Tutti gli usi in sidebar/topbar/login usano `logo-mark.svg` (unica variante) perché è disegnato su sfondo navy — coerente col fatto che sidebar è sempre navy dopo il punto 1. Nessun componente React nuovo: `<Image>`/`<img>` diretto dove serve, dato che sono asset statici senza logica.

## 4. PWA — installabilità

- `app/manifest.ts` (Next.js file convention, sostituisce l'assenza attuale di manifest):
  - `name: "BuddyBudget"`, `short_name: "BuddyBudget"`
  - `description`: breve, in italiano (es. "Gestione finanziaria personale")
  - `start_url: "/"` (redirige già a `/panoramica` per utenti autenticati)
  - `display: "standalone"`
  - `background_color: "#0F0F3F"`, `theme_color: "#0F0F3F"` (coerenti con `--sidebar`/`--background` scuro)
  - `icons`: `icon-192.png`/`icon-512.png`, ciascuna con una entry `purpose: "any"` e una `purpose: "maskable"` (stesso file va bene: il logomark ha già margine interno sufficiente, verificato visivamente sui render quadrati forniti)
- `app/layout.tsx` (`<head>`/metadata Next.js):
  - `apple-touch-icon` → `public/icons/apple-touch-icon.png`
  - `<meta name="apple-mobile-web-app-capable" content="yes">` e `apple-mobile-web-app-status-bar-style` coerente col tema
  - `viewport` con `viewportFit: "cover"` (Next.js `generateViewport`/`viewport` export) per gestire le safe-area su iPhone con notch — CSS `env(safe-area-inset-*)` già utilizzabile se serve, ma nessun componente oggi lo richiede esplicitamente; si aggiunge solo il meta abilitante
  - `themeColor` export Next.js allineato a `#0F0F3F` (o al token background/sidebar attivo)

Nessuna modifica a `next.config.ts` necessaria per il solo manifest statico (Next.js serve `app/manifest.ts` automaticamente su `/manifest.webmanifest`).

## 5. Verifica

- `pnpm build`/`tsc --noEmit` puliti.
- Contrasto AA verificato a calcolo (WCAG) sulle coppie foreground/background che cambiano: `--primary` su `--background` chiaro, `--sidebar-foreground` su `--sidebar`, `--accent-foreground` su `--accent`.
- Verifica manuale utente (necessaria, nessun browser reale in sandbox agentico): aspetto chiaro/scuro di tutte le schermate principali con la nuova palette; "Aggiungi a Home" su iOS Safari e Android Chrome mostra icona/nome corretti; installazione PWA su desktop Chrome/Edge; il pannello login (`LoginStory`, molto animato/colorato) resta leggibile con la nuova palette — è il componente più a rischio di collisione visiva col nuovo sfondo/accenti.

## 6. Sequenza di implementazione (per il piano)

1. Estrarre gli asset dallo zip in `public/brand/` e `public/icons/`, rimuovere `Archive.zip` dalla root.
2. Riscrivere i token colore in `app/globals.css` (punto 1).
3. Sostituire logomark in sidebar (espansa/collassata) e topbar mobile.
4. Aggiungere logomark a `LoginStory`.
5. Sostituire favicon (`app/icon.svg`) e rimuovere `app/favicon.ico` se orfano.
6. Creare `app/manifest.ts` + meta PWA in `app/layout.tsx`.
7. Verifica build/tsc/contrasto, giro visivo su tutte le schermate principali (chiaro/scuro) prima di consegnare per la verifica manuale utente.

Nessuna migrazione DB, nessuna modifica a route API o logica di dominio: lavoro interamente in `app/`, `components/layout/`, `components/domain/auth/`, `public/`.
