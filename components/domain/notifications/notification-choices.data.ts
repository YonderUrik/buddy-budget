import type { Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import {
  BUDGET_ALERT_THRESHOLDS,
  DEADLINE_LEAD_DAYS,
  NOTIFICATION_KIND_INFO,
  type DigestFrequency,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/notifications";

/** Campo delle preferenze che accende ogni tipo di email. */
export const PREFERENCE_FIELD_BY_KIND = {
  digest: "digestEnabled",
  budget: "budgetAlertsEnabled",
  deadlines: "deadlineAlertsEnabled",
  goals: "goalAlertsEnabled",
} as const satisfies Record<NotificationKind, keyof NotificationPreferences>;

export const NOTIFICATION_CHOICE_KINDS: readonly NotificationKind[] = ["digest", "budget", "deadlines"];

export const DIGEST_FREQUENCY_OPTIONS: readonly { value: DigestFrequency; label: string }[] = [
  { value: "settimanale", label: "Ogni settimana" },
  { value: "mensile", label: "Ogni mese" },
];

/** Testi brevi delle righe per l'onboarding, dove lo spazio è poco: i dettagli restano in Impostazioni. */
export const ONBOARDING_NOTIFICATION_INFO: Record<NotificationKind, { label: string; hint: string }> = {
  digest: { label: NOTIFICATION_KIND_INFO.digest.label, hint: "Speso, entrato e investimenti, in poche righe." },
  budget: { label: NOTIFICATION_KIND_INFO.budget.label, hint: "Quando una categoria si avvicina al limite del mese." },
  deadlines: { label: NOTIFICATION_KIND_INFO.deadlines.label, hint: "Prima della rata di un finanziamento." },
  goals: { label: NOTIFICATION_KIND_INFO.goals.label, hint: "A che punto sono i tuoi obiettivi di risparmio." },
};

/** Una riga della «casella» d'anteprima: quando arriva e che email è. */
export interface InboxPreviewItem {
  kind: NotificationKind;
  title: string;
  when: string;
}

const DIGEST_TITLE: Record<DigestFrequency, string> = { settimanale: "Riepilogo della settimana", mensile: "Riepilogo del mese" };
const DIGEST_WHEN: Record<DigestFrequency, string> = { settimanale: "Ogni lunedì", mensile: "Nei primi giorni del mese" };

/** The emails a user with these preferences will receive, in display order, with texts in `language`. Pure. */
export function inboxPreview(preferences: NotificationPreferences, language: Language = "it"): InboxPreviewItem[] {
  const t = (source: string, values?: Record<string, number>) => translate(language, source, values);
  const [first, second] = BUDGET_ALERT_THRESHOLDS;
  const items: (InboxPreviewItem | null)[] = [
    preferences.digestEnabled
      ? { kind: "digest", title: t(DIGEST_TITLE[preferences.digestFrequency]), when: t(DIGEST_WHEN[preferences.digestFrequency]) }
      : null,
    preferences.budgetAlertsEnabled ? { kind: "budget", title: t(NOTIFICATION_KIND_INFO.budget.label), when: t("All'{0}% e al {1}% di un budget", { 0: first, 1: second }) } : null,
    preferences.deadlineAlertsEnabled
      ? { kind: "deadlines", title: t(NOTIFICATION_KIND_INFO.deadlines.label), when: t("{0} giorni prima di una rata", { 0: DEADLINE_LEAD_DAYS }) }
      : null,
    preferences.goalAlertsEnabled ? { kind: "goals", title: t(NOTIFICATION_KIND_INFO.goals.label), when: t("Nei primi giorni del mese") } : null,
  ];
  return items.filter((item): item is InboxPreviewItem => item !== null);
}
