# 2026-10-11 — «Quanto rischia»: scala a fasce colorate

Il livello di rischio (Basso / Medio / Alto / Molto alto, soglie 8/15/25% di oscillazione annua) era quattro tacche grigie: la parola era chiara, il resto no. Ora è una scala a quattro fasce dal verde al rosso (token `--risk-1..4`, chiaro e scuro) con un segnaposto che cade dentro la fascia in proporzione all'oscillazione (`riskScalePosition`), la parola nel colore del livello e il nome di ogni fascia sotto la scala (il colore non è mai l'unico segnale).
L'indicatore «Quanto oscilla» non è più una riga a parte (ripeteva il numero in testa): la sua frase e il popover «i» stanno sotto la scala. Restano Perdita peggiore, Sharpe e, con un indice, il beta.
Scartate (screenshot nel thread): esempio in euro («10.000 € → tra 9.628 € e 10.372 €») e gauge a semicerchio. Possibile seguito: l'esempio in euro come riga sotto la scala.
Nessuna migration, nessun nuovo evento: la scheda non introduce azioni dell'utente.
