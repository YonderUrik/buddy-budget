import BuddyBudgetKit
import SwiftUI

// Building blocks of the German planning screens (web `fields.tsx`, `planning-screen.tsx`): panel, result row, numeric
// field with clamping, checkbox row, disclosure, save bar, footer. Twin: GermanPlanningComponents.kt.

/// Translates a planning catalog key (English source keys in this area).
func planningText(_ key: String) -> String { L10n.lookup(italian: key) }

/// Web `Panel`: card with a section title.
struct PlanningPanel<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        BBCard {
            BBText(title, style: .sectionHeading).accessibilityAddTraits(.isHeader)
            content
        }
    }
}

/// Muted explanatory paragraph (web `text-sm text-muted-foreground`).
struct PlanningNote: View {
    let text: String
    var body: some View {
        BBText(text, style: BBTypography.body, color: .bbMutedForeground)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Web `Result`: label left, amount right.
struct PlanningResultRow: View {
    let row: GermanPlanningRow
    var muted = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space4) {
            BBText(row.label, style: BBTypography.body)
                .frame(maxWidth: .infinity, alignment: .leading)
            BBText(row.value, style: BBTypography.body, color: muted ? .bbMutedForeground : .bbForeground)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .layoutPriority(1)
        }
        .padding(.vertical, BBSpacing.space2)
        .accessibilityElement(children: .combine)
    }
}

/// Web `NumberField` (PLAN-015): decimal keypad, values clamped as typed (the text is replaced by the limit), empty = 0,
/// the minimum shown as helper text.
struct PlanningNumberField: View {
    let label: String
    let value: Double
    var min: Double = 0
    var max: Double = PlanningNumberInput.defaultMax
    let onChange: (Double) -> Void

    @Environment(\.bbLocale) private var locale
    @State private var text: String?

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBTextField(label: label, text: Binding(get: { text ?? PlanningNumberInput.text(value, locale: locale) }, set: { typed in
                if PlanningNumberInput.needsClamp(text: typed, min: min, max: max) {
                    let clamped = PlanningNumberInput.value(text: typed, min: min, max: max)
                    text = PlanningNumberInput.text(clamped, locale: locale)
                    onChange(clamped)
                } else {
                    text = typed
                    onChange(PlanningNumberInput.value(text: typed, min: min, max: max))
                }
            }), keyboard: .amount)
            BBText(L10n.lookup(italian: "Min. {0}", ["0": BBFormat.formatCurrency(min, currency: GermanPlanningText.currency, locale: locale, maximumFractionDigits: 0)]),
                   style: BBTypography.caption, color: .bbMutedForeground)
        }
        .onChange(of: value) { _, new in
            // Discard / reload / save: show the stored value unless the typed text already means it.
            if let text, PlanningNumberInput.value(text: text, min: min, max: max) != new { self.text = nil }
        }
    }
}

/// Web `Choice`: native picker (sheet) with translated labels and stable stored values.
struct PlanningChoice: View {
    let label: String
    let options: [GermanPlanningOption]
    let value: String
    let onChange: (String) -> Void

    var body: some View {
        BBSelect(label: label, options: options.map { ($0.value, $0.label) },
                 selection: Binding(get: { value }, set: { onChange($0) }))
    }
}

/// Checkbox with its sentence (the whole row toggles).
struct PlanningCheckRow: View {
    let label: String
    let isOn: Bool
    let onChange: (Bool) -> Void

    var body: some View {
        Button { onChange(!isOn) } label: {
            HStack(alignment: .top, spacing: BBSpacing.space2) {
                BBCheckbox(isOn: Binding(get: { isOn }, set: { onChange($0) }), accessibilityLabel: label)
                    .padding(.top, 2)
                    .allowsHitTesting(false)
                BBText(label, style: BBTypography.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(isOn ? "1" : "0")
        .accessibilityAddTraits(.isToggle)
    }
}

/// Web `<details>`: a disclosure row with a chevron.
struct PlanningDisclosure<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    @State private var open = PlanningDisclosureDebug.openInitially

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.easeOut(duration: BBMotion.durationFast)) { open.toggle() } } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBIconView(.chevronRight, size: .md, color: .bbMutedForeground)
                        .rotationEffect(.degrees(open ? 90 : 0))
                    BBText(title, style: BBTypography.bodyStrong)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: BBLayout.minTouchTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityValue(open ? "1" : "0")
            if open { content }
        }
    }
}

/// Bulleted line (web `list-disc`).
struct PlanningBullet: View {
    let text: String
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: BBSpacing.space2) {
            Circle().fill(Color.bbForeground).frame(width: 4, height: 4).alignmentGuide(.firstTextBaseline) { $0[.bottom] + 4 }
            BBText(text, style: BBTypography.body)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// PLAN-017: disclaimer and the official sources (open in the browser).
struct PlanningFooter: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBText(planningText("Planning estimates for German residents holding private assets. Results depend on complete records and your assumptions; they do not replace a tax return or pension statement."),
                   style: BBTypography.caption, color: .bbMutedForeground)
            PlanningDisclosure(title: planningText("Rules and official sources")) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(GermanPlanningText.sources) { source in
                        Button { if let url = URL(string: source.url) { openURL(url) } } label: {
                            HStack(spacing: BBSpacing.space2) {
                                BBText(source.label, style: BBTypography.body, color: .bbPrimary)
                                BBIconView(.externalLink, size: .sm, color: .bbPrimary)
                                Spacer(minLength: 0)
                            }
                            .frame(minHeight: BBLayout.minTouchTarget)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(.isLink)
                    }
                }
                .padding(.leading, BBSpacing.space6)
            }
        }
    }
}

/// PLAN-010…013 messages (web `role="alert"` lines) shown in the bottom save bar, next to the button they explain:
/// save failure / conflict (with «Reload»), invalid plan.
struct PlanningMessages: View {
    let model: GermanPlanningModel
    let editor: GermanPlanEditor

    var body: some View {
        if let message = editor.message {
            HStack(alignment: .center, spacing: BBSpacing.space2) {
                BBErrorBox(message: planningText(message.key))
                if message == .conflict {
                    BBButton(planningText("Reload"), icon: .refreshCw, variant: .outline, size: .sm) { model.reloadPrompt = true }
                }
            }
        }
        if let key = editor.validationKey {
            BBErrorBox(message: planningText(key))
        }
    }
}

/// Bottom save bar (mobile adaptation of the web sticky bar, PLAN-010): status and `Save plan`.
struct GermanPlanSaveBar: View {
    let model: GermanPlanningModel

    var body: some View {
        if let editor = model.editor, model.phase == .loaded {
            VStack(spacing: 0) {
                BBSeparator()
                if editor.message != nil || editor.validationKey != nil {
                    VStack(alignment: .leading, spacing: BBSpacing.space2) { PlanningMessages(model: model, editor: editor) }
                        .padding(.horizontal, BBSpacing.space4)
                        .padding(.top, BBSpacing.space3)
                }
                HStack(spacing: BBSpacing.space3) {
                    BBText(planningText(editor.statusKey), style: BBTypography.body, color: editor.isDirty ? .bbForeground : .bbMutedForeground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    BBButton(planningText(editor.buttonKey), isLoading: editor.saving, isDisabled: !editor.canSave) {
                        Task { await model.save() }
                    }
                }
                .padding(.horizontal, BBSpacing.space4)
                .padding(.vertical, BBSpacing.space3)
            }
            .background(Color.bbBackground.ignoresSafeArea(edges: .bottom))
        }
    }
}

/// Loading / error / unsupported currency around a planning screen (PLAN-007, PLAN-009).
struct GermanPlanningContainer<Content: View>: View {
    let model: GermanPlanningModel
    let title: String
    @ViewBuilder let content: (GermanPlanEditor, PlanningResults) -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space6) {
            BBText(title, style: .sectionHeading).accessibilityAddTraits(.isHeader)
            switch model.phase {
            case .loading:
                VStack(spacing: BBSpacing.space6) {
                    BBSkeleton(height: 288, radius: BBRadius.xl)
                    BBSkeleton(height: 160, radius: BBRadius.xl)
                }
            case .failed:
                LoadError(message: planningText("Could not load the plan."), onRetry: { model.retry() })
            case .loaded:
                if let editor = model.editor, let results = model.savedResults {
                    if results.supported {
                        content(editor, results)
                        PlanningFooter()
                    } else {
                        PlanningNote(text: planningText("German financial planning currently requires account currency EUR. Your saved data has not been changed."))
                    }
                }
            }
        }
        .task { await model.start() }
    }
}

/// DEBUG `-BBSheet open`: disclosures start open (screenshots of the expanded lists).
@MainActor enum PlanningDisclosureDebug {
    static var openInitially: Bool {
        #if DEBUG
        DebugLaunch.value("-BBSheet") == "open"
        #else
        false
        #endif
    }
}
