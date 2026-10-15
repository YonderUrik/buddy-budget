# Landing: paese del prodotto e lingua separati

La landing offre Italia in italiano/inglese e Germania in tedesco/inglese. La selezione del paese cambia il contenuto del prodotto; la lingua cambia la presentazione. La versione tedesca mostra solo le funzioni essenziali già abilitate e dichiara i limiti delle stime fiscali. Pensione, AVD, pensionamento e strumenti fiscali italiani non vengono promossi come disponibili in Germania.

## Rilevamento e preferenze

Gli ingressi senza prefisso usano le preferenze linguistiche/regionali del browser. Non si raccolgono GPS o indirizzi IP per localizzare. Un tag con regione IT/DE suggerisce il prodotto, altrimenti il tedesco suggerisce DE e il fallback è IT/en. La scelta manuale è salvata in localStorage; ha precedenza nei successivi ingressi senza prefisso. Gli URL espliciti mantengono il profilo condiviso. Rileva elimina la preferenza salvata. Nessuna impostazione dell'account nell'app viene cambiata.

## Pubblicazione statica

`/it/it`, `/it/en`, `/de/de`, `/de/en` hanno HTML tradotto, metadati, canonical e hreflang. La build compila un profilo immutabile per volta e unisce gli export; il deploy nginx esistente resta statico. Gli URL italiani precedenti restano ingressi compatibili. Il sitemap combina le pagine valide. Le pagine fiscali italiane sul prodotto DE mostrano una spiegazione noindex; passando paese da tali pagine si torna alla home.

I cataloghi della landing sono separati dai testi dell'app. `profiles.ts` contiene la matrice estendibile; `country-copy.ts` e `country-catalog.ts` separano disponibilità/copy del prodotto dalle traduzioni. Il catalogo delle funzioni dell'app non cambia: questo intervento riguarda la loro presentazione sulla landing.

## Immagini e verifica

Schermate vere da database demo isolato, con profili IT/en, DE/en e DE/de, temi chiaro/scuro e versioni desktop/telefono. I nomi propri e le descrizioni inserite nei dati demo restano contenuti dell'utente. Anteprime social dedicate ai profili tradotti. Per rigenerare gli screenshot, impostare nel demo il profilo desiderato e passare `NEXT_PUBLIC_LANDING_COUNTRY` e `NEXT_PUBLIC_LANDING_LANGUAGE` allo script; non usare dati di produzione.

Verifiche: build statica dei cinque ingressi, test della landing (inclusi rilevamento, fallback, URL e metadata), lint e controlli browser su traduzioni, calcolatori, selettori, persistenza, reset, HTML senza JavaScript e layout mobile.
