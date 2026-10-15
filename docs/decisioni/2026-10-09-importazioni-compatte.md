# More compact and better explained imports (2026-10-09)

In the Operazioni tab of Investimenti the Importazioni section moves to the bottom of the page, after the operations, with an always-visible explanation (what they are, how to update a period) and the list collapsed by default («Vedi e gestisci i file caricati», "See and manage uploaded files", with a summary). Inside the list a sentence explains what «Elimina» ("Delete") does (it undoes the import) and the advanced options remain. No change to data or APIs. Rejected: removing the section, because it is the only place to undo an import.

Same PR: the «I tuoi CSV» ("Your CSVs") page (`/importazioni`) moves to the Panoramica style: open sections with tinted icon (Carica un file, Le tue importazioni, analisi in corso, dettaglio — "Upload a file, Your imports, analysis in progress, detail"), no boxes, row list with dot status and an explanation of how it works at the top. Logic and APIs unchanged.

Second pass on «I tuoi CSV»: the explanation sits below the title of each section (Carica un file, analisi in corso, Le tue importazioni), as in the other pages; a step-by-step path at the top was tried and rejected. When the import is complete, links to Liquidità and to the operations appear; an analysis in progress is selected automatically.
