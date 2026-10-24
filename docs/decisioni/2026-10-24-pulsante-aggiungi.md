# One «Aggiungi» button for the whole app (2026-10-24)

Daniele asked for one central add button instead of one per section (Liquidità, Investimenti, Debiti, Pensione…), mainly in the phone's bottom bar but also on desktop. Three options were shown from the real app (A: + in the middle of the bar, list, pill in the sidebar with the panel next to it; B: round + beside the bar, tiles; C: like A with a search field and a keyboard shortcut). He chose B on the phone and A on desktop, and asked for a hierarchy by how often things are added (an account once, movements every week; loans and pension funds rarely), easy to use above all.

- Phone: a yellow round + beside the bottom capsule; Debiti moves to «Altro» so every label fits. The sheet shows the frequent things as two big pairs with a yellow disc (a movement, an investment operation; transactions from a file, the broker statement) and the others smaller under «Ogni tanto» (account, subscription, mortgage or loan, pension fund, goal).
- Desktop: a grey pill «Aggiungi» under the logo, the list next to it with the same two tiers. The order never depends on the page.
- Forms open over the current page; file import, pension data and goals go to their page. The section headers lose their add buttons; empty states keep theirs. `?aggiungi=` links open a form (the loan step of «Primi passi», the «Novità» entry).
- Umami `quick_add_opened` and `quick_add_chosen` (with `here`) tell whether people add from where they are and what they add most; the tiers can be revisited with that data.

Rejected: the + in the middle of the bar (A on the phone) and the search field with shortcut (C); tiers that learn from each user's habits (positions would move).
