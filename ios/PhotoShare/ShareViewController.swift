import SwiftUI
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let provider = (extensionContext?.inputItems as? [NSExtensionItem])?.flatMap { $0.attachments ?? [] }.first { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }
        let host = UIHostingController(rootView: PhotoShareView(provider: provider) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        })
        addChild(host); view.addSubview(host.view); host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]; host.didMove(toParent: self)
    }
}
private struct PhotoShareView: View {
    let provider: NSItemProvider?
    let finish: () -> Void
    @State private var data: Data?
    @State private var error: String?
    @State private var saved = false
    @State private var busy = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    if let data, let image = UIImage(data: data) {
                        Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 320).clipShape(.rect(cornerRadius: Metrics.cardRadius))
                    } else if error == nil { ProgressView() }
                    Text(saved ? "Ready for the Studio." : "A fresh look starts here.").font(.display(.largeTitle))
                    Text(saved ? "Open Menu Material to choose a dish and style. Your photo is saved on this device." : "Save this photo to Menu Material, then finish it in the app.").foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                    if let error { Text(error).foregroundStyle(Palette.danger) }
                    Button(saved ? "Done" : "Save to Menu Material") {
                        if saved { finish(); return }
                        guard let data else { return }
                        busy = true
                        do { try SharedPhotoInbox.save(data); saved = true }
                        catch { self.error = error.localizedDescription }
                        busy = false
                    }.primaryAction().disabled(data == nil || busy)
                }.padding(Metrics.gutter)
            }.canvasBackground()
                .navigationTitle("Menu Material").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: finish) } }
                .tint(Palette.accent)
        }.task {
            guard let provider else { error = "Choose a photo to share."; return }
            do {
                let bytes = try await provider.loadDataRepresentation(for: .image)
                guard bytes.count <= 20 * 1024 * 1024, UIImage(data: bytes) != nil else { throw SharedPhotoInbox.InboxError.tooLarge }
                data = bytes
            } catch { self.error = error.localizedDescription }
        }
    }
}
private extension NSItemProvider {
    func loadDataRepresentation(for type: UTType) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            loadDataRepresentation(forTypeIdentifier: type.identifier) { data, error in
                if let data { continuation.resume(returning: data) }
                else { continuation.resume(throwing: error ?? SharedPhotoInbox.InboxError.unavailable) }
            }
        }
    }
}
