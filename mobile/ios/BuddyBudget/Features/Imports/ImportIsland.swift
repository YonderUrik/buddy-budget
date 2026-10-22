import BuddyBudgetKit
import SwiftUI

/// Global import island (IMP-058/059): one compact pill per job created in the last 24 h and not dismissed, above the
/// bottom bar on every screen (mobile note). Running pills can't be closed; finished ones remember their dismissal on
/// the device. Twin of `ImportIsland` on Android.
struct ImportIsland: View {
    let model: ImportsModel
    let onDetail: (String) -> Void

    var body: some View {
        let jobs = model.islandJobs
        if !jobs.isEmpty {
            VStack(spacing: BBSpacing.space2) {
                ForEach(jobs) { job in
                    ImportIslandCard(job: job, source: model.listing?.formatName(job.formatId) ?? "file",
                                     onDetail: { onDetail(job.id) }, onDismiss: { withAnimation { model.dismissIsland(job.id) } })
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.horizontal, BBSpacing.space4)
            .padding(.bottom, BBSpacing.space2)
            .animation(.spring(duration: 0.35, bounce: 0.25), value: jobs.map(\.id))
        }
    }
}

struct ImportIslandCard: View {
    let job: PersonalImportListing.Job
    let source: String
    let onDetail: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        let state = PersonalImportRules.islandState(job.status)
        let running = state == .running
        let text = PersonalImportRules.islandText(job, source: source)
        let title = L10n.lookup(italian: text.title.template, text.title.values)
        HStack(spacing: BBSpacing.space3) {
            Group {
                if running {
                    BBSpinner(size: .lg, color: .bbIslandForeground)
                } else if job.status == "correction_ready" {
                    BBIconView(.circleAlert, size: .lg, color: .bbPrimary)
                } else if state == .failed {
                    BBIconView(.circleAlert, size: .lg, color: .bbIslandNeg)
                } else {
                    BBIconView(.check, points: 14, color: .bbIslandBackground).frame(width: 20, height: 20).background(Circle().fill(Color.bbIslandPos))
                }
            }
            .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 0) {
                if running {
                    ShimmerText(text: title, style: BBTypography.bodyStrong, color: .bbIslandForeground)
                } else {
                    BBText(title, style: BBTypography.bodyStrong, color: .bbIslandForeground, lineLimit: 1)
                }
                BBText(L10n.lookup(italian: text.detail.template, text.detail.values), style: BBTypography.caption, color: .bbIslandMuted, lineLimit: 1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            Button(action: onDetail) {
                BBText(L10n.lookup(italian: "Dettaglio"), style: BBTypography.bodyStrong, color: running ? .bbIslandMuted : .bbIslandBackground)
                    .padding(.horizontal, BBSpacing.space3)
                    .frame(minHeight: 32)
                    .background(Capsule().fill(running ? Color.clear : Color.bbIslandForeground))
                    .frame(minHeight: BBLayout.minTouchTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if !running {
                Button(action: onDismiss) {
                    BBIconView(.x, points: 15, color: .bbIslandMuted)
                        .frame(width: 32, height: 32)
                        .frame(minWidth: BBLayout.minTouchTarget, minHeight: BBLayout.minTouchTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L10n.lookup(italian: "Chiudi riepilogo importazione"))
            }
        }
        .padding(.leading, BBSpacing.space3)
        .padding(.trailing, BBSpacing.space1)
        .padding(.vertical, BBSpacing.space1)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.bbIslandBackground))
        .bbShadow(BBShadow.xl)
    }
}
