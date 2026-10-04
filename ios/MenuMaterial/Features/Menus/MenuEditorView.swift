import MenuMaterialKit
import SwiftUI

struct NativeMenuSave: Encodable {
    var id: String
    var revision: Int?
    var name: String
    var dishIds: [String]
    var refreshPhotoDishIds: [String] = []
}

struct MenuEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var menu: MenuRecord?
    var onSave: (MenuRecord) -> Void
    @State private var id = UUID().uuidString.lowercased()
    @State private var name = "Dinner menu"
    @State private var selected = Set<String>()
    @State private var refreshPhotos = false
    @State private var busy = false
    @State private var error: String?
    @State private var search = ""
    private var dishes: [Dish] { (model.workspace?.activeDishes ?? []).filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) } }
    var body: some View {
        NavigationStack {
            Form {
                Section { TextField("Menu name", text: $name, prompt: Text("Menu name").foregroundStyle(Palette.muted)).textInputAutocapitalization(.words) } header: { Text("Menu name").foregroundStyle(Palette.muted) }
                Section {
                    ForEach(dishes) { dish in
                        Button {
                            if selected.contains(dish.id) { selected.remove(dish.id) } else { selected.insert(dish.id) }
                        } label: {
                            HStack(spacing: 12) {
                                SquarePhoto(id: model.workspace?.preferredPhoto(for: dish)?.id, radius: 12).frame(width: 48, height: 48)
                                VStack(alignment: .leading) { Text(dish.name).foregroundStyle(Palette.ink); Text(dish.displayCategory).font(.caption).foregroundStyle(Palette.muted) }
                                Spacer(); Image(systemName: selected.contains(dish.id) ? "checkmark.circle.fill" : "circle").foregroundStyle(Palette.accent)
                            }
                        }.buttonStyle(.plain)
                    }
                    if dishes.isEmpty { Text("Add dishes in the Dishes tab, then choose them here.").foregroundStyle(Palette.muted) }
                } header: { Group { Text("Dishes · \(selected.count) selected") }.foregroundStyle(Palette.muted) } footer: { Group {
                    Text("Your sections and design are kept. Unchecking a dish removes it from this draft. Imported entries stay as they are.")
                }.foregroundStyle(Palette.muted) }
                if menu != nil {
                    Section {
                        Toggle("Use current dish photos", isOn: $refreshPhotos).tint(Palette.actionFill)
                    } footer: { Group { Text("Updates the selected dishes in this draft. Review and publish to change what guests see.") }.foregroundStyle(Palette.muted) }
                }
                if let error { Section { ErrorNote(message: error) } }
            }.searchField(text: $search, placeholder: "Find a dish")
                .navigationTitle(menu == nil ? "New Menu" : "Edit Menu").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Group { Button("Cancel") { dismiss() }.disabled(busy) }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
                    ToolbarItem(placement: .confirmationAction) { Group {
                        Button(busy ? "Saving…" : "Save Draft") { Task { await save() } }
                            .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty || selected.isEmpty)
                    }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden)
                }
        }.interactiveDismissDisabled(busy)
            .onAppear {
                if let menu { id = menu.id; name = menu.name; selected = Set(menu.draft.sections.flatMap(\.items).compactMap(\.dishId)) }
            }
    }
    private func save() async {
        busy = true; error = nil; defer { busy = false }
        do {
            let updated: MenuRecord = try await model.client.post("native/menus", NativeMenuSave(id: id, revision: menu?.revision, name: name, dishIds: selected.sorted(), refreshPhotoDishIds: refreshPhotos ? selected.sorted() : []))
            onSave(updated); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct MenuPublishView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let menu: MenuRecord
    let onSave: (MenuRecord) -> Void
    @State private var address = ""
    @State private var confirmed = false
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(menu.name).font(.display(.title))
                    Text(menu.isLive ? "Publishing replaces the live menu with this saved draft." : "Publishing makes this menu available to guests.").foregroundStyle(Palette.muted)
                }
                ForEach(menu.draft.sections) { section in
                    Section {
                        ForEach(section.items) { entry in
                            HStack(spacing: 14) {
                                if let photo = entry.photoId { SquarePhoto(id: photo, radius: 10).frame(width: 56, height: 56) }
                                VStack(alignment: .leading) {
                                    Text(entry.name).font(.headline)
                                    if !entry.description.isEmpty { Text(entry.description).font(.caption).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
                                    if !entry.available { Text("Sold out").font(.caption).foregroundStyle(Palette.warning) }
                                }
                                Spacer()
                                if entry.priceMode == "label" { Text(entry.priceLabel).font(.subheadline) }
                                if entry.priceMode == "included" { Text("Included").font(.subheadline) }
                                if entry.priceMode == "single", let price = entry.price { Text(Money.format(hundredths: price, currency: model.restaurant?.currency ?? "USD")).font(.subheadline) }
                                if entry.priceMode == "variants" { Text(entry.variants.map { "\($0.label ?? "") \(Money.format(hundredths: $0.price, currency: model.restaurant?.currency ?? "USD"))" }.joined(separator: "\n")).font(.caption) }
                            }
                        }
                    } header: { Text(section.name).foregroundStyle(Palette.muted) }
                }
                if model.restaurant?.slug == nil {
                    Section {
                        TextField("your-restaurant", text: $address, prompt: Text("your-restaurant").foregroundStyle(Palette.muted)).textInputAutocapitalization(.never).autocorrectionDisabled()
                    } header: { Text("Menu address").foregroundStyle(Palette.muted) }
                }
                Section {
                    Toggle("I’ve checked the dishes, prices and photos", isOn: $confirmed).tint(Palette.actionFill)
                } footer: { Group { Text("Check ingredients and portions against what you actually serve. Your existing menu design is kept.") }.foregroundStyle(Palette.muted) }
                if let error { Section { ErrorNote(message: error) } }
            }.navigationTitle("Review Menu").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Group { Button("Cancel") { dismiss() }.disabled(busy) }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden) }
                .bottomBar {
                    Button { Task { await publish() } } label: { Text(busy ? "Publishing…" : "Publish Menu").frame(maxWidth: .infinity) }
                        .primaryAction().disabled(!confirmed || busy).padding(Metrics.gutter)
                }
        }.interactiveDismissDisabled(busy)
    }
    private func publish() async {
        struct Publish: Encodable { let revision: Int; let confirmed = true; let address: String? }
        busy = true; error = nil; defer { busy = false }
        do {
            let updated: MenuRecord = try await model.client.post("menus/\(menu.id)/publish", Publish(revision: menu.revision, address: address.isEmpty ? nil : address))
            onSave(updated); await model.refresh(); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

/// Names exactly which menus need a photo update. Saving changes only their
/// draft; the standard review sheet explicitly publishes the whole draft.
struct DishMenusView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let dishId: String
    @State private var menus: [MenuRecord] = []
    @State private var loading = true
    @State private var busy: String?
    @State private var error: String?
    @State private var review: MenuRecord?
    @State private var note: String?
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Choose a menu to review the new dish photo before publishing. Other saved changes in that menu will also be published.").foregroundStyle(Palette.muted)
                }
                if loading { ProgressView() }
                if !loading && menus.isEmpty { Text("This dish isn’t linked to a menu yet. Add it from the Menus tab.") }
                ForEach(menus) { menu in
                    Button { Task { await update(menu) } } label: {
                        HStack { VStack(alignment: .leading) { Text(menu.name).font(.headline); Text(menu.isLive ? "Live menu" : "Draft").font(.caption) }; Spacer(); if busy == menu.id { ProgressView() } else { Image(systemName: "chevron.right") } }
                    }.disabled(busy != nil)
                }
                if let error { ErrorNote(message: error); Button("Retry") { Task { await load() } } }
            }.navigationTitle("Update Menus").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Group { Button("Done") { dismiss() } }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden) }
        }.task { await load() }.sheet(item: $review) { menu in
            MenuPublishView(menu: menu) { updated in
                if let index = menus.firstIndex(where: { $0.id == updated.id }) { menus[index] = updated }
                note = "\(updated.name) is updated for guests"
            }
        }.toast($note)
    }
    private func load() async {
        loading = true; defer { loading = false }
        do {
            let list: MenuList = try await model.client.get("menus")
            menus = list.menus.filter { $0.draft.sections.flatMap(\.items).contains { $0.dishId == dishId } }
            error = nil
        } catch { self.error = error.localizedDescription }
    }
    private func update(_ menu: MenuRecord) async {
        busy = menu.id; defer { busy = nil }
        do {
            let updated: MenuRecord = try await model.client.post("native/menus", NativeMenuSave(id: menu.id, revision: menu.revision, name: menu.name, dishIds: Array(Set(menu.draft.sections.flatMap(\.items).compactMap(\.dishId))), refreshPhotoDishIds: [dishId]))
            if let index = menus.firstIndex(where: { $0.id == menu.id }) { menus[index] = updated }
            review = updated
        } catch { self.error = error.localizedDescription }
    }
}
