# 2026-10-05 — Scelta del provider nell'import investimenti pensata per molti template

- **Elenco a righe** (non più 3 schede affiancate): logo, nome e una riga, a tutta larghezza su mobile. I gruppi (Broker / App e portali / Altro, `group` in `IMPORT_PROVIDERS`) compaiono come intestazioni solo con la ricerca, cioè quando l'elenco è lungo.
- **Ricerca** (`filterImportProviders`, senza accenti né maiuscole, cerca anche in sigle e parole chiave) che compare da `PROVIDER_SEARCH_THRESHOLD = 6` provider in su; sotto quella soglia sarebbe solo rumore. Da lì in poi l'elenco ha un'altezza massima (36% dello schermo su mobile, 16rem su desktop) e scorre al suo interno, così non spinge fuori schermo il caricamento del file.
- **Scelto il provider**, l'elenco si riduce a una riga con «Cambia»: il caricamento del file resta in primo piano.
- **Logo DEGIRO**: forniti dal proprietario in due varianti (`public/import-providers/degiro.svg` per il tema chiaro, `degiro-dark.svg` con testo bianco per lo scuro). `logoSrcDark` fa cambiare il logo col tema senza la tessera bianca usata per gli altri; il marchio resta di DEGIRO, usato solo per indicare la fonte del file. Le tessere sono larghe 96 px per far stare il wordmark.
- Evento Umami `investments_import_provider_searched` (provider scelto dopo una ricerca) per capire se la ricerca serve.
- Nessun impatto sulla landing.
