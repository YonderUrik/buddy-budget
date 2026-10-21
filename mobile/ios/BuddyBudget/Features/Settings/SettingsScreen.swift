import BuddyBudgetKit
import SwiftUI

/// Impostazioni hub (SET-001…004): list of the five groups, each pushing its detail screen; version at the bottom.
struct SettingsScreen: View {
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.settings
        BBScreen(title: L10n.settings, onBack: back) {
            VStack(alignment: .leading, spacing: BBSpacing.space5) {
                BBText(L10n.yourProfilePreferencesAndControlOve, style: BBTypography.body, color: .bbMutedForeground)
                    .padding(.top, -BBSpacing.space3)
                switch model.settings {
                case .loading:
                    VStack(spacing: BBSpacing.space3) {
                        ForEach(0..<5, id: \.self) { _ in BBSkeleton(height: 64, radius: BBRadius.xl) }
                    }
                case .failed:
                    LoadError(message: L10n.unableToLoadSettings) { Task { await model.loadSettings() } }
                case .loaded:
                    VStack(spacing: 0) {
                        ForEach(SettingsGroup.allCases, id: \.self) { group in
                            SettingsGroupRow(group: group) { shell.push(.settingsGroup(group)) }
                        }
                    }
                }
                BBText(L10n.version0(AppVersion.label), style: BBTypography.caption, color: .bbText3)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, BBSpacing.space4)
            }
        }
        .task { await model.start() }
    }
}

/// A Settings group (SET-002): «‹» back to the list, title, summary and its sections.
struct SettingsGroupScreen: View {
    let group: SettingsGroup
    @Environment(ShellModel.self) private var shell
    @Environment(\.shellBack) private var back

    var body: some View {
        let model = shell.settings
        BBScreen(title: L10n.lookup(italian: group.label), onBack: back) {
            VStack(alignment: .leading, spacing: BBSpacing.space8) {
                BBText(L10n.lookup(italian: group.summary), style: BBTypography.body, color: .bbMutedForeground)
                    .padding(.top, -BBSpacing.space3)
                if let settings = model.settings.value {
                    switch group {
                    case .account:
                        ProfileSection(model: model, settings: settings)
                        SessionsSection(model: model)
                    case .aspetto:
                        PreferencesSection(model: model, settings: settings)
                        InsightsModulesSettingsSection()
                    case .notifiche:
                        NotificationsSection(model: model, settings: settings)
                        AiSection(model: model)
                    case .privacy:
                        PrivacySection(model: model, settings: settings)
                        DataSection(model: model, settings: settings)
                    case .pericolo:
                        DangerZoneSection(model: model, settings: settings)
                    }
                } else if case .failed = model.settings {
                    LoadError(message: L10n.unableToLoadSettings) { Task { await model.loadSettings() } }
                } else {
                    BBSkeleton(height: 160, radius: BBRadius.xl)
                }
            }
        }
        .task {
            if model.settings.value == nil { await model.start() }
            await model.loadGroup(group)
        }
    }
}

// MARK: - Building blocks

/// Settings section (web `SettingsSection`): tinted icon tile 36 + title + description, then content.
struct SettingsSection<Content: View>: View {
    let title: String
    var description: String?
    let icon: BBIcon
    var danger = false
    let content: Content

    init(title: String, description: String? = nil, icon: BBIcon, danger: Bool = false, @ViewBuilder content: () -> Content) {
        self.title = title
        self.description = description
        self.icon = icon
        self.danger = danger
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            // taste-skill (#427): the section stands on its title, no icon tile (`icon` is kept for the callers).
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                BBText(title, style: .titleSmall.with(weight: 600), color: danger ? .bbNeg : .bbForeground)
                    .accessibilityAddTraits(.isHeader)
                if let description { BBText(description, style: BBTypography.body, color: .bbMutedForeground) }
            }
            VStack(alignment: .leading, spacing: BBSpacing.space4) { content }
        }
    }
}

/// A group in the Impostazioni list on the phone (web `SettingsHub`): the name as a condensed display title (30),
/// the summary under it and a chevron; no icon, no rules.
private struct SettingsGroupRow: View {
    let group: SettingsGroup
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: BBSpacing.space3) {
                VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                    BBText(L10n.lookup(italian: group.label), style: .sectionHeading.with(size: 30, lineHeight: 30),
                           color: group.isDanger ? .bbNeg : .bbForeground)
                    BBText(L10n.lookup(italian: group.summary), style: BBTypography.body, color: .bbText2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                BBIconView(.chevronRight, size: .md, color: .bbText3)
            }
            .padding(.horizontal, BBSpacing.space1)
            .padding(.vertical, BBSpacing.space3)
            .frame(minHeight: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(BBPressableStyle(pressedBackground: .bbMuted, shape: AnyShape(RoundedRectangle.bb(BBRadius.radius2xl)), translate: false))
        .accessibilityElement(children: .combine)
    }
}

/// Label + hint + control stacked (web `SettingsRow` on a phone), top border except the first.
struct SettingsRow<Content: View>: View {
    let label: String
    var hint: String?
    var first = false
    let content: Content

    init(label: String, hint: String? = nil, first: Bool = false, @ViewBuilder content: () -> Content) {
        self.label = label
        self.hint = hint
        self.first = first
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                BBText(label, style: BBTypography.bodyStrong)
                if let hint { BBText(hint, style: BBTypography.caption, color: .bbMutedForeground) }
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, first ? 0 : BBSpacing.space4)
    }
}

/// Label/hint on the left and a switch on the right (notification rows, AI toggles).
struct SettingsSwitchRow: View {
    let label: String
    var hint: String?
    var first = false
    @Binding var isOn: Bool
    var isDisabled = false
    /// The setting sends data to an AI model when on (SET-050).
    var ai = false

    var body: some View {
        HStack(alignment: .top, spacing: BBSpacing.space4) {
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                if ai {
                    HStack(spacing: BBSpacing.space2) {
                        BBText(label, style: BBTypography.bodyStrong)
                        AiBadge()
                    }
                } else {
                    BBText(label, style: BBTypography.bodyStrong)
                }
                if let hint { BBText(hint, style: BBTypography.caption, color: .bbMutedForeground) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BBSwitch(isOn: $isOn, accessibilityLabel: label, isDisabled: isDisabled)
        }
        .padding(.top, first ? 0 : BBSpacing.space4)
    }
}

/// Inline status line (success / error) under a control.
struct StatusLine: View {
    let text: String
    var success = false

    var body: some View {
        HStack(spacing: BBSpacing.space1) {
            if success { BBIconView(.check, points: 14, color: .bbPos) }
            BBText(text, style: BBTypography.caption, color: success ? .bbPos : .bbNeg)
        }
    }
}
