import BuddyBudgetKit
import SwiftUI
import UniformTypeIdentifiers

/// A file picked in Files or shared to the app: name and bytes (read once; the URL is not kept).
struct PickedFile: Equatable, Sendable {
    let name: String
    let data: Data
}

/// File types offered by the imports (IMP-017, INV-093, PEN-014): CSV, plain text, TSV and Excel. Legacy `.xls` is
/// listed so the app can explain why it can't be read (IMP-019).
enum ImportFileTypes {
    static var all: [UTType] {
        var types: [UTType] = [.commaSeparatedText, .tabSeparatedText, .plainText, .text]
        if let xlsx = UTType("org.openxmlformats.spreadsheetml.sheet") { types.append(xlsx) }
        if let xls = UTType("com.microsoft.excel.xls") { types.append(xls) }
        return types
    }

    /// Reads a URL from the picker or from «Apri in…» (security-scoped when outside the sandbox).
    static func read(_ url: URL) -> PickedFile? {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return PickedFile(name: url.lastPathComponent, data: data)
    }

    /// Writes a file to the temporary directory for the share sheet (template download, PEN-018).
    static func temporaryFile(name: String, data: Data) -> URL? {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("templates", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}

extension View {
    /// System document picker filtered to the import types; `multiple` for broker statements (INV-093).
    func importFilePicker(isPresented: Binding<Bool>, multiple: Bool = false, onPick: @escaping ([PickedFile]) -> Void) -> some View {
        fileImporter(isPresented: isPresented, allowedContentTypes: ImportFileTypes.all, allowsMultipleSelection: multiple) { result in
            guard case .success(let urls) = result else { return }
            let files = urls.compactMap(ImportFileTypes.read)
            if !files.isEmpty { onPick(files) }
        }
    }
}

/// Text that pulses while work is in progress (the web's `TextShimmer`).
struct ShimmerText: View {
    let text: String
    var style: BBTextStyle = BBTypography.body
    var color: Color = .bbForeground
    @State private var dim = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        BBText(text, style: style, color: color, lineLimit: 1)
            .opacity(dim ? 0.55 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { dim = true }
            }
    }
}

/// Dashed drop-zone-like button that opens the picker (no drag and drop on phone).
struct FilePickZone: View {
    let title: String
    let subtitle: String
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: BBSpacing.space2) {
                if busy { BBSpinner(size: .lg, color: .bbMutedForeground) } else { BBIconView(.upload, size: .lg, color: .bbMutedForeground) }
                BBText(title, style: BBTypography.bodyStrong).multilineTextAlignment(.center)
                BBText(subtitle, style: BBTypography.caption, color: .bbMutedForeground).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: 144)
            .padding(BBSpacing.space6)
            .overlay(RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }
}

/// Row of a chosen or received file: icon, name, detail, optional remove button.
struct ImportFileRow: View {
    let name: String
    let detail: String
    var filled = true
    var removeLabel: String?
    var onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: BBSpacing.space3) {
            BBIconView(.fileSpreadsheet, size: .lg, color: .bbMutedForeground)
                .frame(width: 40, height: 40)
                .background(Circle().fill(filled ? Color.bbBackground : Color.bbMuted))
            VStack(alignment: .leading, spacing: 2) {
                BBText(name, style: BBTypography.bodyStrong, lineLimit: 1)
                BBText(detail, style: BBTypography.caption, color: .bbMutedForeground, lineLimit: 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let onRemove {
                BBIconButton(icon: .x, accessibilityLabel: removeLabel ?? "", action: onRemove)
            }
        }
        .padding(BBSpacing.space3)
        .background {
            if filled {
                RoundedRectangle.bb(BBRadius.xl).fill(Color.bbAlphaMuted50)
            } else {
                RoundedRectangle.bb(BBRadius.xl).strokeBorder(Color.bbBorder)
            }
        }
    }
}

/// Inline text link (web `text-primary font-medium hover:underline` buttons and links), 44 pt tall hit area.
struct TextLinkButton: View {
    let title: String
    let action: () -> Void

    init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            BBText(title, style: BBTypography.bodyStrong, color: .bbPrimary)
                .bbHitArea(height: 20)
        }
        .buttonStyle(.plain)
    }
}

/// Sentence with inline links (the web's `text … <Link>…</Link> …`): one wrapping text, link parts in the primary
/// colour, each calling its action.
struct InlineLinkText: View {
    struct Part {
        let text: String
        var action: (() -> Void)?
    }

    let parts: [Part]
    var style: BBTextStyle = BBTypography.body
    var color: Color = .bbMutedForeground

    var body: some View {
        var attributed = AttributedString()
        for (index, part) in parts.enumerated() {
            var piece = AttributedString(part.text)
            if part.action != nil {
                piece.link = URL(string: "bbinline://\(index)")
                piece.foregroundColor = .bbPrimary
                piece.font = style.with(weight: 500).font
            } else {
                piece.foregroundColor = color
                piece.font = style.font
            }
            attributed += piece
        }
        return Text(attributed)
            .tint(.bbPrimary)
            .environment(\.openURL, OpenURLAction { url in
                if url.scheme == "bbinline", let index = Int(url.host ?? ""), index < parts.count { parts[index].action?() }
                return .handled
            })
    }
}
