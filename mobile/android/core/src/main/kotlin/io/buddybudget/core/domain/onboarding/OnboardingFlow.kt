package io.buddybudget.core.domain.onboarding

import io.buddybudget.core.data.DigestFrequency
import io.buddybudget.core.data.NotificationPreferences
import io.buddybudget.core.data.NotificationPreferencesPatch

/** Steps of the onboarding (AUTH-024). Same cases on iOS (`OnboardingStep`). */
enum class OnboardingStep(val raw: String) {
    Currency("valuta"),
    /** «Cosa vuoi tenere sotto controllo?» (AUTH-058, web #444). */
    Interests("interessi"),
    Categories("categorie"),
    Assistant("assistente"),
    Notifications("notifiche"),
    Confirmations("conferme"),
    ;

    companion object {
        /** The assistant step exists only when the server has the AI service. */
        fun steps(aiAvailable: Boolean): List<OnboardingStep> =
            if (aiAvailable) entries.toList() else listOf(Currency, Interests, Categories, Notifications, Confirmations)
    }
}

/** The email kinds of the notification choices (onboarding step and Settings › Notifiche). */
enum class NotificationKind(
    /** Label (Italian source). */
    val label: String,
    /** Hint in onboarding (`ONBOARDING_NOTIFICATION_INFO`). */
    val onboardingHint: String,
    /** Hint in Settings (`NOTIFICATION_KIND_INFO`). */
    val settingsHint: String,
    val iconKey: String,
) {
    Digest(
        "Riepilogo periodico", "Speso, entrato e investimenti, in poche righe.",
        "Entrate, uscite e investimenti del periodo appena concluso, in poche righe.", "calendar-range",
    ),
    Budget(
        "Avvisi sul budget", "Quando una categoria si avvicina al limite del mese.",
        "Una email quando una categoria arriva all'80% del budget mensile e quando lo supera.", "chart-pie",
    ),
    Deadlines(
        "Avvisi sulle scadenze", "Prima della rata di un finanziamento.",
        "Una email quando manca poco alla rata di un finanziamento, o quando è scaduta.", "calendar-clock",
    ),
    Goals(
        "Promemoria sugli obiettivi", "A che punto sono i tuoi obiettivi di risparmio.",
        "A inizio mese a che punto sono i tuoi obiettivi, e una email quando ne raggiungi uno o quando la data si avvicina.", "target",
    ),
    ;

    fun isOn(p: NotificationPreferences): Boolean = when (this) {
        Digest -> p.digestEnabled
        Budget -> p.budgetAlertsEnabled
        Deadlines -> p.deadlineAlertsEnabled
        Goals -> p.goalAlertsEnabled
    }

    fun set(on: Boolean, p: NotificationPreferences): NotificationPreferences = when (this) {
        Digest -> p.copy(digestEnabled = on)
        Budget -> p.copy(budgetAlertsEnabled = on)
        Deadlines -> p.copy(deadlineAlertsEnabled = on)
        Goals -> p.copy(goalAlertsEnabled = on)
    }

    fun patch(on: Boolean): NotificationPreferencesPatch = when (this) {
        Digest -> NotificationPreferencesPatch(digestEnabled = on)
        Budget -> NotificationPreferencesPatch(budgetAlertsEnabled = on)
        Deadlines -> NotificationPreferencesPatch(deadlineAlertsEnabled = on)
        Goals -> NotificationPreferencesPatch(goalAlertsEnabled = on)
    }

    companion object {
        /** Onboarding offers digest, budget and deadlines (no goal reminders, AUTH-036). */
        val onboarding = listOf(Digest, Budget, Deadlines)

        /** SET-023/024: goal reminders only where goals exist (hidden for DE). */
        fun settings(goalsAvailable: Boolean): List<NotificationKind> =
            if (goalsAvailable) entries.toList() else listOf(Digest, Budget, Deadlines)
    }
}

/** One row of the «Nella tua casella» preview (AUTH-037): Italian sources plus the `{0}` values. */
data class InboxPreviewItem(val kind: NotificationKind, val title: String, val `when`: String, val whenValues: List<String>)

object NotificationChoices {
    val budgetAlertThresholds = 80 to 100
    const val DEADLINE_ALERT_DAYS_BEFORE = 3

    /** Digest frequency labels: segmented control in onboarding, select in Settings. */
    fun onboardingLabel(frequency: DigestFrequency): String =
        if (frequency == DigestFrequency.settimanale) "Ogni settimana" else "Ogni mese"

    fun settingsLabel(frequency: DigestFrequency): String =
        if (frequency == DigestFrequency.settimanale) "Ogni settimana (lunedì)" else "Ogni mese (primi giorni)"

    /** The emails that will arrive with these preferences, in display order (web `inboxPreview`). */
    fun inboxPreview(p: NotificationPreferences): List<InboxPreviewItem> = buildList {
        if (p.digestEnabled) {
            val weekly = p.digestFrequency == DigestFrequency.settimanale
            add(
                InboxPreviewItem(
                    NotificationKind.Digest,
                    if (weekly) "Riepilogo della settimana" else "Riepilogo del mese",
                    if (weekly) "Ogni lunedì" else "Nei primi giorni del mese",
                    emptyList(),
                ),
            )
        }
        if (p.budgetAlertsEnabled) {
            add(
                InboxPreviewItem(
                    NotificationKind.Budget, NotificationKind.Budget.label, "All'{0}% e al {1}% di un budget",
                    listOf(budgetAlertThresholds.first.toString(), budgetAlertThresholds.second.toString()),
                ),
            )
        }
        if (p.deadlineAlertsEnabled) {
            add(
                InboxPreviewItem(
                    NotificationKind.Deadlines, NotificationKind.Deadlines.label, "{0} giorni prima di una rata",
                    listOf(DEADLINE_ALERT_DAYS_BEFORE.toString()),
                ),
            )
        }
        if (p.goalAlertsEnabled) {
            add(InboxPreviewItem(NotificationKind.Goals, NotificationKind.Goals.label, "Nei primi giorni del mese", emptyList()))
        }
    }
}
