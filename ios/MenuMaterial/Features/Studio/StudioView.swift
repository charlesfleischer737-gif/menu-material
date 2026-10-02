import MenuMaterialKit
import PhotosUI
import SwiftUI

/// Photo Studio: a dish photo in, a styled photo out.
struct StudioView: View {
    @Environment(AppModel.self) private var model
    @State private var studio = StudioModel()
    @State private var pickerItem: PhotosPickerItem?
    @State private var showLibrary = false
    @State private var showCamera = false
    @State private var showConsent = false
    @State private var showPlans = false
    @State private var showVerify = false
    @AppStorage("ai-consent") private var consentedUser = ""

    private var composing: Bool { studio.stage == .composing || studio.stage == .submitting }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    switch studio.stage {
                    case .empty:
                        StudioStart(
                            showCamera: $showCamera,
                            showLibrary: $showLibrary,
                            preparing: studio.preparing
                        )
                        RecentPhotos { jobId in studio.open(jobId: jobId, model: model) }
                    case .composing, .submitting:
                        ComposeView(studio: studio, showCamera: $showCamera, showLibrary: $showLibrary)
                    case .creating(let jobId):
                        CreatingView(jobId: jobId, studio: studio)
                    case .result(let jobId, let assetId):
                        ResultView(jobId: jobId, assetId: assetId, studio: studio)
                    case .failed(_, let message):
                        FailedView(message: message, studio: studio)
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 4)
                .padding(.bottom, 32)
                .animation(.smooth(duration: 0.45), value: studio.stage)
            }
            .scrollDismissesKeyboard(.interactively)
            .canvasBackground()
            .navigationTitle("Studio")
            .toolbar {
                if studio.stage != .empty {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("New Photo", systemImage: "plus") { studio.startOver() }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    BalanceBadge { showPlans = true }
                }
            }
            .bottomBar {
                if composing {
                    CreateBar(studio: studio) {
                        if consentedUser == model.user?.id {
                            Task { await studio.create(model: model) }
                        } else {
                            showConsent = true
                        }
                    } showPlans: {
                        showPlans = true
                    } showVerify: {
                        showVerify = true
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.smooth(duration: 0.35), value: composing)
        }
        .photosPicker(isPresented: $showLibrary, selection: $pickerItem, matching: .images, preferredItemEncoding: .current)
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            pickerItem = nil
            Task { await load(item) }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in Task { await take(image) } }
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showConsent) {
            AIConsentView {
                consentedUser = model.user?.id ?? ""
                showConsent = false
                Task { await studio.create(model: model) }
            }
        }
        .sheet(isPresented: $showPlans) { PlansView() }
        .sheet(isPresented: $showVerify) { VerifyEmailView() }
        .onChange(of: studio.needsPlans) { _, needed in
            if needed { showPlans = true; studio.needsPlans = false }
        }
        .onChange(of: studio.needsVerification) { _, needed in
            if needed { showVerify = true; studio.needsVerification = false }
        }
        .onChange(of: model.focusedJob) { _, jobId in
            guard let jobId else { return }
            model.focusedJob = nil
            Task {
                await model.refresh()
                studio.open(jobId: jobId, model: model)
            }
        }
        .task {
            await studio.loadCatalog(model.client)
            studio.resume(model)
            #if DEBUG
            await studio.playDemoScene(model)
            #endif
        }
    }

    private func load(_ item: PhotosPickerItem) async {
        studio.preparing = true
        defer { studio.preparing = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else { return }
            studio.choose(try await PreparedPhoto.fromLibrary(data))
        } catch {
            studio.error = error.localizedDescription
        }
    }

    private func take(_ image: UIImage) async {
        studio.preparing = true
        defer { studio.preparing = false }
        do {
            studio.choose(try await PreparedPhoto.fromCamera(image))
        } catch {
            studio.error = error.localizedDescription
        }
    }
}

// MARK: - Start

private struct StudioStart: View {
    @Binding var showCamera: Bool
    @Binding var showLibrary: Bool
    let preparing: Bool

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                MeshBackdrop(colors: Palette.studioMesh)
                VStack(spacing: 18) {
                    if preparing {
                        ProgressView()
                            .controlSize(.large)
                            .tint(.white)
                        Text("Getting your photo ready…")
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.8))
                    } else {
                        Image(systemName: "camera.aperture")
                            .font(.system(size: 54, weight: .thin))
                            .foregroundStyle(.white.opacity(0.9))
                            .symbolEffect(.breathe)
                        VStack(spacing: 10) {
                            Text("Photograph a dish")
                                .font(.display(.title))
                                .foregroundStyle(.white)
                            Text("Any phone photo works. Pick a look, and get menu-ready food photography in about a minute.")
                                .font(.callout)
                                .foregroundStyle(.white.opacity(0.72))
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(32)
            }
            .aspectRatio(4 / 5, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 32))

            HStack(spacing: 12) {
                if CameraPicker.isAvailable {
                    Button {
                        showCamera = true
                    } label: {
                        Label("Camera", systemImage: "camera.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .primaryAction()
                    Button {
                        showLibrary = true
                    } label: {
                        Label("Library", systemImage: "photo.on.rectangle.angled")
                            .frame(maxWidth: .infinity)
                    }
                    .secondaryAction()
                } else {
                    Button {
                        showLibrary = true
                    } label: {
                        Label("Choose a Photo", systemImage: "photo.on.rectangle.angled")
                            .frame(maxWidth: .infinity)
                    }
                    .primaryAction()
                }
            }
            .disabled(preparing)
        }
    }
}

/// Recent photos made in the Studio, to pick up again, in a Photos grid.
private struct RecentPhotos: View {
    @Environment(AppModel.self) private var model
    let open: (String) -> Void

    private struct Item: Identifiable {
        let job: Job
        let asset: String
        var id: String { job.id }
    }

    private var recent: [Item] {
        guard let workspace = model.workspace else { return [] }
        let items = workspace.jobs.prefix(30).compactMap { job -> Item? in
            guard let output = workspace.outputs(for: job.id).first(where: { $0.status == "completed" }),
                  let asset = output.assetId else { return nil }
            return Item(job: job, asset: asset)
        }
        return Array(items.prefix(9))
    }

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 3)

    var body: some View {
        if !recent.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Text("Recent")
                    .font(.title2.bold())
                    .foregroundStyle(Palette.ink)
                LazyVGrid(columns: columns, spacing: 3) {
                    ForEach(recent) { item in
                        Button { open(item.job.id) } label: {
                            SquarePhoto(id: item.asset)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open this photo")
                    }
                }
                .clipShape(.rect(cornerRadius: 22))
            }
        }
    }
}

// MARK: - Compose

private struct ComposeView: View {
    @Environment(AppModel.self) private var model
    @Bindable var studio: StudioModel
    @Binding var showCamera: Bool
    @Binding var showLibrary: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            PhotoStage(ratio: ratio) {
                if let photo = studio.photo {
                    Image(uiImage: photo.preview)
                        .resizable()
                        .scaledToFit()
                } else if let source = studio.sourceId {
                    AssetImage(id: source, contentMode: .fit)
                }
            }
            .overlay(alignment: .topTrailing) {
                Menu {
                    if CameraPicker.isAvailable {
                        Button("Take a New Photo", systemImage: "camera") { showCamera = true }
                    }
                    Button("Choose Another Photo", systemImage: "photo.on.rectangle") { showLibrary = true }
                } label: {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .glassEffect(.regular.interactive(), in: .circle)
                .padding(14)
                .accessibilityLabel("Replace photo")
            }

            if let catalog = studio.catalog {
                LookPicker(catalog: catalog, studio: studio)
            } else {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Loading looks…").foregroundStyle(Palette.muted)
                }
            }

            FormatPicker(selection: $studio.format)

            DetailsCard(studio: studio)

            if let error = studio.error {
                ErrorNote(message: error)
            }
        }
    }

    /// The photo's own shape, within reason.
    private var ratio: CGFloat {
        guard let size = studio.photo?.preview.size, size.height > 0 else { return 4 / 5 }
        return min(max(size.width / size.height, 0.75), 1.6)
    }
}

/// A section title, with room for a detail on the right.
private struct SectionTitle<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.bold())
                .foregroundStyle(Palette.ink)
            Spacer()
            trailing
        }
    }
}

private struct LookPicker: View {
    @Environment(AppModel.self) private var model
    let catalog: StyleCatalog
    @Bindable var studio: StudioModel
    @State private var category: String = "suggested"

    private var disabled: Set<String> {
        Set(model.workspace?.studioAvailability?.disabledStyleIds ?? [])
    }

    private var looks: [StyleCatalog.Look] {
        let shown: [StyleCatalog.Look]
        if category == "suggested" {
            shown = [catalog.polish] + catalog.categories.compactMap { catalog.looks(in: $0).first }
        } else if let chosen = catalog.categories.first(where: { $0.id == category }) {
            shown = catalog.looks(in: chosen)
        } else {
            shown = [catalog.polish]
        }
        return shown.filter { !disabled.contains($0.id) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "Look") {
                if let look = studio.look {
                    Text(look.name)
                        .font(.subheadline)
                        .foregroundStyle(Palette.muted)
                        .contentTransition(.opacity)
                        .lineLimit(1)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("suggested", "Suggested")
                    ForEach(catalog.categories) { chip($0.id, $0.name) }
                }
            }
            .scrollClipDisabled()
            .sensoryFeedback(.selection, trigger: category)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 14) {
                    ForEach(looks) { look in
                        LookTile(
                            look: look,
                            selected: look.id == studio.lookId,
                            ownPhoto: look.id == catalog.polish.id ? studio.photo?.preview : nil,
                            ownSource: look.id == catalog.polish.id ? studio.sourceId : nil
                        ) {
                            withAnimation(.snappy) { studio.lookId = look.id }
                        }
                    }
                }
                .scrollTargetLayout()
                .padding(.vertical, 4)
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollClipDisabled()
            .sensoryFeedback(.selection, trigger: studio.lookId)
        }
    }

    private func chip(_ id: String, _ title: String) -> some View {
        let selected = category == id
        return Button {
            withAnimation(.snappy) { category = id }
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 15)
                .padding(.vertical, 9)
                .foregroundStyle(selected ? Color.white : Palette.ink)
                .background(selected ? Palette.accent : Palette.surface, in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct LookTile: View {
    @Environment(AppModel.self) private var model
    let look: StyleCatalog.Look
    let selected: Bool
    let ownPhoto: UIImage?
    let ownSource: String?
    let choose: () -> Void

    var body: some View {
        Button(action: choose) {
            VStack(alignment: .leading, spacing: 10) {
                preview
                    .frame(width: 136, height: 170)
                    .clipShape(.rect(cornerRadius: 20))
                    .overlay(alignment: .topTrailing) { badge }
                    .padding(3)
                    .overlay {
                        RoundedRectangle(cornerRadius: 23)
                            .strokeBorder(selected ? Palette.accent : .clear, lineWidth: 2.5)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(look.name)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                    Text(look.cue)
                        .font(.caption)
                        .foregroundStyle(Palette.muted)
                }
                .lineLimit(1)
                .frame(width: 136, alignment: .leading)
                .padding(.leading, 3)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Choose This Look", systemImage: "checkmark", action: choose)
            if let best = look.bestFor { Text("Best for \(best.lowercased())") }
        } preview: {
            LookPreview(look: look)
        }
        .accessibilityLabel("\(look.name). \(look.cue)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @ViewBuilder
    private var badge: some View {
        if selected {
            Image(systemName: "checkmark.circle.fill")
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, Palette.accent)
                .font(.title2)
                .padding(8)
                .transition(.scale.combined(with: .opacity))
        } else if look.pro {
            ProBadge().padding(10)
        }
    }

    @ViewBuilder
    private var preview: some View {
        if let ownPhoto {
            Image(uiImage: ownPhoto).resizable().scaledToFill()
        } else if let ownSource {
            AssetImage(id: ownSource)
        } else {
            AsyncImage(url: model.client.publicURL(look.thumbnail)) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Palette.raised
            }
        }
    }
}

/// A look, large, with what it's for: the preview of a long press.
private struct LookPreview: View {
    @Environment(AppModel.self) private var model
    let look: StyleCatalog.Look

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            AsyncImage(url: model.client.publicURL(look.image)) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                AsyncImage(url: model.client.publicURL(look.thumbnail)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Palette.stage
                }
            }
            .frame(width: 320, height: 320)
            .clipped()
            VStack(alignment: .leading, spacing: 4) {
                Text(look.name).font(.headline)
                if let description = look.description {
                    Text(description).font(.callout).foregroundStyle(.secondary)
                }
            }
            .padding([.horizontal, .bottom], 16)
        }
        .frame(width: 320)
    }
}

private struct FormatPicker: View {
    @Binding var selection: PhotoFormat

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "Format") {
                Text(selection.use)
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
                    .contentTransition(.opacity)
            }
            Picker("Format", selection: $selection.animation(.snappy)) {
                ForEach(PhotoFormat.allCases) { format in
                    Text(format.name).tag(format)
                }
            }
            .pickerStyle(.segmented)
            .sensoryFeedback(.selection, trigger: selection)
        }
    }
}

/// The dish's name and a note for the photo, as rows in a grouped card.
private struct DetailsCard: View {
    @Bindable var studio: StudioModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionTitle(title: "Details") {
                Text("Optional")
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
            }
            VStack(spacing: 0) {
                TextField("Dish name", text: $studio.dishName)
                    .textInputAutocapitalization(.words)
                    .disabled(studio.sourceId != nil && studio.photo == nil)
                    .padding(.horizontal, 16)
                    .frame(minHeight: Metrics.rowHeight)
                Divider().padding(.leading, 16)
                TextField("Notes, like “more room above the dish”", text: $studio.note, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 15)
            }
            .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
        }
    }
}

/// The Create action, floating in reach, with what it costs.
private struct CreateBar: View {
    @Environment(AppModel.self) private var model
    let studio: StudioModel
    let create: () -> Void
    let showPlans: () -> Void
    let showVerify: () -> Void

    private var remaining: Int { model.workspace?.remaining ?? 0 }
    private var needsVerification: Bool { model.workspace?.emailVerification?.required ?? false }
    private var submitting: Bool { studio.stage == .submitting }
    private var proLocked: Bool {
        (studio.look?.pro ?? false) && !(model.billing?.features?.unlocked ?? false)
    }

    var body: some View {
        VStack(spacing: 10) {
            if needsVerification {
                wide("Confirm Your Email for Free Images", "envelope.badge", action: showVerify)
            } else if proLocked {
                wide("Unlock Food Fantasy with Pro", "sparkles", action: showPlans)
            } else if remaining <= 0 {
                wide("See Plans for More Images", "sparkles", action: showPlans)
                Text(freeImagesNote ?? "You’ve used your available images.")
                    .font(.footnote)
                    .foregroundStyle(Palette.muted)
            } else {
                Button(action: create) {
                    createLabel.frame(maxWidth: .infinity)
                }
                .primaryAction()
                .disabled(submitting || studio.look == nil || !(model.workspace?.canCreateImages ?? true))
                .sensoryFeedback(.impact(weight: .medium), trigger: submitting)
                Text(caption)
                    .font(.footnote)
                    .foregroundStyle(Palette.muted)
            }
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var createLabel: some View {
        if submitting {
            HStack(spacing: 10) {
                ProgressView().tint(.white)
                Text("Sending Your Photo…")
            }
        } else {
            Label("Create Photo", systemImage: "sparkles")
        }
    }

    private func wide(_ title: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .frame(maxWidth: .infinity)
        }
        .primaryAction()
    }

    private var caption: String {
        if !(model.workspace?.canCreateImages ?? true) {
            return model.workspace?.studioAvailability?.message.flatMap { $0.isEmpty ? nil : $0 }
                ?? "Photo creation is paused for now. Your photo is saved."
        }
        return "Uses 1 image · \(remaining) left"
    }

    private var freeImagesNote: String? {
        guard let free = model.workspace?.freeImages else { return nil }
        switch free.status {
        case "held":
            if let days = free.days, days > 1 { return "Your \(free.images ?? 5) free images arrive within \(days) days." }
            return "Your \(free.images ?? 5) free images arrive within a day."
        case "used": return "This email already had its free images."
        default: return nil
        }
    }
}

/// Images left, in the toolbar.
struct BalanceBadge: View {
    @Environment(AppModel.self) private var model
    let showPlans: () -> Void

    private var remaining: Int { model.workspace?.remaining ?? 0 }

    var body: some View {
        Button(action: showPlans) {
            HStack(spacing: 5) {
                Image(systemName: "sparkles")
                Text("\(remaining)")
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(remaining)))
            }
            .font(.subheadline.weight(.semibold))
        }
        .animation(.snappy, value: remaining)
        .accessibilityLabel("\(remaining) images left. Plans")
    }
}

// MARK: - Creating

private struct CreatingView: View {
    @Environment(AppModel.self) private var model
    let jobId: String
    let studio: StudioModel

    private var job: Job? { model.workspace?.jobs.first { $0.id == jobId } }

    var body: some View {
        VStack(spacing: 28) {
            PhotoStage(ratio: 4 / 5) {
                if let photo = studio.photo {
                    Image(uiImage: photo.preview).resizable().scaledToFill()
                } else if let source = job?.sourceId ?? studio.sourceId {
                    AssetImage(id: source)
                }
            }
            .shimmer()
            .clipShape(.rect(cornerRadius: Metrics.cardRadius))
            .makingGlow()
            .padding(.horizontal, 8)
            .padding(.top, 12)

            TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                ProgressPanel(
                    outcome: model.workspace?.outcome(of: jobId, now: model.serverNow),
                    lookName: studio.makingLook
                )
            }

            VStack(spacing: 14) {
                Text(model.workspace?.workerHealthy == false
                     ? "Keep Menu Material open while your photo is made."
                     : "You can leave the app. We’ll let you know when it’s ready.")
                    .font(.footnote)
                    .foregroundStyle(Palette.muted)
                    .multilineTextAlignment(.center)
                if job?.status == "queued" {
                    Button("Cancel Photo", role: .destructive) {
                        Task {
                            let _: OK? = try? await model.client.post("jobs/\(jobId)/cancel")
                            await model.refresh()
                        }
                    }
                    .buttonStyle(.glass)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

private struct ProgressPanel: View {
    let outcome: PhotoOutcome?
    let lookName: String?
    @State private var shown: Double = 0

    var body: some View {
        VStack(spacing: 14) {
            VStack(spacing: 6) {
                Text(stage)
                    .font(.title2.bold())
                    .foregroundStyle(Palette.ink)
                    .contentTransition(.opacity)
                    .animation(.smooth, value: stage)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
                    .multilineTextAlignment(.center)
            }
            VStack(spacing: 8) {
                ProgressView(value: shown)
                    .tint(Palette.accent)
                Text(time.isEmpty ? " " : time)
                    .font(.footnote)
                    .foregroundStyle(Palette.muted)
                    .monospacedDigit()
            }
            .padding(.horizontal, 24)
        }
        .onChange(of: value, initial: true) { _, next in
            // Never backwards.
            withAnimation(.linear(duration: 0.5)) { shown = max(shown, next) }
        }
        .accessibilityElement(children: .combine)
    }

    private var progress: RenderProgress? {
        if case .waiting(let progress, _) = outcome { return progress }
        return nil
    }

    private var value: Double { progress?.value ?? 0.02 }
    private var stage: String { progress?.stage ?? "Getting started" }
    private var time: String { progress?.time ?? "" }
    private var detail: String {
        if case .waiting(_, let hold) = outcome, let hold { return hold }
        if let lookName { return "\(lookName) look" }
        return "Usually ready in about a minute"
    }
}

// MARK: - Failed

private struct FailedView: View {
    @Environment(AppModel.self) private var model
    let message: String
    let studio: StudioModel

    var body: some View {
        ContentUnavailableView {
            Label("This Photo Couldn’t Be Made", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            VStack(spacing: 12) {
                Button {
                    studio.tryAnotherLook()
                    Task { await studio.create(model: model) }
                } label: {
                    Text("Try Again").frame(maxWidth: .infinity)
                }
                .primaryAction()
                Button {
                    studio.tryAnotherLook()
                } label: {
                    Text("Choose Another Look").frame(maxWidth: .infinity)
                }
                .secondaryAction()
            }
            .padding(.horizontal, 24)
        }
        .padding(.top, 40)
    }
}

// MARK: - Consent

/// Before the first photo is sent: where it goes. App Review asks apps to
/// say so and ask first when personal data goes to another company's AI.
struct AIConsentView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let allow: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 16) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 44, weight: .medium))
                        .foregroundStyle(Palette.accent)
                    Text("How Your Photos Are Styled")
                        .font(.title.bold())
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 40)
                VStack(alignment: .leading, spacing: 22) {
                    point("photo.on.rectangle.angled", "Sent to OpenAI to style", "Menu Material sends your photo, with the look and details you choose, to OpenAI, whose image model makes the new photo.")
                    point("lock.fill", "Private to your restaurant", "Your photos stay private unless you put them on a published menu or share them.")
                    point("eye.fill", "Check before you use it", "Food can change in small ways. Look over every photo before it goes on a menu.")
                }
                if let privacy = model.config?.links.privacy, let url = URL(string: privacy) {
                    Link("Privacy Policy", destination: url)
                        .font(.callout.weight(.semibold))
                }
            }
            .padding(.horizontal, 32)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 6) {
                Button(action: allow) {
                    Text("Continue").frame(maxWidth: .infinity)
                }
                .primaryAction()
                Button("Not Now") { dismiss() }
                    .font(.body.weight(.semibold))
                    .padding(.vertical, 10)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .background(Color(uiColor: .systemBackground))
        }
        .background(Color(uiColor: .systemBackground))
        .presentationDetents([.large])
    }

    private func point(_ symbol: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(Palette.accent)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(text).font(.subheadline).foregroundStyle(Palette.muted)
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }
}
