import MenuMaterialKit
import SwiftUI

/// One dish: its photos, details, price and whether it's on the menu.
/// Saving sends every field, because the server replaces the whole dish.
struct DishDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let dishId: String
    @State private var draft: DishSave?
    @State private var priceText = ""
    @State private var busy = false
    @State private var note: String?
    @State private var error: String?
    @State private var showArchive = false
    @State private var scrolledPastPhoto = false

    private var dish: Dish? { model.workspace?.dishes.first { $0.id == dishId } }
    private var photos: [Asset] { model.workspace?.photos(for: dishId) ?? [] }
    private var main: Asset? { dish.flatMap { model.workspace?.preferredPhoto(for: $0) } }
    private var currency: String { model.restaurant?.currency ?? "USD" }

    private var changed: Bool {
        guard let dish, let draft else { return false }
        let base = DishSave(dish: dish)
        return draft.name != base.name || draft.description != base.description
            || draft.category != base.category || priceHundredths != dish.price
    }

    private var priceHundredths: Int {
        priceText.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : (Money.hundredths(from: priceText) ?? -1)
    }

    var body: some View {
        ScrollView {
            if let dish {
                VStack(alignment: .leading, spacing: 0) {
                    HeroPhoto(id: main?.id)
                    VStack(alignment: .leading, spacing: 28) {
                        header(dish)
                        availability(dish)
                        if photos.count > 1 { photoStrip }
                        details
                        if let error { ErrorNote(message: error) }
                        Button(role: .destructive) {
                            showArchive = true
                        } label: {
                            Label("Archive Dish", systemImage: "archivebox")
                                .frame(maxWidth: .infinity)
                        }
                        .secondaryAction()
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 22)
                    .padding(.bottom, 40)
                }
            }
        }
        .ignoresSafeArea(.container, edges: .top)
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y + geometry.contentInsets.top > geometry.containerSize.width * 0.8
        } action: { _, past in
            withAnimation(.smooth(duration: 0.2)) { scrolledPastPhoto = past }
        }
        .canvasBackground()
        .navigationTitle(scrolledPastPhoto ? (dish?.name ?? "Dish") : "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if changed {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark") { Task { await save() } }
                        .disabled(busy || priceHundredths < 0 || (draft?.name.isEmpty ?? true))
                }
            }
        }
        .confirmationDialog("Archive this dish?", isPresented: $showArchive, titleVisibility: .visible) {
            Button("Archive", role: .destructive) { Task { await archive() } }
        } message: {
            Text("It leaves My Dishes. Published menus and posts that show it stay as they are.")
        }
        .toast($note)
        .onAppear(perform: reset)
    }

    private func header(_ dish: Dish) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(dish.name)
                .font(.display(.largeTitle))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                if dish.price > 0 {
                    Text(Money.format(hundredths: dish.price, currency: currency))
                        .foregroundStyle(Palette.ink)
                }
                Text(dish.displayCategory)
                    .foregroundStyle(Palette.muted)
            }
            .font(.title3.weight(.medium))
            if !dish.description.isEmpty {
                Text(dish.description)
                    .font(.body)
                    .foregroundStyle(Palette.muted)
                    .padding(.top, 4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var photoStrip: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Photos")
                .font(.title3.bold())
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(photos) { photo in
                        Button {
                            if photo.id != main?.id { Task { await makeMain(photo.id) } }
                        } label: {
                            SquarePhoto(id: photo.id, radius: 16)
                                .frame(width: 92, height: 92)
                                .padding(3)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 19)
                                        .strokeBorder(photo.id == main?.id ? Palette.accent : .clear, lineWidth: 2.5)
                                }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(photo.id == main?.id ? "Main photo" : "Use as main photo")
                    }
                }
            }
            .scrollClipDisabled()
            Text("Tap a photo to make it the one your menus show.")
                .font(.footnote)
                .foregroundStyle(Palette.muted)
        }
    }

    private func availability(_ dish: Dish) -> some View {
        Toggle(isOn: Binding(
            get: { dish.isAvailable },
            set: { on in Task { await setAvailable(on) } }
        )) {
            HStack(spacing: 14) {
                SettingsIcon(
                    symbol: dish.isAvailable ? "fork.knife" : "nosign",
                    color: dish.isAvailable ? Palette.accent : Palette.warning
                )
                .contentTransition(.symbolEffect(.replace))
                VStack(alignment: .leading, spacing: 2) {
                    Text(dish.isAvailable ? "On the Menu" : "Sold Out")
                        .font(.headline)
                        .contentTransition(.opacity)
                    Text("Changes reach your live menus right away.")
                        .font(.footnote)
                        .foregroundStyle(Palette.muted)
                }
            }
        }
        .tint(Palette.accent)
        .card()
        .disabled(busy)
    }

    @ViewBuilder
    private var details: some View {
        if let binding = Binding($draft) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Details")
                    .font(.title3.bold())
                VStack(spacing: 0) {
                    row("Name") {
                        TextField("Dish name", text: binding.name)
                            .textInputAutocapitalization(.words)
                    }
                    Divider().padding(.leading, 16)
                    row("Section") {
                        TextField("Dishes", text: binding.category)
                            .textInputAutocapitalization(.words)
                    }
                    Divider().padding(.leading, 16)
                    row("Price") {
                        TextField(Money.format(hundredths: 0, currency: currency), text: $priceText)
                            .keyboardType(.decimalPad)
                    }
                    Divider().padding(.leading, 16)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .foregroundStyle(Palette.muted)
                        TextField("Ingredients and how it’s served", text: binding.description, axis: .vertical)
                            .lineLimit(2...6)
                    }
                    .padding(16)
                }
                .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
            }
        }
    }

    private func row<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 12) {
            Text(title)
                .foregroundStyle(Palette.muted)
                .frame(width: 84, alignment: .leading)
            content()
        }
        .padding(.horizontal, 16)
        .frame(minHeight: Metrics.rowHeight)
    }

    private func reset() {
        guard let dish else { return }
        draft = DishSave(dish: dish)
        priceText = dish.price > 0 ? String(format: "%.2f", Double(dish.price) / 100) : ""
    }

    private func save() async {
        guard var save = draft, let dish else { return }
        save.revision = dish.revision
        save.price = Double(max(0, priceHundredths)) / 100
        save.available = dish.isAvailable
        await send(save, success: "Saved")
    }

    private func setAvailable(_ on: Bool) async {
        guard let dish else { return }
        var save = DishSave(dish: dish)
        save.available = on
        await send(save, success: on ? "Back on your menus" : "Marked sold out")
    }

    private func send(_ save: DishSave, success: String) async {
        busy = true
        defer { busy = false }
        error = nil
        do {
            let reply: DishSaveResult = try await model.client.post("dishes/\(dishId)", save)
            await model.refresh()
            reset()
            let live = (reply.menus ?? []).filter { $0.live == true }.map(\.name)
            note = live.isEmpty ? success : "\(success) · \(live.joined(separator: ", "))"
        } catch let failure as APIError {
            if failure.status == 409 {
                await model.refresh()
                reset()
            }
            error = failure.message
        } catch {}
    }

    private func makeMain(_ assetId: String) async {
        do {
            let _: OK = try await model.client.post("assets/\(assetId)/use", PhotoUse(action: "main"))
            let _: OK = try await model.client.post("library/\(dishId)", LibraryUpdate(preferredPhotoId: assetId))
            await model.refresh()
            note = "Main photo updated"
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }

    private func archive() async {
        do {
            let _: OK = try await model.client.post("library/\(dishId)", LibraryUpdate(archived: true))
            await model.refresh()
            dismiss()
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}

/// The dish's photo across the top, under the navigation bar. Pulling down
/// stretches it, as in Music and the App Store.
private struct HeroPhoto: View {
    let id: String?

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                if let id {
                    AssetImage(id: id)
                } else {
                    ZStack {
                        Palette.stage
                        VStack(spacing: 10) {
                            Image(systemName: "camera").font(.largeTitle)
                            Text("No photo yet").font(.callout)
                        }
                        .foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
            .clipped()
            .visualEffect { content, proxy in
                let pull = max(0, proxy.frame(in: .scrollView).minY)
                return content
                    .scaleEffect(1 + pull / max(1, proxy.size.height), anchor: .bottom)
            }
    }
}
