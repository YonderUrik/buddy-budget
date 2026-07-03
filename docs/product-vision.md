# BuddyBudget — Visione di prodotto

## Cos'è

BuddyBudget è un'app di gestione delle finanze personali pensata per chi vuole avere sotto controllo conti, spese e obiettivi di risparmio senza la complessità di un software di contabilità.

## Utente target

Persone che vogliono tenere traccia del proprio denaro in modo semplice e visivo: budget mensili, spese per categoria, obiettivi di risparmio — senza dover imparare un gergo finanziario o configurare fogli di calcolo complessi.

## Proposta di valore

Una panoramica chiara e immediata della propria situazione finanziaria (patrimonio netto, saldo disponibile, andamento delle spese), con la possibilità di pianificare un budget e monitorare obiettivi di risparmio, in un'interfaccia curata e veloce da usare quotidianamente.

## Funzionalità core (dedotte dal mockup iniziale)

Il mockup di riferimento (`docs/design-reference/mock-up.html`) delinea 9 aree funzionali (verificate eseguendo il mockup e testandone le interazioni — per il dettaglio completo di cosa si può fare, cosa no e come, vedi [`docs/functional-spec.md`](./functional-spec.md)):

- **Panoramica** — vista d'insieme su patrimonio netto, liquidità, investimenti, pensione e ultimi movimenti
- **Conti** — gestione della liquidità (conti collegati e manuali) da cui attingono spese e transazioni
- **Spese** — tracciamento delle uscite categorizzate, con budget mensile e meccanismo di esclusione parziale ("Dividi") per rimborsi/quote/giroconti
- **Cash flow** — entrate, uscite nette e distribuzione dell'avanzo (assorbe il concetto di "Entrate")
- **Investimenti** — portafoglio titoli, transazioni di acquisto/vendita, composizione per tipologia/geografia/settore
- **Pensione** — fondo pensione integrativo con simulatore di proiezione a scadenza
- **Debiti** — mutuo e prestiti, con simulatore di estinzione anticipata tramite rata extra
- **Pianifica** — simulatore what-if di scenari di vita (cambio lavoro, acquisto casa, figli) con proiezione del patrimonio a lungo termine (assorbe e amplia i concetti di "Budget"/"Risparmi")
- **Analitiche** — insight avanzati derivati (autonomia finanziaria, tasso di risparmio reale, indipendenza finanziaria/FIRE, rendimento reale, inflazione dello stile di vita, radar abbonamenti)

Non esiste nel mockup una sezione "Categorie" autonoma: le categorie di spesa sono un elenco fisso usato all'interno di "Spese".

## Stato attuale e prossimi passi

**Fase attuale**: inizializzazione del design system. Sono stati definiti i token visivi (colori, tipografia, raggi) e i componenti UI di base, consultabili in `/style-guide`. Non sono ancora state costruite le schermate funzionali elencate sopra, né la logica applicativa (dati, autenticazione, persistenza).

**Prossimi passi previsti** (non ancora pianificati in dettaglio):
1. Definire il modello dati (conti, transazioni, categorie, budget, obiettivi)
2. Costruire le schermate reali a partire dai componenti del design system
3. Introdurre autenticazione e persistenza dei dati
