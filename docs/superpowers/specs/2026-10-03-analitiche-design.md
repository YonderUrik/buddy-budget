# Analitiche (strumenti avanzati): progetto

Stato: implementata sul branch `claude/project-thread-idnurb` (PR in revisione). Piano di ricerca originale: Claude Doc "Piano sezione Analitica (FIRE e patrimonio)", poi ristretto su richiesta dell'utente.

## Obiettivo e principi

Una sezione per chi vuole "smanettare": FIRE, scenari, rischio e costi. Tre regole decise dall'utente:

1. **Solo analisi avanzate.** Niente di ciò che si ricava già da Panoramica, Movimenti, Investimenti, Pensione.
2. **Tutto spiegato.** Ogni analitica ha cosa significa, come leggerla, come è calcolata, limiti e fonti; guida alla prima visita; nessun numero senza contesto.
3. **Nascosta di default.** Si accende da Impostazioni → Preferenze → Strumenti avanzati (`auth_user.advanced_analytics`). Senza interruttore `/analitiche` mostra una pagina che spiega e permette di accenderlo.

## Schede

| Scheda | Contenuto | Motore |
| --- | --- | --- |
| Obiettivo FIRE | numero FIRE (lordo e al netto delle imposte latenti), progresso, anni al traguardo, lean FIRE, Coast FIRE, due tabelle di sensibilità | `lib/calc/fire.ts`, `liquidation.ts` |
| Simulazione | Monte Carlo del patrimonio (accumulo + pensione), probabilità di successo, fasce 10°-90° | `lib/calc/monte-carlo.ts` |
| Prelievi | fissa, percentuale, Guyton-Klinger (semplificata), Vanguard dinamica sugli stessi scenari | `monte-carlo.ts` (`compareRules`) |
| Crescita | variazione del patrimonio finanziario = risparmio + mercato/altro (per differenza) | `growth-split.ts` |
| Rischio | volatilità, calo massimo, Sharpe, Sortino, Calmar, VaR/CVaR 95%, concentrazione, contributo al rischio (Eulero) | `risk-extras.ts`, `risk.ts` |
| Costi e tasse | TER (inserito a mano) + bollo, erosione a 30 anni, imposta se si vende tutto | `costs.ts`, `liquidation.ts` |

## Dati e ipotesi

- Nessuna fonte nuova: `lib/analitiche/base.ts` compone, lato client, conti, movimenti degli ultimi 13 mesi, snapshot del patrimonio, investimenti (`useInvestmentsOverviewQuery("max")`), previdenza e debiti.
- Ipotesi in `analytics_assumptions` (una riga per utente, JSON validato con zod in `lib/analitiche/assumptions.ts`, campi invalidi tornano al default). Valori di partenza prudenti: prelievo 3,5%, rendimento reale 4%, volatilità 12%, inflazione 2%, 40 anni di pensione, regola fissa.
- Spesa e risparmio sono ricavati dagli ultimi 12 mesi interi se ci sono almeno 3 mesi di dati; altrimenti non si inventa nulla e la scheda chiede di scriverli.
- API: `GET/PUT /api/analytics/assumptions`, `POST /api/analytics/walkthrough` (tutte `withRoute`).

## Modello di simulazione (scelte)

Passo annuale, rendimenti reali lognormali con media aritmetica `r` e volatilità `σ`; generatore mulberry32 con seme per percorso, così le quattro regole vedono gli stessi mercati. Pensione pubblica opzionale: dal anno scelto riduce il prelievo e la regola riparte dal nuovo livello. Soglie Guyton-Klinger (bande ±20%, aggiustamenti 10%, nessun taglio negli ultimi 15 anni) e limiti Vanguard (−2,5% / +5%) dalla letteratura, dichiarati "semplificati". Limiti noti: rendimenti indipendenti e senza code pesanti, nessuna fonte storica.

## Rimandato consapevolmente

- Dataset storici lunghi (backtest su serie reali, bootstrap, stress di sequenza, fattori): licenze (es. JST è CC BY-NC-SA) e peso; da riprendere se l'uso lo giustifica.
- TER automatico da Yahoo (oggi inserito a mano), ottimizzazione dell'ordine di vendita, esposizione valutaria, glidepath, salvataggio di più scenari con nome.
- Pannello Grafana "uso di Analitiche" nel repo infra (gli eventi Umami `analytics_*` ci sono già).

## Osservabilità

Log: `analytics.assumptions.saved` (campi cambiati), `analytics.walkthrough.seen`. Umami: `analytics_enabled/disabled`, `analytics_tab_viewed`, `analytics_assumptions_saved`, `analytics_guide_closed`, `analytics_guide_reopened`, `analytics_explainer_opened`. Nessun job in background, cron o dipendenza esterna: nessuna metrica né alert.
