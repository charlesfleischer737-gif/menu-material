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

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
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
                .padding(.bottom, 24)
                .animation(.smooth(duration: 0.4), value: studio.stage)
            }
            .scrollDismissesKeyboard(.interactively)
            .canvasBackground()
            .navigationTitle("Studio")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    BalanceBadge { showPlans = true }
                }
                if studio.stage != .empty {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("New photo", systemImage: "plus") { studio.startOver() }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if studio.stage == .composing || studio.stage == .submitting {
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
                }
            }
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
        VStack(spacing: 0) {
            ZStack {
                RoundedRectangle(cornerRadius: Metrics.cardRadius)
                    .fill(Palette.stage)
                RadialGradient(
                    colors: [Palette.glow.opacity(0.28), .clear],
                    center: .top,
                    startRadius: 10,
                    endRadius: 320
                )
                .clipShape(.rect(cornerRadius: Metrics.cardRadius))
                VStack(spacing: 14) {
                    if preparing {
                        ProgressView().tint(.white).controlSize(.large)
                        Text("Getting your photo ready…")
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.75))
                    } else {
                        Image(systemName: "camera.aperture")
                            .font(.system(size: 48, weight: .light))
                            .foregroundStyle(Palette.glow)
                        Text("Photograph a dish")
                            .font(.display(28))
                            .foregroundStyle(.white)
                        Text("Any phone photo works. Choose a look and Menu Material restyles it for your menu, delivery apps and posts.")
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.72))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                    }
                }
            }
            .aspectRatio(4 / 5, contentMode: .fit)
            .padding(.top, 8)

            VStack(spacing: 12) {
                if CameraPicker.isAvailable {
                    Button {
                        showCamera = true
                    } label: {
                        Label("Take a photo", systemImage: "camera.fill")
                    }
                    .buttonStyle(.primary)
                }
                Button {
                    showLibrary = true
                } label: {
                    Label("Choose from your library", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(
                    CameraPicker.isAvailable
                        ? AnyButtonStyle(SecondaryButtonStyle())
                        : AnyButtonStyle(PrimaryButtonStyle())
                )
            }
            .disabled(preparing)
            .padding(.top, 18)
        }
    }
}

/// Lets one button switch between the two pill styles.
struct AnyButtonStyle: ButtonStyle {
    private let make: (Configuration) -> AnyView

    init<S: ButtonStyle>(_ style: S) {
        make = { AnyView(style.makeBody(configuration: $0)) }
    }

    func makeBody(configuration: Configuration) -> some View {
        make(configuration)
    }
}

/// Recent photos made in the Studio, to pick up again.
private struct RecentPhotos: View {
    @Environment(AppModel.self) private var model
    let open: (String) -> Void

    private var recent: [(job: Job, asset: String)] {
        guard let workspace = model.workspace else { return [] }
        return workspace.jobs.prefix(30).compactMap { job in
            guard let output = workspace.outputs(for: job.id).first(where: { $0.status == "completed" }),
                  let asset = output.assetId else { return nil }
            return (job, asset)
        }
        .prefix(12)
        .map { $0 }
    }

    var body: some View {
        if !recent.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Recent photos").eyebrowStyle()
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(recent, id: \.job.id) { item in
                            Button { open(item.job.id) } label: {
                                AssetImage(id: item.asset)
                                    .frame(width: 112, height: 112)
                                    .clipShape(.rect(cornerRadius: 16))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Open this photo")
                        }
                    }
                }
                .scrollClipDisabled()
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
        VStack(alignment: .leading, spacing: 26) {
            PhotoStage(ratio: 4 / 5) {
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
                        Button("Take a new photo", systemImage: "camera") { showCamera = true }
                    }
                    Button("Choose another photo", systemImage: "photo.on.rectangle") { showLibrary = true }
                } label: {
                    Image(systemName: "arrow.triangle.2.circlepath.camera")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .glassEffect(.regular.interactive(), in: .circle)
                .padding(12)
                .accessibilityLabel("Replace photo")
            }

            if let catalog = studio.catalog {
                LookPicker(catalog: catalog, studio: studio)
            } else {
                HStack { ProgressView(); Text("Loading looks…").foregroundStyle(Palette.muted) }
            }

            FormatPicker(selection: $studio.format)

            VStack(alignment: .leading, spacing: 10) {
                Text("Details").eyebrowStyle()
                TextField("What’s the dish? (optional)", text: $studio.dishName)
                    .textInputAutocapitalization(.words)
                    .padding(14)
                    .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                    .disabled(studio.sourceId != nil && studio.photo == nil)
                TextField("Anything to adjust? For example, more room above the dish", text: $studio.note, axis: .vertical)
                    .lineLimit(2...4)
                    .padding(14)
                    .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
            }

            if let error = studio.error {
                ErrorNote(message: error)
            }
        }
    }
}

/// Where a photo sits: the dark artwork stage, so light and dark photos
/// both stand out.
struct PhotoStage<Content: View>: View {
    var ratio: CGFloat
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            Palette.stage
            content
        }
        .aspectRatio(ratio, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(.rect(cornerRadius: Metrics.cardRadius))
        .shadow(color: .black.opacity(0.12), radius: 20, y: 10)
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
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Look").eyebrowStyle()
                Spacer()
                if let look = studio.look {
                    Text(look.name)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Palette.muted)
                        .contentTransition(.opacity)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("suggested", "Suggested")
                    ForEach(catalog.categories) { chip($0.id, $0.name) }
                }
            }
            .scrollClipDisabled()
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
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
                .padding(.vertical, 4)
            }
            .scrollClipDisabled()
            .sensoryFeedback(.selection, trigger: studio.lookId)
        }
    }

    private func chip(_ id: String, _ title: String) -> some View {
        Button {
            withAnimation(.snappy) { category = id }
        } label: {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .foregroundStyle(category == id ? Palette.onAction : Palette.ink)
                .background(category == id ? Palette.action : Palette.surface, in: .capsule)
        }
        .buttonStyle(.plain)
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
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .topTrailing) {
                    preview
                        .frame(width: 124, height: 124)
                        .clipShape(.rect(cornerRadius: 18))
                        .overlay {
                            RoundedRectangle(cornerRadius: 18)
                                .strokeBorder(selected ? Palette.accent : .clear, lineWidth: 3)
                        }
                    if selected {
                        Image(systemName: "checkmark.circle.fill")
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(.white, Palette.accent)
                            .font(.title3)
                            .padding(8)
                            .transition(.scale.combined(with: .opacity))
                    } else if look.pro {
                        ProBadge().padding(8)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(look.name)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                    Text(look.cue)
                        .font(.caption2)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(1)
                }
                .frame(width: 124, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            if let best = look.bestFor { Text("Best for \(best.lowercased())") }
        } preview: {
            VStack(alignment: .leading, spacing: 10) {
                AsyncImage(url: model.client.publicURL(look.image)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Palette.stage
                }
                .frame(width: 320, height: 320)
                .clipped()
                VStack(alignment: .leading, spacing: 4) {
                    Text(look.name).font(.headline)
                    if let description = look.description {
                        Text(description).font(.callout).foregroundStyle(.secondary)
                    }
                }
                .padding([.horizontal, .bottom], 14)
            }
            .frame(width: 320)
        }
        .accessibilityLabel("\(look.name). \(look.cue)")
        .accessibilityAddTraits(selected ? .isSelected : [])
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

struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.caption2.weight(.heavy))
            .tracking(0.6)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(Palette.onAction)
            .background(Palette.action, in: .capsule)
    }
}

private struct FormatPicker: View {
    @Binding var selection: PhotoFormat

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Format").eyebrowStyle()
            HStack(spacing: 10) {
                ForEach(PhotoFormat.allCases) { format in
                    Button {
                        withAnimation(.snappy) { selection = format }
                    } label: {
                        VStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 3)
                                .strokeBorder(lineWidth: 1.5)
                                .aspectRatio(format.ratio, contentMode: .fit)
                                .frame(height: 30)
                                .frame(height: 34)
                            Text(format.name)
                                .font(.caption.weight(.semibold))
                            Text(format.use)
                                .font(.caption2)
                                .foregroundStyle(Palette.muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(selection == format ? Palette.accent : Palette.ink)
                        .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                        .overlay {
                            RoundedRectangle(cornerRadius: Metrics.controlRadius)
                                .strokeBorder(selection == format ? Palette.accent : Palette.hairline, lineWidth: selection == format ? 2 : 1)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(format.name), \(format.use)")
                    .accessibilityAddTraits(selection == format ? .isSelected : [])
                }
            }
        }
    }
}

/// The Create action, kept in reach, with what it costs.
private struct CreateBar: View {
    @Environment(AppModel.self) private var model
    let studio: StudioModel
    let create: () -> Void
    let showPlans: () -> Void
    let showVerify: () -> Void

    private var remaining: Int { model.workspace?.remaining ?? 0 }
    private var needsVerification: Bool { model.workspace?.emailVerification?.required ?? false }
    private var proLocked: Bool {
        (studio.look?.pro ?? false) && !(model.billing?.features?.unlocked ?? false)
    }

    var body: some View {
        VStack(spacing: 8) {
            if needsVerification {
                Button("Confirm your email to unlock your free images", action: showVerify)
                    .buttonStyle(.primary)
            } else if proLocked {
                Button("Food Fantasy looks are part of Pro", action: showPlans)
                    .buttonStyle(.primary)
            } else if remaining <= 0 {
                Button("See Plans for more images", action: showPlans)
                    .buttonStyle(.primary)
                Text(freeImagesNote ?? "You’ve used your available images.")
                    .font(.caption)
                    .foregroundStyle(Palette.muted)
            } else {
                Button(action: create) {
                    if studio.stage == .submitting {
                        HStack(spacing: 10) {
                            ProgressView().tint(Palette.onAction)
                            Text("Sending your photo…")
                        }
                    } else {
                        Label("Create photo", systemImage: "sparkles")
                    }
                }
                .buttonStyle(.primary)
                .disabled(studio.stage == .submitting || studio.look == nil || !(model.workspace?.canCreateImages ?? true))
                Text(caption)
                    .font(.caption)
                    .foregroundStyle(Palette.muted)
            }
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
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

    var body: some View {
        Button(action: showPlans) {
            Label("\(model.workspace?.remaining ?? 0)", systemImage: "sparkles")
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .accessibilityLabel("\(model.workspace?.remaining ?? 0) images left. Plans")
    }
}

// MARK: - Creating

private struct CreatingView: View {
    @Environment(AppModel.self) private var model
    let jobId: String
    let studio: StudioModel

    private var job: Job? { model.workspace?.jobs.first { $0.id == jobId } }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            PhotoStage(ratio: 4 / 5) {
                if let photo = studio.photo {
                    Image(uiImage: photo.preview).resizable().scaledToFit()
                } else if let source = job?.sourceId ?? studio.sourceId {
                    AssetImage(id: source, contentMode: .fit)
                }
            }
            .shimmer()
            .overlay(alignment: .bottom) {
                TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                    ProgressCard(outcome: model.workspace?.outcome(of: jobId, now: model.serverNow), lookName: studio.look?.name)
                }
                .padding(14)
            }
            Text(model.workspace?.workerHealthy == false
                 ? "Keep Menu Material open while your photo is made."
                 : "You can leave the app. We’ll let you know when your photo is ready.")
                .font(.footnote)
                .foregroundStyle(Palette.muted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
            if job?.status == "queued" {
                Button("Cancel this photo", role: .destructive) {
                    Task {
                        let _: OK? = try? await model.client.post("jobs/\(jobId)/cancel")
                        await model.refresh()
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

private struct ProgressCard: View {
    let outcome: PhotoOutcome?
    let lookName: String?
    @State private var shown: Double = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(stage).font(.subheadline.weight(.semibold))
                Spacer()
                Text(time).font(.footnote).foregroundStyle(.secondary).monospacedDigit()
            }
            ProgressView(value: shown)
                .tint(Palette.glow)
            if let hold {
                Text(hold).font(.caption).foregroundStyle(.secondary)
            } else if let lookName {
                Text("In \(lookName)").font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
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
    private var hold: String? {
        if case .waiting(_, let hold) = outcome { return hold }
        return nil
    }
}

// MARK: - Failed

private struct FailedView: View {
    @Environment(AppModel.self) private var model
    let message: String
    let studio: StudioModel

    var body: some View {
        EmptyState(
            symbol: "exclamationmark.triangle",
            title: "This photo couldn’t be made",
            message: message
        ) {
            VStack(spacing: 12) {
                Button("Try again") {
                    studio.tryAnotherLook()
                    Task { await studio.create(model: model) }
                }
                .buttonStyle(.primary)
                Button("Choose another look") { studio.tryAnotherLook() }
                    .buttonStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
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
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "sparkles")
                    .font(.system(size: 36))
                    .foregroundStyle(Palette.accent)
                Text("How your photos are styled")
                    .font(.display(28))
                    .foregroundStyle(Palette.ink)
                VStack(alignment: .leading, spacing: 12) {
                    point("photo", "To restyle a dish photo, Menu Material sends it, with the look and details you choose, to OpenAI, whose image model makes the new photo.")
                    point("lock", "Your photos stay private to your restaurant unless you put them on a published menu or share them.")
                    point("checkmark.seal", "Check every photo before you use it: food can change in small ways.")
                }
                if let privacy = model.config?.links.privacy, let url = URL(string: privacy) {
                    Link("Read the Privacy Policy", destination: url)
                        .font(.callout.weight(.medium))
                }
                Spacer()
                Button("Allow and create photo", action: allow)
                    .buttonStyle(.primary)
                Button("Not now") { dismiss() }
                    .frame(maxWidth: .infinity)
            }
            .padding(Metrics.gutter)
            .canvasBackground()
        }
        .presentationDetents([.large])
    }

    private func point(_ symbol: String, _ text: String) -> some View {
        Label {
            Text(text).foregroundStyle(Palette.ink)
        } icon: {
            Image(systemName: symbol).foregroundStyle(Palette.accent)
        }
        .font(.callout)
    }
}
