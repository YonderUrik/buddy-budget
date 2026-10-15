# Shorter Altro ("More") and Impostazioni (Settings) in groups (2026-10-11)

- **Altro (mobile)**: account, «Altre sezioni» ("Other sections"), «Assistenza» ("Support": Impostazioni, Aiuto e segnalazioni), the only quick toggle «Nascondi gli importi» ("Hide amounts") and «Il tuo quadro» ("Your picture") collapsed by default (the modules do not load data until it is opened). The theme is only in Impostazioni.
- **Impostazioni**: five groups (Account, Aspetto e uso, Notifiche e assistente, Privacy e dati, Zona pericolosa — "Account, Appearance and use, Notifications and assistant, Privacy and data, Danger zone") instead of nine blocks in a row. Desktop: index on the left, one group at a time. Mobile: list of groups, then the group with a back arrow. The group is in `?sezione=`; old links with an anchor (`#impostazioni-notifiche` in emails already sent) redirect to the right group.
- **Previews** (`settings-preview.tsx`): drawings with the theme tokens for sidebar/bottom bar (they really react to the toggles), summary email and assistant proposal.
- «Statistiche d'uso anonime» ("Anonymous usage statistics") moves from Preferenze to Privacy. Sections without grey box, with coloured icon (Panoramica standard).
- New Umami event `settings_group_opened`; `more_menu_clicked` loses `tema` and gains `aiuto`.
- Postponed: previews for currency/start page, search in settings, scroll-spy.
