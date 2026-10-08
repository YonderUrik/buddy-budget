# Import: nessun collegamento automatico se l'ISIN esiste in un'altra valuta (2026-10-08)

Un ISIN ha un solo strumento comune (indice univoco), con la sua valuta. Se il rendiconto è in EUR e lo strumento comune (Tesla) è in USD, il collegamento automatico alla quotazione in EUR riusava lo strumento in USD e l'import si fermava con «Strumento o valuta non corrispondenti». Ora in quel caso il titolo resta manuale nella valuta del file, come prima del collegamento automatico. Impatto landing: nessuno.
