/** Limits and defaults of groups («Gruppi»), shared by the routes and the screens. */

/** People in one group, also those added by name: enough for a family or a trip with friends. */
export const MAX_HOUSEHOLD_MEMBERS = 10;
/** Groups one person can be in (a couple, a flat, a family...). */
export const MAX_HOUSEHOLDS_PER_USER = 5;
/** Days an invitation link stays valid. */
export const INVITE_TTL_DAYS = 7;
/** Longest group name. */
export const HOUSEHOLD_NAME_MAX = 40;
/** Names offered when creating a group (Italian, translated by the screen). */
export const HOUSEHOLD_NAME_SUGGESTIONS = ["Noi due", "Casa", "Famiglia", "Viaggio"] as const;

/** Words in an account name that suggest money of the house, in the app's languages. */
const HOUSEHOLD_ACCOUNT_WORDS = /\b(casa|comune|cointestat\w*|famiglia|condivis\w*|spese|joint|shared|household|family|home|gemeinsam\w*|haushalt|familie)\b/i;

/** True when an account's name suggests it holds money of the house: the app ticks it for the group by itself. */
export function looksLikeHouseholdAccount(name: string): boolean {
  return HOUSEHOLD_ACCOUNT_WORDS.test(name);
}
