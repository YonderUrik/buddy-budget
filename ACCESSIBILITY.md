# Accessibilità

BuddyBudget vuole essere utilizzabile da chiunque, anche con tastiera, screen reader, zoom o movimento ridotto. Questo documento dice a che punto siamo, senza promettere più di quanto è stato verificato.

## Obiettivo e stato

- **Obiettivo**: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) livello AA per l'app (`app.buddybudget.io`) e per la landing (`buddybudget.io`).
- **Stato**: è un obiettivo, **non una conformità certificata**. Non è stato fatto nessun audit esterno né una verifica completa con screen reader. Il progetto è sviluppato da una persona sola.
- Ultima revisione di questo documento: 2026-10-10.

## Cosa c'è oggi

Verificato leggendo il codice, non con un audit:

- **Componenti**: le primitive in `components/ui/` sono shadcn su [Base UI](https://base-ui.com/), che gestisce ruoli, stati ARIA, trappola del focus e chiusura con `Esc` in dialog, menu, popover, select e cursori.
- **Focus visibile**: bottoni e controlli hanno uno stile `focus-visible` (anello con il token `ring`).
- **Lingua**: la pagina dichiara `lang="it"`.
- **Contenuto principale**: `<main id="main-content">` è raggiungibile dal focus programmatico.
- **Etichette**: i controlli senza testo (icone) usano `aria-label`; il testo solo per screen reader usa `sr-only`; le decorazioni sono `aria-hidden`.
- **Tema**: chiaro e scuro, con colori da token in `app/globals.css`. Entrate e uscite hanno anche segno e testo, non solo il colore.
- **Movimento ridotto**: le animazioni (numeri che scorrono, testi che cambiano, grafico del login) rispettano `prefers-reduced-motion`: il provider Motion usa `reducedMotion="user"` e i componenti più vistosi restano fermi.
- **Mobile**: barra di navigazione in basso e menu «Altro» con aree di tocco di almeno 44 px nei punti principali (`min-h-11`).
- **Importi nascosti**: il pulsante «nascondi importi» è un interruttore con stato esposto.
- **Grafici**: Recharts con `accessibilityLayer` almeno nel grafico del patrimonio netto.

## Limiti noti

Cose che **non** sappiamo essere a posto o che sappiamo mancanti:

- Non c'è un link «Vai al contenuto» (skip link) visibile: `main` è pronto a riceverlo, ma il link non esiste ancora.
- Non è mai stato fatto un giro completo con VoiceOver, NVDA, JAWS o TalkBack.
- I contrasti dei token non sono stati misurati sistematicamente in entrambi i temi (in particolare `text-2`/`text-3` e i testi su sfondi tinti).
- I grafici trasmettono i dati soprattutto in modo visivo: non tutti hanno una tabella o un riepilogo testuale alternativo.
- Drag & drop (es. board delle categorie): non è verificato che esista un'alternativa completa da tastiera.
- Lo zoom al 200% e il reflow a 320 px non sono stati controllati su tutte le schermate.
- Non ci sono test automatici di accessibilità in CI (né axe, né Lighthouse); ESLint applica solo le regole `jsx-a11y` incluse in `eslint-config-next`.
- L'interfaccia è solo in italiano.
- Le pagine esterne collegate (es. flusso di consenso della banca, login Google) dipendono da terzi.

## Segnalare un problema

Se qualcosa non è utilizzabile, dillo: è un difetto da correggere, non una richiesta di favore.

- Dall'app: pagina **Aiuto** (`/aiuto`), scegli il tipo di segnalazione.
- Su GitHub: [apri una issue](https://github.com/YonderUrik/buddy-budget/issues/new/choose) e scrivi «accessibilità» nel titolo, con browser, dispositivo e tecnologia assistiva usata.
- Per email: supporto@buddybudget.io.

Indica la pagina, cosa volevi fare e cosa è successo. Le segnalazioni di accessibilità hanno la stessa priorità dei bug.

## Per chi contribuisce

Ogni PR che cambia l'interfaccia controlla questi punti (sono anche nel modello della PR):

1. **Tastiera**: tutto si raggiunge e si usa con `Tab`, `Shift+Tab`, `Invio`, `Spazio`, frecce ed `Esc`; l'ordine del focus segue quello visivo; il focus è sempre visibile e non resta intrappolato.
2. **Nomi e ruoli**: ogni controllo ha un nome accessibile (testo visibile o `aria-label`); si usano elementi nativi (`button`, `a`, `label`) prima di `div` con `role`; i titoli seguono una gerarchia sensata.
3. **Contrasto**: testo almeno 4,5:1 (3:1 per testo grande e componenti), in tema chiaro **e** scuro; usare solo i token del tema. Mai il solo colore per distinguere un significato (verde/rosso → anche segno o testo).
4. **Movimento ridotto**: ogni animazione nuova si ferma o si semplifica con `prefers-reduced-motion` (`useReducedMotion` o `MotionConfig`).
5. **Aree di tocco**: bersagli di almeno 24×24 px (WCAG 2.2, 2.5.8), meglio 44 px su mobile.
6. **Errori e stati**: errori di form associati al campo (`aria-describedby`/`aria-invalid`), aggiornamenti dinamici annunciati (`role="status"`/`aria-live`) quando servono.
7. **Grafici e immagini**: un'alternativa testuale (valore chiave, tabella o descrizione); immagini decorative `alt=""`/`aria-hidden`.
8. **Zoom e reflow**: nessuno scroll orizzontale a 320 px e con zoom al 200%.
9. **Screen reader**: per le modifiche che toccano flussi principali, una prova con VoiceOver (macOS/iOS), NVDA (Windows) o TalkBack (Android), annotata nella PR. Se non è stata fatta, scrivilo.

### Strumenti consigliati

- Estensione [axe DevTools](https://www.deque.com/axe/devtools/) o la scheda Accessibilità di Lighthouse in Chrome.
- Navigazione solo da tastiera e zoom al 200%.
- VoiceOver (`Cmd+F5`), NVDA, TalkBack.
- Emulazione di `prefers-reduced-motion` e `prefers-color-scheme` negli strumenti per sviluppatori.
- Misuratori di contrasto (es. [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)).

## Riferimenti

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Base UI](https://base-ui.com/)
- [Aggiungere una pagina di accessibilità a un repository (GitHub)](https://docs.github.com/communities/setting-up-your-project-for-healthy-contributions/adding-an-accessibility-page-to-your-repository)
