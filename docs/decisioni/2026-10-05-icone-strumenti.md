# 2026-10-05 — Icone degli strumenti in Posizioni

- **Scelta**: niente servizi di loghi esterni (Clearbit è chiuso, Logo.dev/Brandfetch vogliono chiave, attribuzione e hotlinking). Tutto si risolve in locale dal tipo e dal nome (`lib/investments/instrument-icon.ts`), senza richieste di terzi dal browser dell'utente.
- **Crypto**: icone CC0 di `cryptocurrency-icons` copiate in `public/instrument-icons/crypto/` (~480 monete), trovate dal nome o simbolo.
- **Azioni**: marchi CC0 di Simple Icons per ~40 aziende note (elenco in `scripts/generate-instrument-icons.mjs`); le altre mostrano una sigla. Copertura bassa: i grandi nomi italiani/europei non ci sono in Simple Icons.
- **ETF e fondi**: l'emittente si riconosce dal nome (iShares, Vanguard, Xtrackers…), ma al posto del logo c'è una sigla colorata: sono marchi registrati e non abbiamo un permesso d'uso. Per i loghi veri basta aggiungerli in `public/instrument-icons/issuers/` quando l'uso sarà autorizzato.
- **Rimandato**: loghi azionari per dominio (servirebbe il sito dell'azienda da Yahoo `assetProfile` e un servizio con chiave, ad es. Logo.dev, con cache lato server), icone in Titoli/Diversificazione/import.
- `proxy.ts` esclude `instrument-icons/` dal controllo di sessione, come `brand/`.
