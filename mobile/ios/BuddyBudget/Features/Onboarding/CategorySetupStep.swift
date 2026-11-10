import BuddyBudgetKit
import SwiftUI

/// «Categorie» step (AUTH-030…034): enabled categories as chips per group, «Personalizza» opens the sheet.
struct CategorySetupStep: View {
    @Bindable var model: OnboardingModel
    @State private var open = false

    var body: some View {
        let active = CategorySetup.activeCount(model.categories)
        StepHeading(title: L10n.categoriesForYourTransactions,
                    description: model.customized ? L10n.youWillUse0GroupedBySpendingType(String(active))
                        : L10n.wePrepared0GroupedBySpendingTypeS(String(active)))
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            ForEach(CategorySetup.groups, id: \.type) { group in
                let items = model.categories.filter { $0.enabled && $0.type == group.type }
                if !items.isEmpty {
                    VStack(alignment: .leading, spacing: BBSpacing.space2) {
                        GroupHeader(group: group, count: items.count)
                        FlowRow(spacing: BBSpacing.space1_5, lineSpacing: BBSpacing.space1_5) {
                            ForEach(Array(items.enumerated()), id: \.offset) { _, item in CategoryChip(item: item) }
                        }
                    }
                }
            }
        }
        if let problem = model.problem, let message = model.message(problem) {
            BBErrorBox(message: message + " " + L10n.correctItInCustomiseOrContinueWith)
        }
        VStack(alignment: .leading, spacing: BBSpacing.space2) {
            BBButton(L10n.customise, icon: .slidersHorizontal, variant: .outline, size: .touch, fullWidth: true,
                     isDisabled: model.saving) { open = true }
            HStack(spacing: BBSpacing.space1_5) {
                BBIconView(.info, points: 14, color: .bbText3)
                BBText(L10n.findAndChangeThemAnytimeInCashCat, style: BBTypography.caption, color: .bbText3)
            }
        }
        .bbSheet(isPresented: $open, title: L10n.customizeCategories) {
            CategorySetupSheetContent(model: model) { open = false }
        }
    }
}

private struct GroupHeader: View {
    let group: CategorySetupGroup
    var count: Int?

    var body: some View {
        HStack(spacing: BBSpacing.space2) {
            Circle().fill(categoryGroupColor(group.type)).frame(width: 8, height: 8)
            BBText(L10n.lookup(italian: group.label), style: BBTypography.caption.with(weight: 500), color: .bbMutedForeground)
            if let count { BBText("·\(count)", style: BBTypography.caption.with(weight: 500), color: .bbText3) }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct CategoryChip: View {
    let item: CategoryProposalItem

    var body: some View {
        HStack(spacing: BBSpacing.space1_5) {
            BBIconBadge(icon: BBIcon.category(item.icon), color: .bbSwatch(item.color), diameter: 24, iconSize: 13)
            BBText(item.name.trimmingCharacters(in: .whitespaces), style: BBTypography.body, lineLimit: 1)
        }
        .padding(.leading, BBSpacing.space1)
        .padding(.trailing, BBSpacing.space3)
        .padding(.vertical, BBSpacing.space1)
        .background(Capsule().fill(Color.bbCard))
        .overlay(Capsule().strokeBorder(Color.bbBorder, lineWidth: 1))
    }
}

/// «Personalizza le categorie» (AUTH-031): per group, switch, tap the name to rename, «Aggiungi in <gruppo>».
private struct CategorySetupSheetContent: View {
    @Bindable var model: OnboardingModel
    let onDone: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space4) {
            BBText(L10n.turnOffThoseYouDonTUseAndTapAN, style: BBTypography.body, color: .bbMutedForeground)
            ForEach(CategorySetup.groups, id: \.type) { group in
                VStack(alignment: .leading, spacing: 0) {
                    GroupHeader(group: group).padding(.bottom, BBSpacing.space1)
                    ForEach(Array(model.categories.enumerated()), id: \.offset) { index, item in
                        if item.type == group.type {
                            SetupRow(model: model, index: index)
                            BBSeparator()
                        }
                    }
                    AddRow(model: model, group: group)
                }
            }
            if let problem = model.problem, let message = model.message(problem) {
                BBText(message, style: BBTypography.body, color: .bbNeg)
            }
            HStack(spacing: BBSpacing.space3) {
                BBButton(L10n.restore, variant: .ghost, size: .touch, isDisabled: !model.customized) { model.resetCategories() }
                Spacer(minLength: 0)
                BBButton("\(L10n.done_e1999f) \(CategorySetup.activeCount(model.categories)) \(L10n.active_1e6385)", size: .touch,
                         action: onDone)
            }
        }
    }
}

private struct SetupRow: View {
    @Bindable var model: OnboardingModel
    let index: Int
    @State private var editing = false
    @State private var draft = ""
    @State private var error: String?

    var body: some View {
        let item = model.categories[index]
        HStack(spacing: BBSpacing.space3) {
            BBAvatar(icon: BBIcon.category(item.icon), color: .bbSwatch(item.color))
                .opacity(item.enabled ? 1 : 0.45)
            VStack(alignment: .leading, spacing: BBSpacing.space1) {
                if editing {
                    BBTextField(text: $draft, error: error, submitLabel: .done, onSubmit: commit, autofocus: true)
                } else {
                    Button {
                        draft = item.name
                        error = nil
                        editing = true
                    } label: {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(spacing: BBSpacing.space2) {
                                BBText(item.name, style: BBTypography.bodyStrong, lineLimit: 1)
                                if item.optional {
                                    BBText(L10n.optional_d4c7b8, style: BBTypography.micro.with(weight: 400), color: .bbPrimary)
                                        .padding(.horizontal, BBSpacing.space2)
                                        .padding(.vertical, BBSpacing.space0_5)
                                        .background(Capsule().fill(Color.bbAlphaPrimary10))
                                }
                            }
                            if let description = item.description {
                                BBText(description, style: BBTypography.caption, color: .bbText3, lineLimit: 1)
                            }
                        }
                        .opacity(item.enabled ? 1 : 0.55)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(L10n.rename) \(item.name)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BBSwitch(isOn: Binding(get: { model.categories[index].enabled }, set: { model.toggle(index, $0) }),
                     accessibilityLabel: L10n.use0(item.name))
        }
        .frame(minHeight: 56)
        .padding(.vertical, BBSpacing.space2)
    }

    private func commit() {
        let trimmed = draft.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed != model.categories[index].name else {
            editing = false
            return
        }
        if let reason = model.rename(index, trimmed) {
            error = reason
        } else {
            editing = false
        }
    }
}

private struct AddRow: View {
    @Bindable var model: OnboardingModel
    let group: CategorySetupGroup
    @State private var open = false
    @State private var name = ""
    @State private var error: String?

    var body: some View {
        if open {
            BBTextField(text: $name, placeholder: L10n.nameThenEnter, error: error, submitLabel: .done, onSubmit: commit,
                        autofocus: true)
                .padding(.vertical, BBSpacing.space2)
        } else {
            Button { open = true } label: {
                HStack(spacing: BBSpacing.space2) {
                    BBIconView(.plus, size: .md, color: .bbPrimary)
                    BBText("\(L10n.addTo) \(L10n.lookup(italian: group.label))", style: BBTypography.body, color: .bbPrimary)
                }
                .frame(maxWidth: .infinity, minHeight: BBLayout.minTouchTarget, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private func commit() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            open = false
            return
        }
        if let reason = model.add(type: group.type, name: trimmed) {
            error = reason
        } else {
            name = ""
            error = nil
            open = false
        }
    }
}
