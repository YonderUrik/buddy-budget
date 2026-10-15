# Pianificazione finanziaria Germania — implementazione locale

## Decisione e stato

Richiesta: implementare tutte le aree residue della roadmap, con regole estendibili ad altri paesi e interfaccia DE/EN. Questa implementazione copre uno **scope esplicito di scenari per privati residenti in Germania in EUR**, non ogni fattispecie fiscale tedesca. Nessun merge o deploy incluso. I costi della fase 2 restano nel branch e sono documentati separatamente.

Ora: implementazione locale, verifiche automatiche e browser. Prima del rilascio: prova utente, revisione PR, CI e migration sull'ambiente destinatario. Non abilitare genericamente i flag dei vecchi motori italiani: questi rimangono falsi per DE. Le quattro pagine principali instradano a componenti tedeschi e non montano i provider italiani; le vecchie API e sottopagine pensione/analitiche rimangono protette.

## Modello estendibile

`lib/financial-planning/registry.ts` registra modello e schema per paese; `countries/de.ts` contiene regole versionate 2026 e fonti. Nessun legame con la lingua. Tabelle e documenti separati per `(user_id, country)`, versione del documento e revisione per controllo di concorrenza. Un nuovo paese richiede un adapter verificato, relativo schema e viste: nessun ripiego automatico sulle regole italiane o tedesche.

Migration 0038 crea `financial_plans`, con FK e cancellazione a cascata. Gli endpoint autenticati verificano il paese dalla sessione, validano l'intero documento e rifiutano revisioni obsolete con 409. Esportazione e azzeramento account includono i piani. Nessuna modifica delle operazioni d'investimento; nessuna capitalizzazione di diritti pensionistici nel patrimonio.

## Funzioni e ambito

- **Fiscalità base**: FIFO separato per portafoglio/deposito importato e strumento, commissioni di compravendita, FX dell'operazione, quotazione percentuale delle obbligazioni, split. Pauschbetrag singolo/congiunto, perdite azionarie separate dalle altre, nessuna scadenza italiana a quattro anni, imposta sul capitale, Solidaritätszuschlag, Kirchensteuer con denominatore corretto. Credito estero solo se l'utente ne conferma l'importo effettivamente anrechenbar dopo limiti, rimborsi e compensazioni. Ritenute registrate separate, non automaticamente considerate credito. Simulazione di vendita senza scrivere operazioni.
- **Fondi/ETF**: classificazione fiscale esplicita (30/15/60/80/0% di esenzione) e stato sconosciuto distinto; sottrazione delle Vorabpauschalen pregresse lorde attribuibili alle quote vendute prima della Teilfreistellung. Le Vorabpauschalen imponibili incassate nell'anno si inseriscono fra gli ulteriori proventi. Scenario 2026 per un lotto invariato detenuto fino a fine anno: base 3,20% × 70%, limite all'incremento più distribuzioni, sottrazione distribuzioni e riduzione per mese di acquisto. Afflusso nel 2027, senza inventare una stima fiscale per un anno non verificato.
- **Proventi**: storico lordo/ritenute/netto effettivamente registrato; previsione lorda dei 12 mesi successivi con motore condiviso di dividendi/cedole. Netto tedesco incrementale solo quando anno, classificazioni e storico sono completi, usando una sola volta franchigie e perdite. I rimborsi del nominale non sono reddito distribuito. Nessuna aliquota italiana usata nel netto.
- **Pensioni**: registrazione separata di GRV, bAV, Riester, Rürup e private. GRV: punti acquisiti + ipotesi di nuovi punti, access factor esplicito e Rentenwert di luglio 2026; nessuna conversione del diritto in capitale. Contratti: capitale corrente, contributi e rendimento nominale dopo costi; rendita futura da dichiarazione dell'ente. Riester/Rürup/GRV solo rendita in questa versione; gli altri contratti possono usare un capitale contrattualmente disponibile **oppure** rendita, mai entrambi.
- **Pensionamento/FIRE**: capitale liquido separato dai contratti, versamenti e spesa in euro reali, ponti temporali fino alle singole pensioni, capitale contrattuale disponibile alla data di pagamento, 50 anni di scenario e anno di esaurimento. Imposte sulle pensioni, contributi sociali e quota fiscale dei prelievi sono ipotesi esplicite, non calcoli automatici del netto tedesco.
- **Crypto private**: scenari di singoli lotti abbinati manualmente, comprese permute; oltre un anno, Freigrenze di €1.000 (non franchigia), altri guadagni/perdite privati e perdita pregressa separata dal capitale. Incremento dell'Einkommensteuer progressiva 2026 sul reddito imponibile fornito, anche splitting. Nessun import automatico di base fiscale dalla media ponderata del portafoglio.

## Limitazioni deliberate e lavoro successivo

Non presentare queste aree come una dichiarazione fiscale completa. Servono integrazioni successive per trasferimenti e corporate actions non registrate, titoli pre-2009, fondi pre-2018/cambi di classificazione, calcolo automatico di crediti esteri e DBA, Günstigerprüfung, tassazione d'impresa, derivati/ETC, tutte le date/tassi futuri. Le posizioni incomplete bloccano il totale fiscale invece di usare costo zero. I movimenti crypto sono esclusi dal report §20 e vanno nello scenario §23 separato.

Per pensioni restano da integrare eleggibilità, sussidi e detrazioni, garanzie e riscatti, conversione capitale/rendita del singolo contratto, fiscalità effettiva per coorte e prodotto, Kranken-/Pflegeversicherung. Nessuna aliquota italiana è riutilizzata. Per crypto restano fuori staking rewards, lending, mining, NFT, attività professionale, carryback e sovraimposte sul reddito: il risultato dichiara espressamente queste esclusioni. Tornare su ciascuno con requisiti, fonti e fixture specifiche; non nasconderli sotto il termine “tutto”.

## Fonti ufficiali verificate il 14 ottobre 2026

- https://www.gesetze-im-internet.de/estg/__20.html — FIFO, perdite, Sparer-Pauschbetrag e spese.
- https://www.gesetze-im-internet.de/estg/__32d.html — aliquota, denominatore Kirchensteuer, crediti esteri e Günstigerprüfung.
- https://www.gesetze-im-internet.de/solzg_1995/__4.html — Solidaritätszuschlag sui redditi da capitale.
- https://www.gesetze-im-internet.de/invstg_2018/__18.html — Vorabpauschale.
- https://www.gesetze-im-internet.de/invstg_2018/__19.html — deduzione delle Vorabpauschalen pregresse lorde.
- https://www.gesetze-im-internet.de/invstg_2018/InvStG.pdf — §20 Teilfreistellung (pagina HTML §20 intermittentemente non disponibile; testo ufficiale PDF consultato).
- https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Investmentsteuer/2026-01-13-basiszins-berechnung-vorabpauschale.pdf?__blob=publicationFile&v=1 — Basiszins 2026: 3,20%.
- https://www.gesetze-im-internet.de/rwbestv_2026/BJNR0B20A0026.html — Rentenwert €42,52 dal 1 luglio 2026.
- https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/01_GRA_SGB/06_SGB_VI/pp_0051_75/gra_sgb006_p_0064.html — formula pensione.
- https://www.gesetze-im-internet.de/estg/__23.html — vendite private, periodo e soglia.
- https://amtliche-handbuecher.bundesfinanzministerium.de/esth/2025/B-Anhaenge/Anhang-04/anhang-4.html — indicazioni BMF sui crypto-assets.
- https://www.gesetze-im-internet.de/estg/__32a.html — tariffa progressiva 2026 e splitting.

## Osservabilità, landing e verifica

Log `financial_plan.saved` e `financial_plan.save.conflict`, endpoint con `withRoute`. Umami `financial_plan_saved` e `financial_sale_simulated`, solo paese/sezione, mai importi o nomi. Catalogo landing aggiornato e sincronizzato, descrizione limitata agli scenari effettivamente implementati.

Build e TypeScript riusciti. Prima suite mirata: 78 test superati. Suite completa: 2.265 test superati, unico fallimento preesistente del logger dovuto a `/Users/mario` nello stack locale. Inclusi test reali di autenticazione, separazione utenti/paesi, validazione, concorrenza, esportazione e azzeramento. Verifica browser e controllo finale da registrare a completamento.

## Esito finale della prova locale

- Build finale riuscita, TypeScript senza errori, ESLint dei file modificati senza rilievi e `git diff --check` pulito.
- Dopo gli ultimi controlli su duplicati e anno crypto, 47 test mirati superati (modello tedesco, localizzazione, catalogo). Suite completa precedente: 2.265 passati + il solo errore locale noto del logger.
- Browser: 16 combinazioni pagina/profilo per le quattro nuove pagine con DE/en, DE/de, IT/it, IT/en; salvataggio/ricaricamento, simulatore, nessuna chiamata ai provider/API italiani per DE, operazioni invariate e nessun errore browser. Il test ripristina il piano originale.
- Mobile DE/de a 390 px: quattro pagine senza overflow orizzontale né errori browser; controllo visivo della pensione effettuato. Profilo ripristinato DE/en.
- Screenshot landing italiani delle pagine Tasse, Pensione, Analitiche rigenerati nei due temi; i precedenti screenshot Costi rimangono inclusi. Tre test screenshot e verifica sincronizzazione catalogo riusciti.
- Migration applicata soltanto a database locali isolati (preview e database temporaneo della suite). Preview disponibile su localhost:3300. Nessun merge/deploy e nessuna modifica a dati reali.

## Altersvorsorgedepot (AVD)

Aggiunto come tipo distinto nella sezione Pensione, non come portafoglio liberamente disponibile. DE/EN: selezione AVD, contributi e proiezione lorda del capitale con le ipotesi esplicite esistenti. Nessuna inclusione automatica nel patrimonio o nel capitale liquido FIRE. Niente incentivi, agevolazioni o tassazione AVD presunti; niente pagamento integrale in capitale nel modello iniziale. Durata dei piani di pagamento e capitale parziale ancora esclusi ed esplicitati nell'interfaccia. Il tipo aggiuntivo usa il documento JSON esistente, senza migration.

Indicazione nuovi contratti dal 2027 verificata nelle informazioni ufficiali BMAS/BMF; il prodotto è presentato come scenario prospettico, non conto già disponibile nel 2026. Fonte: https://www.bmas.bund.de/DE/Soziales/Rente-und-Altersvorsorge/Private-Altersvorsorge/Steuerlich-gefoerderte-private-Altersvorsorge/steuerlich-gefoerderte-private-altersvorsorge.html e https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html . Catalogo landing sincronizzato; screenshot italiani invariati perché l'opzione compare soltanto nella schermata tedesca. 49 test mirati superati, TypeScript ed ESLint riusciti.

Verifica AVD completata: build riuscita; browser su profilo DE/de a 390 px conferma salvataggio/lettura del tipo `avd`, avviso 2027, assenza dell'opzione di liquidazione integrale, nessun overflow o errore browser. Corretta anche l'etichetta accessibile dei selettori del modulo (label separata dalle opzioni). Piano demo originale ripristinato e lingua riportata a inglese.

## Estensione del 15 ottobre: agevolazioni AVD e netto pensionistico

Supera le limitazioni della prima versione AVD descritte sopra. Nessun merge autorizzato in questa fase.

- AVD: regole approvate dal 2027, minimo e massimo di contribuzione, prima/seconda fascia della Grundzulage, Kinderzulage con durata residua per figlio, bonus iniziale una sola volta, diritto diretto/indiretto esplicito. Un unico scenario aggregato per persona evita di duplicare le agevolazioni tra contratti. Contributi mensili e zulagen a fine anno; il credito fiscale resta fuori dal capitale.
- Confronto della deduzione AVD: calcola il beneficio incrementale al netto delle zulagen, con **tariffa 2026 costante esplicitamente dichiarata**. Non è una dichiarazione 2027 né una verifica completa delle deduzioni con coniuge indirettamente beneficiario.
- AVD: scelta tra rendita dichiarata dal provider e ammortamento a durata definita almeno fino a 85 anni; capitale iniziale parziale fino al 30%; il reddito termina alla fine del piano. Importi del provider devono già tener conto del capitale parziale scelto.
- Netto pensionistico: modalità separata dalle precedenti ipotesi manuali. Quota imponibile GRV/Rürup per coorte, Freibetrag fisso o derivato per pensione costante; Ertragsanteil delle rendite private; trattamento integralmente finanziato o imponibile da certificazione per altri contratti. Blocca il netto se manca la classificazione, incluso AVD con contributi misti dichiarato erroneamente interamente agevolato.
- KVdR: metà KV/Zusatzbeitrag sulla GRV, piena Pflege, franchigia KV bAV aggregata e soglia Pflege distinta, tetto contributivo condiviso, capitale bAV ripartito per 120 mesi. PKV: premio netto effettivo e quota deducibile espliciti. L'assicurazione volontaria usa basi minime/massime e aliquote per redditi ordinari e ridotti, senza franchigia bAV; il contributo DRV è sottratto solo se confermato. I regimi bAV speciali non vengono assimilati automaticamente ai contratti agevolati.
- Imposta pensionistica progressiva aggregata, splitting scelto in Tasse, Pauschbetrag pensioni una sola volta, Soli con soglia e fascia di attenuazione, Kirchensteuer stimata prima del proprio Sonderausgabenabzug. Base separata per Kinderfreibeträge sui supplementi. Il modello copre una persona assicurata; altri redditi del nucleo sono input separati.
- Proventi futuri: scelta fra anni verificati e confronto a regole 2026 costanti. La seconda modalità rinnova il Freibetrag annuale, riporta le perdite e non assume redditi esterni o crediti esteri futuri. Non confonde queste proiezioni con le imposte effettive 2027.
- Retrocompatibilità: nuovi campi JSON con default, modalità precedenti conservate; nessuna migration DB aggiuntiva. Motori specifici in `countries/de-avd.ts` e `countries/de-pension.ts`, indipendenti dalla lingua.

### Fonti verificate il 15 ottobre 2026

- Riforma approvata (non usare i valori della proposta dicembre 2025): https://www.bundesregierung.de/breg-de/aktuelles/reform-private-altersvorsorge-2400072
- BMF, dettagli AVD: https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge
- EStG §22 (coorti, Ertragsanteil e prestazioni agevolate): https://www.gesetze-im-internet.de/estg/__22.html
- EStG §32a: https://www.gesetze-im-internet.de/estg/__32a.html
- SolZG §§3–4: https://www.gesetze-im-internet.de/solzg_1995/BJNR097500993.html
- SGB V §§226 e 229 (franchigia, soglia, capitale): https://www.gesetze-im-internet.de/sgb_5/__226.html e https://www.gesetze-im-internet.de/sgb_5/__229.html
- DRV, ripartizione KV: https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/In-der-Rente/Kranken-und-Pflegeversicherung-der-Rentner/kranken-und-pflegeversicherung-der-rentner_node.html
- Valori sociali 2026: https://www.bmas.bund.de/DE/Service/Gesetze-und-Gesetzesvorhaben/sozialversicherungs-rechengroessenverordnung-2026.html
- Riforma redditi 2027 descritta come progetto: https://www.bundesfinanzministerium.de/Content/DE/Pressemitteilungen/Finanzpolitik/2026/09/2026-09-02-einkommensteuerreform.html . Non trattata come aliquote definitive.

### Restano esplicitamente fuori dalla copertura automatica

Imputazione di reddito del coniuge ai contributi sanitari, occupazione e capitali privati non periodici senza valutazione della Krankenkasse; verifica completa dell'ammissibilità alle agevolazioni; contratti bAV ex §19 e particolarità storiche; tassazione completa dei contributi misti senza certificazione; agevolazioni personali diverse dagli input; rendimento futuro effettivo; aliquote future non definitive; casistiche sugli investimenti elencate sopra. Questi limiti sono di copertura finanziaria, non traduzioni mancanti. La PR resta in bozza fino alla revisione dei nuovi flussi.

Verifica dell'estensione: 84 test mirati passati, build di produzione/TypeScript/lint passati. Suite completa: 2.302 passati, solo l'errore locale preesistente del logger sul percorso `/Users/mario`. Browser reale: modifica, salvataggio e rilettura AVD; impostazioni netto e proventi futuri persistenti; DE/en desktop e DE/de mobile su Pensione, Analitiche, Proventi senza errori o overflow. Piano demo originale ripristinato. Screenshot PR aggiornati, aggiunto netto pensionistico. Le date/età AVD devono concordare; inizio ordinario erogazione limitato a 65–70 anni, senza dedurre automaticamente deroghe di pensionamento anticipato.


Assicurazione volontaria completata per pensioni periodiche e altri redditi dichiarati: basi 2026, aliquota generale per GRV/bAV e ridotta per rendite private, affitti e redditi di capitale; nessuna franchigia bAV; sussidio DRV facoltativo confermato. I capitali privati non periodici non vengono scambiati per reddito: il netto resta non disponibile e richiede la valutazione dell'assicuratore. Fonti: https://www.tk.de/techniker/versicherung/gut-versichert-in-jeder-lebenslage/freiwillige-krankenversicherung-tk/beitragshoehe-freiwillig-versicherte-rentner-2006966 e https://www.aok.de/pk/krankenkassenbeitraege/freiwillige-krankenversicherung-client-plus/ . Quattro ulteriori test sui minimi, massimi, basi miste, sussidio e blocco delle prestazioni non periodiche; totale mirato 88.

Corretto anche il completamento della base minima volontaria: la differenza rispetto al reddito effettivo usa l’aliquota ridotta, anche quando il solo reddito è una piccola pensione GRV/bAV. Test di regressione incluso. I contributi sono stime annualizzate: gli arrotondamenti mensili dell’assicuratore possono produrre differenze di centesimi.

## Cambio di direzione: disponibilità essenziale, 15 ottobre

Su richiesta dell’utente, pensione/AVD, pensionamento e simulatori separati (vendita, crypto, Vorabpauschale e tariffa futura costante) sono sospesi fino alla sua revisione. Codice, test, schema, traduzioni e piani salvati restano conservati.
La configurazione per paese `planning-availability.ts` controlla la visibilità; sidebar, menu mobile e proxy impediscono anche l’accesso diretto alle sezioni sospese.
Restano liquidità, budget, debiti, investimenti, rendimenti, proventi e tasse parziali con limiti espliciti. La previsione dei proventi ignora le ipotesi future salvate mentre il relativo simulatore è spento, senza sovrascriverle.
La riattivazione avverrà una funzione alla volta dopo review, non automaticamente con il merge. Il catalogo pubblico riflette questo perimetro.

Verifica del perimetro ridotto: 88 test mirati, lint, TypeScript e build superati. Browser EN/DE desktop/mobile: navigazione e URL sospesi bloccati, tasse/proventi accessibili, dati nascosti conservati dopo il salvataggio tasse; nessun errore browser. Anteprima locale aggiornata, nessun merge.
