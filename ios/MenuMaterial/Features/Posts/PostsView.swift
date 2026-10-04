import MenuMaterialKit
import SwiftUI

struct PostDraft: Codable, Identifiable, Equatable {
    var id = UUID().uuidString.lowercased()
    var dishId = ""
    var assetId = ""
    var template = "Spotlight"
    var format = "Feed"
    var headline = ""
    var detail = ""
    var price = ""
    var caption = ""
    var updatedAt = Date()
}

struct PostsView: View {
    @Environment(AppModel.self) private var model
    @State private var drafts: [PostDraft] = []
    @State private var editing: PostDraft?
    @State private var pickDish = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Good food. Worth sharing.").font(.display(.largeTitle))
                        Text("Turn a dish into a polished post or Story. Choose a layout, add your words, and share.").foregroundStyle(Palette.muted)
                        Button { pickDish = true } label: { Label("Create a Post", systemImage: "plus").frame(maxWidth: .infinity) }.primaryAction()
                    }.card()
                    if let error { ErrorNote(message: error) }
                    if !drafts.isEmpty { Text("Your drafts").font(.title2.bold()) }
                    ForEach(drafts.sorted { $0.updatedAt > $1.updatedAt }) { draft in
                        Button { editing = draft } label: {
                            HStack(spacing: 16) {
                                SquarePhoto(id: draft.assetId.isEmpty ? nil : draft.assetId, radius: 16).frame(width: 84, height: 100)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(draft.headline.isEmpty ? "Untitled post" : draft.headline).font(.headline).foregroundStyle(Palette.ink).lineLimit(2)
                                    Text("\(draft.template) · \(draft.format)").font(.subheadline).foregroundStyle(Palette.muted)
                                }
                                Spacer(); Image(systemName: "chevron.right").foregroundStyle(Palette.muted).font(.caption)
                            }.card()
                        }.buttonStyle(.plain).contextMenu {
                            Button("Delete Draft", systemImage: "trash", role: .destructive) { drafts.removeAll { $0.id == draft.id }; persist() }
                        }
                    }
                    Text("Drafts are saved on this device. Exports are ready to share wherever you post.").font(.footnote).foregroundStyle(Palette.muted)
                }.padding(Metrics.gutter)
            }.canvasBackground().navigationTitle("Posts")
                .sheet(isPresented: $pickDish) {
                    PostDishPicker { dish in pickDish = false; begin(dish) }
                }
                .sheet(item: $editing) { draft in
                    PostEditorView(initial: draft) { updated in
                        if let index = drafts.firstIndex(where: { $0.id == updated.id }) { drafts[index] = updated }
                        else { drafts.insert(updated, at: 0) }
                        persist()
                    }
                }
                .task { drafts = model.local.read("posts.json") ?? [] }
                .onChange(of: model.postDishId, initial: true) { _, id in
                    guard let id, let dish = model.workspace?.dishes.first(where: { $0.id == id }) else { return }
                    model.postDishId = nil; begin(dish)
                }
        }
    }
    private func begin(_ dish: Dish) {
        var draft = PostDraft(); draft.dishId = dish.id
        draft.assetId = model.workspace?.preferredPhoto(for: dish)?.id ?? ""
        draft.headline = dish.name; draft.detail = dish.description
        draft.price = dish.price > 0 ? Money.format(hundredths: dish.price, currency: model.restaurant?.currency ?? "USD") : ""
        draft.caption = "\(dish.name)\(dish.description.isEmpty ? "" : " — \(dish.description)")\n\nAt \(model.restaurant?.name ?? "our restaurant")."
        editing = draft
    }
    private func persist() { if !model.local.save(drafts, "posts.json") { error = model.local.failure } }
}

private struct PostDishPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let choose: (Dish) -> Void
    @State private var search = ""
    var body: some View {
        NavigationStack {
            List {
                let dishes = (model.workspace?.activeDishes ?? []).filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) }
                if dishes.isEmpty { ContentUnavailableView("Add your first dish", systemImage: "fork.knife", description: Text("Add a dish and photo in Studio or Dishes, then create its first post.").foregroundColor(Palette.muted)) }
                ForEach(dishes) { dish in
                    Button { choose(dish) } label: {
                        HStack(spacing: 14) {
                            SquarePhoto(id: model.workspace?.preferredPhoto(for: dish)?.id, radius: 12).frame(width: 56, height: 56)
                            Text(dish.name).foregroundStyle(Palette.ink); Spacer(); Image(systemName: "chevron.right").font(.caption)
                        }
                    }
                }
            }.navigationTitle("Choose a Dish").searchField(text: $search)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Group { Button("Cancel") { dismiss() } }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden) }
        }
    }
}

private struct PostEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let initial: PostDraft
    let saveDraft: (PostDraft) -> Void
    @State private var draft = PostDraft()
    @State private var image: UIImage?
    @State private var busy = false
    @State private var error: String?
    @State private var note: String?
    @State private var share: SharedFile?
    @State private var loaded = false
    private var restaurant: String { model.restaurant?.name ?? "Your restaurant" }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    PostArtwork(draft: draft, image: image, restaurant: restaurant)
                        .aspectRatio(draft.format == "Story" ? 9 / 16 : 4 / 5, contentMode: .fit)
                        .clipShape(.rect(cornerRadius: Metrics.cardRadius))
                        .accessibilityElement(children: .ignore).accessibilityLabel("Post preview. \(restaurant). \(draft.headline). \(draft.detail). \(draft.price)")
                    if image == nil {
                        Button("Load Photo", systemImage: "arrow.clockwise") { Task { await loadPhoto() } }.secondaryAction()
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Layout").font(.title3.bold())
                        Picker("Layout", selection: $draft.template) { ForEach(["Spotlight", "Special", "Offer"], id: \.self) { Text($0) } }.pickerStyle(.segmented)
                        Picker("Size", selection: $draft.format) { Text("Feed · 4:5").tag("Feed"); Text("Story · 9:16").tag("Story") }.pickerStyle(.segmented)
                    }
                    if let photos = model.workspace?.photos(for: draft.dishId), photos.count > 1 {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(photos.filter { $0.needsCorrection == 0 }) { photo in
                                    Button { draft.assetId = photo.id; Task { await loadPhoto() } } label: {
                                        SquarePhoto(id: photo.id, radius: 12).frame(width: 72, height: 72).padding(3)
                                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(photo.id == draft.assetId ? Palette.accent : .clear, lineWidth: 2))
                                    }.buttonStyle(.plain).accessibilityLabel("Choose dish photo")
                                }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 18) {
                        field("Headline", value: $draft.headline, limit: 70)
                        field(draft.template == "Offer" ? "Offer details and dates" : "Description", value: $draft.detail, limit: 180)
                        field("Price or offer · optional", value: $draft.price, limit: 30)
                    }.card()
                    VStack(alignment: .leading, spacing: 12) {
                        HStack { Text("Caption").font(.title3.bold()); Spacer(); Button("Copy") { UIPasteboard.general.string = draft.caption; note = "Caption copied" } }
                        TextField("Write your caption", text: $draft.caption, prompt: Text("Write your caption").foregroundStyle(Palette.muted), axis: .vertical).lineLimit(4...8).padding(16).background(Palette.surface, in: .rect(cornerRadius: 16))
                        Text("Review your food, prices and offer terms before sharing.").font(.footnote).foregroundStyle(Palette.muted)
                    }
                    if let error { ErrorNote(message: error) }
                    HStack {
                        Button { Task { await export(saveToPhotos: true) } } label: { Label("Save", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity) }.secondaryAction()
                        Button { Task { await export(saveToPhotos: false) } } label: { Label("Share", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }.primaryAction()
                    }.disabled(busy || image == nil || draft.headline.trimmingCharacters(in: .whitespaces).isEmpty)
                    if busy { ProgressView("Preparing your post…").frame(maxWidth: .infinity) }
                }.padding(Metrics.gutter)
            }.canvasBackground().navigationTitle("Create Post").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Group { Button("Done") { persist(); dismiss() }.disabled(busy) }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden) }
        }.interactiveDismissDisabled(busy)
            .onAppear { if !loaded { draft = initial; loaded = true; persist() } }
            .task { await loadPhoto() }
            .onChange(of: draft) { _, _ in persist() }
            .sheet(item: $share) { file in ShareSheet(items: [file.url, draft.caption]) }
            .toast($note)
    }
    private func field(_ label: String, value: Binding<String>, limit: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Palette.muted)
            TextField(label, text: Binding(get: { value.wrappedValue }, set: { value.wrappedValue = String($0.prefix(limit)) }), prompt: Text(label).foregroundStyle(Palette.muted), axis: .vertical).lineLimit(1...4)
        }
    }
    private func persist() { guard loaded else { return }; var saved = draft; saved.updatedAt = Date(); saveDraft(saved) }
    private func loadPhoto() async {
        let id = loaded ? draft.assetId : initial.assetId
        guard !id.isEmpty else { error = "Add a photo to this dish first."; return }
        image = await model.images.image(asset: id)
        error = image == nil ? "Your photo couldn’t be loaded. Check your connection and try again." : nil
    }
    private func export(saveToPhotos: Bool) async {
        busy = true; error = nil; defer { busy = false }
        let began = Date()
        do {
            let _: OK = try await model.client.post("assets/\(draft.assetId)/use", PhotoUse(action: "post"))
            let data = try await model.images.download(asset: draft.assetId)
            guard let full = UIImage(data: data) else { throw PreparedPhoto.PreparationError.unreadable }
            let renderer = ImageRenderer(content: PostArtwork(draft: draft, image: full, restaurant: restaurant)
                .frame(width: 1080, height: draft.format == "Story" ? 1920 : 1350).environment(\.colorScheme, .light))
            renderer.scale = 1
            guard let rendered = renderer.uiImage?.pngData() else { throw PreparedPhoto.PreparationError.unreadable }
            if saveToPhotos { try await PhotoLibrary.save(rendered); note = "Post saved to Photos" }
            else { share = SharedFile(url: try ShareFile.write(rendered, name: draft.headline + " – Menu Material", ext: "png")) }
            model.recordMetric("export", since: began)
            await model.refresh(); persist()
        } catch { self.error = error.localizedDescription }
    }
}

/// The same normalized canvas drives the screen preview and 1080px export.
/// Story content stays clear of the top and bottom interface overlays.
struct PostArtwork: View {
    let draft: PostDraft
    let image: UIImage?
    let restaurant: String
    private var story: Bool { draft.format == "Story" }
    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height
            let dark = draft.template == "Special"
            let ink: Color = dark ? .white : Palette.actionFill
            VStack(alignment: .leading, spacing: width * 0.025) {
                Text(restaurant.uppercased()).font(.system(size: width * 0.029, weight: .semibold)).tracking(width * 0.004).foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.6)
                ZStack {
                    Palette.raised
                    if let image { Image(uiImage: image).resizable().scaledToFill() }
                    else { Image(systemName: "photo").font(.largeTitle).foregroundStyle(Palette.muted) }
                }.frame(width: width * 0.86, height: height * (story ? 0.38 : 0.47)).clipped().clipShape(.rect(cornerRadius: width * 0.02))
                if draft.template != "Spotlight" {
                    Text(draft.template == "Special" ? "ON THE MENU" : "SOMETHING SPECIAL")
                        .font(.system(size: width * 0.027, weight: .semibold)).tracking(width * 0.005).foregroundStyle(ink)
                }
                Text(draft.headline).font(.system(size: width * 0.074, weight: .bold, design: .serif)).foregroundStyle(ink).lineLimit(3).minimumScaleFactor(0.60).fixedSize(horizontal: false, vertical: true)
                if !draft.detail.isEmpty { Text(draft.detail).font(.system(size: width * 0.032)).foregroundStyle(ink).lineLimit(3).minimumScaleFactor(0.8).fixedSize(horizontal: false, vertical: true) }
                if !draft.price.isEmpty { Text(draft.price).font(.system(size: width * 0.046, weight: .semibold)).foregroundStyle(ink).lineLimit(1) }
                Spacer(minLength: 0)
            }.padding(.horizontal, width * 0.07).padding(.top, story ? height * 0.14 : width * 0.06)
                .padding(.bottom, story ? height * 0.18 : width * 0.04)
                .frame(width: width, height: height, alignment: .topLeading)
                .background(dark ? Palette.actionFill : Color.white)
        }.environment(\.colorScheme, .light)
    }
}
