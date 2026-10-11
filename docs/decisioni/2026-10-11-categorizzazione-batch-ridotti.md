# Categorizzazione AI: cinque esercenti per richiesta

- Ridotto da 20 a 5 il numero massimo di esercenti per chiamata a Jev, per ridurre il lavoro richiesto al modello in ogni risposta.
- Il limite condiviso vale per la generazione delle proposte e per lo script di valutazione. Timeout, budget complessivo e gestione degli errori restano invariati; i retry sono rimandati.
- Prestazioni: più richieste sequenziali per lo stesso numero di esercenti; il miglioramento dei timeout va verificato sul servizio reale, e il budget temporale può limitare gli esercenti elaborati.
- Nessun cambiamento all'interfaccia o alle funzionalità raccontate nella landing; nessun nuovo segnale di osservabilità, restano le metriche delle richieste AI.
