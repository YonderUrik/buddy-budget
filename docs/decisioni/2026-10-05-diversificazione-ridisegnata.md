# 2026-10-05 — Scheda Diversificazione ridisegnata (mobile first)

- **Mappa**: l'esposizione per area è una mappa a punti (terre emerse generate da Natural Earth, `scripts/generate-world-dot-map.mjs`). I dati sono le 7 aree dell'app, non i paesi: con un ETF globale si accendono pochi grandi blocchi, quindi la mappa è un colpo d'occhio e l'elenco sotto resta la fonte dei numeri. Toccando una riga la mappa la evidenzia.
- **Settori**: ogni settore ha un'icona (`sector-icons.ts`) e le stesse barre ordinate delle aree.
- **"Da dove vengono i dati"** e **Allocazione obiettivo** si aprono solo su richiesta (`Disclosure` / pulsante "Dettaglio").
- **Sovrapposizioni in parole**: giudizi tipo "Quasi lo stesso investimento" e "Si muovono quasi sempre insieme" al posto di percentuali e matrice (soglie in `lib/investments/plain-labels.ts`); la matrice completa resta in "Tabella completa".
- Rimandato: mappa per singolo paese (servirebbe la ripartizione per paese dalle fonti), landing/screenshot (li rigenera il workflow giornaliero).
