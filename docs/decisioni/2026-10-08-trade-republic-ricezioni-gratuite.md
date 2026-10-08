# 2026-10-08 — Import Trade Republic: ricezioni gratuite di crypto e imposte in ritardo

L'import falliva con «Riga 225: amount non valido»: l'export contiene righe `DELIVERY`/`FREE_RECEIPT` (staking e trasferimenti in ingresso) con `amount` vuoto, e imposte `TAX` con `date` contabile di mesi prima di `datetime`.

- Le `FREE_RECEIPT` di crypto sono acquisti al prezzo di mercato del file, senza cassa, con avviso nell'anteprima (alternativa scartata: prezzo zero, che azzererebbe il costo anche dei trasferimenti in ingresso di importo rilevante).
- `datetime` può seguire `date` di qualunque intervallo; non può precederlo di oltre un giorno.
- Altri tipi in `DELIVERY`/classi non crypto continuano a bloccare il file (nessuno scarto silenzioso).
- Osservabilità: nessun nuovo segnale; l'esito resta `investments.import.completed`.
