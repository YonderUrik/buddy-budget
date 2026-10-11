# 2026-10-11 — Categorie di default più semplici e passo «Categorie» nell'onboarding

- Le categorie di default passano da 33 a 23 (più «Da categorizzare»): accorpate quelle che dai movimenti della banca non si distinguono (Bollette + Internet, Trasporti + Manutenzione auto, Abbigliamento + Shopping & Tecnologia, Sport + Cura personale, Fondo emergenza + Risparmio per obiettivi), nomi più corti, nuova «Contanti» per i prelievi. Proposta completa: `/mnt/project-files/categorie-default/proposta.md` (thread «Categorie di default e onboarding»), approvata da Daniele.
- Cinque facoltative (Figli & Scuola, Animali, Pensione integrativa, Imprevisti, Lavoro autonomo) non si creano da sole: si accendono nel passo dell'onboarding.
- Ogni categoria ha una descrizione breve (colonna `categories.description`, migration 0031, con backfill per i nomi dei default precedenti): la vede l'utente e la riceve l'assistente (Jev) come guida della scelta. Si modifica nel dettaglio della categoria.
- Passo «Categorie» dopo la valuta: etichette per gruppo e «Continua con queste»; «Personalizza» apre un foglio (dal basso su telefono) per spegnere, rinominare o aggiungere. Le categorie si creano alla registrazione: l'onboarding invia solo le scelte cambiate, applicate in una transazione e solo se l'utente non ha movimenti; un errore non blocca l'onboarding.
- Gli utenti esistenti tengono le loro categorie; `LEGACY_CATEGORY_NAMES` aggiornato solo per il reset manuale.
- Rimandati: cambiare icona e colore nel passo (si fa in Categorie), proporre categorie in base alla banca collegata.
