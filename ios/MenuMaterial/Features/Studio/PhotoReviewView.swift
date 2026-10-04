import MenuMaterialKit
import SwiftUI

struct PhotoCorrectionView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let assetId: String
    @State private var reason = "ingredients"
    @State private var detail = ""
    @State private var eligibility: Correction?
    @State private var error: String?
    @State private var busy = false
    private struct Correction: Decodable {
        var status: String
        var message: String?
        var canReport: Bool?
        var jobId: String?
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(eligibility?.message ?? "We’ll check whether this photo is eligible for a complimentary food correction.")
                    Picker("What changed?", selection: $reason) {
                        Text("Ingredients").tag("ingredients"); Text("Portion size").tag("portion"); Text("Plating").tag("plating")
                        Text("Branding").tag("branding"); Text("Looks artificial").tag("artificial"); Text("Something else").tag("other")
                    }
                    TextField("Tell us what needs to match your original", text: $detail, axis: .vertical).lineLimit(3...6)
                } footer: { Text("Reporting removes this photo from places where guests see it. Your original is kept. A food correction follows the same image-processing consent you gave in Studio.") }
                if let error { Section { ErrorNote(message: error); Button("Retry") { Task { await load() } } } }
                if let eligibility, eligibility.canReport != false {
                    Button(busy ? "Submitting…" : "Report and Correct") { Task { await submit() } }.disabled(busy)
                } else if eligibility == nil && error == nil { ProgressView() }
            }.navigationTitle("Correct This Photo").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) } }
        }.task { await load() }.interactiveDismissDisabled(busy)
    }
    private func load() async {
        do { eligibility = try await model.client.get("photo-corrections/\(assetId)"); error = nil }
        catch { self.error = error.localizedDescription }
    }
    private func submit() async {
        struct Report: Encodable { let reason: String; let detail: String }
        busy = true; defer { busy = false }
        do {
            let result: Correction = try await model.client.post("photo-corrections/\(assetId)", Report(reason: reason, detail: String(detail.prefix(500))))
            await model.refresh()
            if let job = result.jobId { model.openJob(job); dismiss() }
            else { eligibility = result; error = result.message ?? "Your report is saved for review." }
        } catch { self.error = error.localizedDescription }
    }
}

struct FullScreenPhotoView: View {
    @Environment(\.dismiss) private var dismiss
    let image: UIImage
    var body: some View {
        NavigationStack {
            ZoomPhoto(image: image).background(Color.black).ignoresSafeArea(edges: .bottom)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                .preferredColorScheme(.dark)
        }
    }
}
private struct ZoomPhoto: UIViewRepresentable {
    let image: UIImage
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> UIScrollView {
        let view = UIScrollView(); view.minimumZoomScale = 1; view.maximumZoomScale = 5; view.delegate = context.coordinator
        let photo = UIImageView(image: image); photo.contentMode = .scaleAspectFit; photo.isAccessibilityElement = true
        photo.accessibilityLabel = "Dish photo. Pinch to zoom."; photo.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(photo); context.coordinator.photo = photo
        return view
    }
    func updateUIView(_ view: UIScrollView, context: Context) {
        context.coordinator.photo?.image = image
        context.coordinator.photo?.frame = view.bounds
    }
    final class Coordinator: NSObject, UIScrollViewDelegate {
        var photo: UIImageView?
        func viewForZooming(in scrollView: UIScrollView) -> UIView? { photo }
    }
}
