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
