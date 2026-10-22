import BuddyBudgetKit
import SwiftUI

private func t(_ source: String, _ values: [String: String] = [:]) -> String { L10n.lookup(italian: source, values) }

/// Liquidità · Conti (04-accounts-bank-sync, ACC-001…010, 043…051): renewal banner, sync jobs, accounts grouped by
/// bank then manual, «Aggiungi un conto»; hosts the New-account and detail sheets and «Conti trovati».
/// Twin of `AccountsScreen` on Android.
struct AccountsScreen: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(ShellModel.self) private var shell
    @State private var model: AccountsModel?
    /// Kept while the sheets animate out after their model is cleared.
    @State private var shownNew: NewAccountModel?
    @State private var shownDetail: Account?

    var body: some View {
        Group {
            if let model, let found = model.found {
                FoundAccountsScreen(model: found, onClose: { model.finishFound(started: $0) })
            } else {
                list
            }
        }
        .task {
            if model == nil {
                let created = AccountsModel(env: env)
                created.shell = shell
                model = created
                await created.start()
                created.consume(shell.accountsIntent)
                #if DEBUG
                applyDebug(created)
                #endif
            } else {
                await model?.start()
            }
        }
        .onChange(of: shell.accountsIntent) { _, intent in model?.consume(intent) }
        .onChange(of: model?.newAccount.map(ObjectIdentifier.init)) { _, _ in if let next = model?.newAccount { shownNew = next } }
        .onChange(of: model?.detail) { _, next in if let next { shownDetail = next } }
        .onDisappear { model?.stop() }
    }

    private var list: some View {
        BBScreen(title: nil, onRefresh: {
            await model?.refresh()
            await model?.loadJobs()
        }) {
            LiquiditySegmentBar()
            if let model {
                AccountsContent(model: model)
            } else {
                AccountsSkeleton()
            }
        }
        .bbSheet(isPresented: Binding(get: { model?.newAccount != nil }, set: { if !$0 { model?.newAccount = nil } })) {
            if let sheet = model?.newAccount ?? shownNew { NewAccountSheet(model: sheet) }
        }
        .background {
            Color.clear.bbSheet(isPresented: Binding(get: { model?.detailId != nil }, set: { if !$0 { model?.detailId = nil } })) {
                if let model, let account = model.detail ?? shownDetail {
                    AccountDetailSheet(model: model, account: account).id(account.id)
                }
            }
        }
    }

    #if DEBUG
    /// `-BBAccounts new|renew|bank|bankError|manual|manual2|detail|detailManual|delete|found|foundEmpty|job` (screenshots).
    private func applyDebug(_ model: AccountsModel) {
        guard let mode = DebugLaunch.value("-BBAccounts") else { return }
        AccountsDebug.apply(mode, to: model)
    }
    #endif
}

private struct AccountsContent: View {
    let model: AccountsModel

    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space8) {
            ForEach(model.jobs) { job in
                SyncJobCard(job: job, onDismiss: { model.dismiss(job) }, onCategorize: { model.navigate(AccountsPaths.categorize) })
            }
            if !model.alerts.isEmpty {
                RenewalBanner(alerts: model.alerts) { model.openNewAccount(renew: true) }
            }
            switch model.accounts {
            case .loading:
                AccountsSkeleton()
            case .failed:
                LoadError(message: t("Impossibile caricare i conti.")) { Task { await model.retry() } }
            case .loaded(let accounts) where accounts.isEmpty:
                EmptyState(icon: .landmark, title: t("Nessun conto ancora"),
                           description: t("Aggiungi un conto a mano o importa l'estratto conto: bastano un nome e il saldo."),
                           primary: BBStateAction(label: t("Aggiungi il primo conto")) { model.openNewAccount(renew: false) },
                           secondary: BBStateAction(label: t("Importa un file")) { model.navigate(AccountsPaths.imports) })
            case .loaded:
                ForEach(model.groups) { group in
                    AccountGroupSection(group: group, model: model)
                }
                BBButton(t("Aggiungi un conto"), icon: .plus, size: .touch) { model.openNewAccount(renew: false) }
            }
        }
    }
}

// MARK: - Groups and rows

private struct AccountGroupSection: View {
    let group: AccountGroup
    let model: AccountsModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: BBSpacing.space3) {
                BBText(t(group.label), style: .sectionHeading, lineLimit: 1)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                AmountText(value: group.total, currency: model.currency)
            }
            BBText(t(group.hint), style: BBTypography.body, color: .bbText2)
                .padding(.top, BBSpacing.space1)
                .padding(.bottom, BBSpacing.space3)
            VStack(spacing: BBSpacing.space2) {
                ForEach(group.accounts) { account in
                    AccountLine(account: account, status: model.status(account), currency: model.currency,
                                onOpen: { model.detailId = account.id }, onMovements: { model.showMovements(account) })
                }
            }
        }
    }
}

/// Account row (web `AccountLine`): avatar 44, name, type, status with tone, 30-day sparkline (linked, phone too),
/// balance; trailing list button → Movimenti filtered on the account.
struct AccountLine: View {
    let account: Account
    let status: AccountStatusLine
    let currency: String
    let onOpen: () -> Void
    let onMovements: () -> Void

    @Environment(\.bbLocale) private var locale
    @Environment(\.bbHideAmounts) private var hideAmounts

    var body: some View {
        let amount = BBFormat.formatCurrency(account.balance, currency: currency, locale: locale, masked: hideAmounts)
        HStack(spacing: BBSpacing.space1) {
            Button(action: onOpen) {
                HStack(spacing: BBSpacing.space3_5) {
                    BBIconBadge(icon: BBIcon.account(account.icon), color: .bbSwatch(account.color), diameter: 44, iconSize: 19)
                    VStack(alignment: .leading, spacing: 0) {
                        BBText(account.name, style: .rowTitle, lineLimit: 1)
                        BBText(account.type, style: BBTypography.body, color: .bbText2, lineLimit: 1)
                        AccountStatusText(status: status)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // Phone: the 30-day sparkline sits under the balance so the name keeps its width.
                    VStack(alignment: .trailing, spacing: BBSpacing.space1) {
                        AmountText(value: account.balance, currency: currency, tone: account.balance < 0 ? .neg : .neutral,
                                   style: BBTextStyle.rowAmount.with(size: 18, lineHeight: 28))
                        if let trend = account.trend, account.isLinked {
                            Sparkline(values: trend, width: 64, height: 20)
                        }
                    }
                    .fixedSize()
                }
                .padding(.horizontal, BBSpacing.space4)
                .padding(.vertical, BBSpacing.space3)
                .frame(minHeight: 68)
                .contentShape(Rectangle())
            }
            .buttonStyle(BBPressableStyle(pressedBackground: Color.bbForeground.opacity(0.04),
                                          shape: AnyShape(RoundedRectangle.bb(BBRadius.radius2xl)), translate: false))
            .accessibilityLabel(t("{0}, {1}, {2}. {3}. Apri i dettagli", ["0": account.name, "1": account.type, "2": amount, "3": t(status.label)]))
            Button(action: onMovements) {
                BBIconView(.listOrdered, size: .lg, color: .bbText2)
                    .frame(width: 48)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
            }
            .buttonStyle(BBPressableStyle(pressedBackground: Color.bbForeground.opacity(0.06),
                                          shape: AnyShape(RoundedRectangle.bb(BBRadius.radius2xl)), translate: false))
            .accessibilityLabel(t("Vedi i movimenti di {0}", ["0": account.name]))
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(RoundedRectangle.bb(BBRadius.radius2xl).fill(Color.bbForeground.opacity(0.04)))
    }
}

/// Status line with tone: warning = triangle + neg medium, progress = spinner + primary, else `--text-2`.
struct AccountStatusText: View {
    let status: AccountStatusLine

    var body: some View {
        HStack(spacing: BBSpacing.space1) {
            switch status.tone {
            case .warning: BBIconView(.triangleAlert, size: .sm, color: .bbNeg)
            case .progress: BBSpinner(size: .sm, color: .bbPrimary)
            default: EmptyView()
            }
            BBText(t(status.label), style: status.tone == .warning ? BBTypography.bodyStrong : BBTypography.body,
                   color: status.tone == .warning ? .bbNeg : (status.tone == .progress ? .bbPrimary : .bbText2), lineLimit: 1)
        }
    }
}

// MARK: - Renewal banner (ACC-007)

private struct RenewalBanner: View {
    let alerts: [RenewalAlert]
    let onRenew: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: BBSpacing.space3) {
            BBIconView(.triangleAlert, points: 18, color: .bbDestructive)
            VStack(alignment: .leading, spacing: BBSpacing.space0_5) {
                ForEach(alerts, id: \.connectionId) { alert in
                    BBText(accountsText(RenewalAlerts.message(alert)), style: BBTypography.body)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BBButton(t("Rinnova"), size: .sm, action: onRenew)
        }
        .padding(BBSpacing.space3)
        .background(RoundedRectangle.bb(BBRadius.xl).fill(Color.bbDestructive.opacity(0.1)))
        .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbDestructive.opacity(0.3), lineWidth: 1))
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Sync jobs (ACC-047…050)

struct SyncJobCard: View {
    let job: SyncJob
    let onDismiss: () -> Void
    let onCategorize: () -> Void

    var body: some View {
        let finished = SyncJobs.isFinished(job)
        let failed = job.status == .failed || job.interrupted
        BBCard(size: .sm) {
            HStack(spacing: BBSpacing.space2) {
                Group {
                    if !finished {
                        BBSpinner(size: .md, color: .bbPrimary)
                    } else if failed {
                        BBIconView(.circleAlert, size: .lg, color: .bbNeg)
                    } else {
                        BBIconView(.circleCheck, size: .lg, color: .bbPos)
                    }
                }
                .frame(width: 24, height: 24)
                BBText(accountsText(SyncJobs.title(job)), style: BBTypography.bodyStrong, lineLimit: 1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if finished {
                    BBIconButton(icon: .x, accessibilityLabel: t("Chiudi riepilogo"), color: .bbMutedForeground, action: onDismiss)
                        .frame(width: 28, height: 28)
                }
            }
            if case .determinate(let value, let max) = SyncJobs.overallProgress(job), !finished {
                ProgressBar(state: .determinate(value: value, max: max), label: accountsText(SyncJobs.title(job)))
            }
            VStack(alignment: .leading, spacing: BBSpacing.space3) {
                ForEach(job.accounts, id: \.accountId) { account in
                    SyncAccountRow(account: account, interrupted: job.interrupted)
                }
            }
            // SHELL-046: a finished job with errors offers the report (area `sync_banca`), then «Categorizza».
            let someError = failed || job.accounts.contains { SyncJobs.describe($0, interrupted: job.interrupted).tone == .error }
            if finished && (someError || SyncJobs.uncategorized(job) > 0) {
                HStack(spacing: BBSpacing.space3) {
                    if someError { ReportErrorLink(area: .syncBanca, error: accountsText(SyncJobs.title(job))) }
                    if SyncJobs.uncategorized(job) > 0 { BBButton(t("Categorizza"), size: .sm, action: onCategorize) }
                }
            }
        }
    }
}

private struct SyncAccountRow: View {
    let account: SyncJobAccount
    let interrupted: Bool

    var body: some View {
        let progress = SyncJobs.describe(account, interrupted: interrupted)
        VStack(alignment: .leading, spacing: BBSpacing.space1_5) {
            BBText(account.name, style: BBTypography.bodyStrong, lineLimit: 1)
            BBText(accountsText(progress.text), style: BBTypography.caption,
                   color: progress.tone == .error ? .bbNeg : (progress.tone == .success ? .bbForeground : .bbMutedForeground))
            switch progress.bar {
            case .none: EmptyView()
            case .indeterminate:
                ProgressBar(state: .indeterminate, label: t("Avanzamento {0}", ["0": account.name]))
            case .determinate(let value, let max):
                ProgressBar(state: .determinate(value: value, max: max), label: t("Avanzamento {0}", ["0": account.name]),
                            color: progress.tone == .success ? .bbPos : .bbPrimary)
            }
        }
    }
}

// MARK: - Loading

private struct AccountsSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: BBSpacing.space3) {
            HStack(spacing: BBSpacing.space2_5) {
                BBSkeleton(width: 36, height: 36, radius: 18)
                BBSkeleton(width: 140, height: 20)
                Spacer(minLength: 0)
                BBSkeleton(width: 80, height: 20)
            }
            BBSkeleton(width: 120, height: 14)
            ForEach(0..<3, id: \.self) { _ in BBSkeleton(height: 68, radius: BBRadius.radius2xl) }
        }
        .accessibilityElement()
        .accessibilityLabel(L10n.loading)
    }
}
