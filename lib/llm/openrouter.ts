/**
 * Provider routing sent with every OpenRouter request: only zero data retention endpoints (`zdr`) that don't collect
 * data for training (`data_collection`). If no endpoint qualifies, OpenRouter rejects the request instead of routing it
 * elsewhere. The hosted account also enforces ZDR for all models in its privacy settings; the two combine with OR, so
 * self-hosted installs with their own key keep the per-request guarantee. Privacy policy section «zero-data-retention».
 */
export const OPENROUTER_PRIVACY = { zdr: true, data_collection: "deny" } as const;
