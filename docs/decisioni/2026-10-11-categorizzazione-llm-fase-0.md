# Categorization with an LLM (Jev): plan and Phase 0

- **Decision (2026-10-11)**: categorization is rebuilt around Jev (`typesafe/jev-1.13` on OpenRouter), a classifier that returns a probability for each category. Every proposal must be confirmed by the user; choosing a category does not create a rule (only with «Ricorda per questo esercente», "Remember for this merchant"); past rules are deleted in a final phase (export, backup, dry-run, typed confirmation); categories already assigned remain. Full plan: Claude Doc «Categorizzazione con LLM: piano di sviluppo».
- **Phase 0 (this PR)**: Jev client (`lib/llm/jev.ts`, request with ZDR and without amounts/identifiers), evaluation metrics and local script `pnpm eval:categorization` (`extract` + `run`). No change to the app's behaviour.
- **To do before Phase 1**: run the script on your own transactions, get written confirmation that Jev does not retain the data (API in alpha), choose the confidence threshold.
- **Postponed**: web search (Jev does not search), cross-user cache, revised Categorizza page (Phase 2).
- **No landing impact**; no new signal in production (script local only).
