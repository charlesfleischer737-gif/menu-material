import MenuMaterialKit
import SwiftUI

struct SharedFile: Identifiable {
    let url: URL
    var id: URL { url }
}

/// A finished photo beside the original, and what to do with it. Saving or
/// sharing marks it as chosen, as the web does before any download.
struct ResultView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let jobId: String
    let assetId: String
    let studio: StudioModel
    @State private var before: UIImage?
    @State private var after: UIImage?
    @State private var working: Action?
    @State private var share: SharedFile?
    @State private var note: String?
    @State private var error: String?
    @State private var revealed = false

    enum Action { case save, share, main }

    private var job: Job? { model.workspace?.jobs.first { $0.id == jobId } }
    private var dish: Dish? {
        guard let dishId = job?.dishId else { return nil }
        return model.workspace?.dishes.first { $0.id == dishId }
    }
    private var isMain: Bool { dish?.preferredPhotoId == assetId }
    private var title: String {
        guard let name = dish?.name, name != "Untitled dish" else { return "Your styled photo" }
        return name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            PhotoStage(ratio: ratio) {
                if let before, let after {
                    BeforeAfterSlider(before: Image(uiImage: before), after: Image(uiImage: after))
                } else if let after {
                    Image(uiImage: after).resizable().scaledToFill()
                } else {
                    ProgressView().tint(.white)
                }
            }
            .scaleEffect(revealed || reduceMotion ? 1 : 0.94)
            .blur(radius: revealed || reduceMotion ? 0 : 14)
            .opacity(revealed ? 1 : 0)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .symbolEffect(.bounce, value: revealed)
                    Text("Ready")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Palette.accent)
                Text(title)
                    .font(.display(.title))
                    .foregroundStyle(Palette.ink)
                Text("Drag to compare with your photo. Check the food and portions before you use it.")
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 12) {
                Button {
                    Task { await save() }
                } label: {
                    actionLabel(.save, "Save to Photos", "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .primaryAction()

                HStack(spacing: 12) {
                    Button {
                        Task { await prepareShare() }
                    } label: {
                        actionLabel(.share, "Share", "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .secondaryAction()
                    if job?.dishId != nil {
                        Button {
                            Task { await makeMain() }
                        } label: {
                            actionLabel(.main, isMain ? "Dish Photo" : "Use for Dish", isMain ? "checkmark.circle.fill" : "star")
                                .frame(maxWidth: .infinity)
                        }
                        .secondaryAction()
                        .disabled(isMain)
                    }
                }
            }
            .disabled(working != nil || after == nil)

            if let error { ErrorNote(message: error) }

            HStack(spacing: 12) {
                Button("Try Another Look", systemImage: "paintpalette") { studio.tryAnotherLook() }
                Spacer()
                Button("New Photo", systemImage: "camera") { studio.startOver() }
            }
            .font(.subheadline.weight(.semibold))
            .padding(.top, 4)
        }
        .toast($note)
        .task(id: assetId) { await loadImages() }
        .sheet(item: $share) { file in
            ShareSheet(items: [file.url])
                .presentationDetents([.medium, .large])
        }
        .sensoryFeedback(.success, trigger: revealed) { _, shown in shown }
    }

    private var ratio: CGFloat {
        guard let after, after.size.height > 0 else { return 1 }
        return after.size.width / after.size.height
    }

    @ViewBuilder
    private func actionLabel(_ action: Action, _ title: String, _ symbol: String) -> some View {
        if working == action {
            ProgressView()
        } else {
            Label(title, systemImage: symbol)
        }
    }

    private func loadImages() async {
        let result = await model.images.image(asset: assetId)
        var original: UIImage?
        if let sourceId = job?.sourceId {
            original = await model.images.image(asset: sourceId)
        }
        after = result
        before = original
        withAnimation(.smooth(duration: 0.9)) { revealed = true }
    }

    /// Marks the photo as chosen, then fetches the full-quality file.
    private func keep(_ use: String) async throws -> Data {
        let _: OK = try await model.client.post("assets/\(assetId)/use", PhotoUse(action: use))
        let data = try await model.images.download(asset: assetId)
        Task { await model.refresh() }
        return data
    }

    private func save() async {
        working = .save
        defer { working = nil }
        error = nil
        do {
            try await PhotoLibrary.save(try await keep("download"))
            note = "Saved to Photos"
        } catch let failure as APIError {
            error = failure.message
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func prepareShare() async {
        working = .share
        defer { working = nil }
        error = nil
        do {
            let data = try await keep("share")
            let url = try ShareFile.write(data, name: "\(title) – Menu Material", ext: ShareFile.ext(for: data))
            share = SharedFile(url: url)
        } catch let failure as APIError {
            error = failure.message
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// The dish's main photo, on My Dishes and wherever the dish appears.
    private func makeMain() async {
        guard let dishId = job?.dishId else { return }
        working = .main
        defer { working = nil }
        error = nil
        do {
            let _: OK = try await model.client.post("assets/\(assetId)/use", PhotoUse(action: "main"))
            let _: OK = try await model.client.post("library/\(dishId)", LibraryUpdate(preferredPhotoId: assetId))
            await model.refresh()
            note = "Now the dish’s main photo"
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}
