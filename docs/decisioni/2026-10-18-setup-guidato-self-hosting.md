# Setup guidato per le installazioni self-hosted
Data: 2026-10-18

- Scelta dell’utente: configurazione nel terminale, tramite `scripts/selfhost-init.sh`, con Node 24 locale o container temporaneo. Nessuna pagina web di amministrazione o socket Docker esposto.
- OpenRouter fortemente consigliato; Yahoo verificabile senza API key; Resend consigliato; banche, Google, loghi, fonti aggiuntive e Ollama facoltativi. Verifiche non fatturabili e riepilogo distinguono configurazione da funzionamento confermato.
- `.env` scritto atomicamente con permessi 600; valori e chiavi di cifratura esistenti conservati. Il profilo `ai` avvia il worker con le stesse credenziali dell’app; il cron email si abilita con Resend.
- Impostazioni mostra lo stato dell’istanza senza segreti. Google nascosto se assente; login senza email spiega i log. Umami ospitato disabilitato; destinatario del supporto esplicito in self-hosting.
- Rimandati: prova AI a pagamento e consegna email nel setup, verifica OAuth/banca completa, configurazione senza riavvio, aggiornamento della pubblicazione multi-arch. Restano verifiche nell’app e comandi di avvio espliciti per l’amministratore.
- Verifiche automatiche installer in CI; nessuna migrazione dello schema o modifica delle credenziali di produzione.
