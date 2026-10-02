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
                VStack(alignment: .leading, spacing: 22) {
                    PhotoStage(ratio: 1) {
                        if let main {
                            AssetImage(id: main.id)
                        } else {
                            VStack(spacing: 10) {
                                Image(systemName: "camera").font(.largeTitle)
                                Text("No photo yet").font(.callout)
                            }
                            .foregroundStyle(.white.opacity(0.7))
                        }
                    }
                    if photos.count > 1 { photoStrip(dish) }

                    availability(dish)
                    details

                    if let note {
                        Label(note, systemImage: "checkmark.circle.fill")
                            .font(.callout)
                            .foregroundStyle(Palette.accent)
                    }
                    if let error { ErrorNote(message: error) }

                    Button(role: .destructive) {
                        showArchive = true
                    } label: {
                        Label("Archive dish", systemImage: "archivebox")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 32)
            }
        }
        .canvasBackground()
        .navigationTitle(dish?.name ?? "Dish")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                if changed {
                    Button("Save") { Task { await save() } }
                        .disabled(busy || priceHundredths < 0 || (draft?.name.isEmpty ?? true))
                }
            }
        }
        .confirmationDialog("Archive this dish?", isPresented: $showArchive, titleVisibility: .visible) {
            Button("Archive", role: .destructive) { Task { await archive() } }
        } message: {
            Text("It leaves My Dishes. Published menus and posts that show it stay as they are.")
        }
        .onAppear(perform: reset)
    }

    private func photoStrip(_ dish: Dish) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(photos) { photo in
                    AssetImage(id: photo.id)
                        .frame(width: 76, height: 76)
                        .clipShape(.rect(cornerRadius: 14))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(photo.id == main?.id ? Palette.accent : .clear, lineWidth: 2.5)
                        }
                        .contextMenu {
                            if photo.id != main?.id {
                                Button("Use as main photo", systemImage: "star") {
                                    Task { await makeMain(photo.id) }
                                }
                            }
                        }
                }
            }
        }
        .scrollClipDisabled()
    }

    private func availability(_ dish: Dish) -> some View {
        Toggle(isOn: Binding(
            get: { dish.isAvailable },
            set: { on in Task { await setAvailable(on) } }
        )) {
            VStack(alignment: .leading, spacing: 2) {
                Text(dish.isAvailable ? "On the menu" : "Sold out")
                    .font(.headline)
                Text("Changes reach your live menus right away.")
                    .font(.footnote)
                    .foregroundStyle(Palette.muted)
            }
        }
        .tint(Palette.accent)
        .card()
        .disabled(busy)
    }

    @ViewBuilder
    private var details: some View {
        if let binding = Binding($draft) {
            VStack(alignment: .leading, spacing: 14) {
                Text("Details").eyebrowStyle()
                labeled("Name") {
                    TextField("Dish name", text: binding.name)
                        .textInputAutocapitalization(.words)
                }
                labeled("Section") {
                    TextField("Dishes", text: binding.category)
                        .textInputAutocapitalization(.words)
                }
                labeled("Price") {
                    TextField(Money.format(hundredths: 0, currency: currency), text: $priceText)
                        .keyboardType(.decimalPad)
                }
                labeled("Description") {
                    TextField("Ingredients and how it’s served", text: binding.description, axis: .vertical)
                        .lineLimit(2...6)
                }
            }
        }
    }

    private func labeled<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted)
            content()
                .padding(12)
                .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
        }
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
            note = live.isEmpty ? success : "\(success). Live on \(live.joined(separator: ", "))."
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
