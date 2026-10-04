import MenuMaterialKit
import SwiftUI

/// My Dishes: every dish with its main photo and price, by menu section.
struct DishesView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var zoom
    @State private var search = ""
    @State private var showAdd = false
    @State private var note: String?
    @State private var error: String?
    @State private var archived = false
    @AppStorage("dishes-compact") private var compact = false

    private struct DishGroup: Identifiable {
        let name: String
        let dishes: [Dish]
        var id: String { name }
    }

    private var query: String { search.trimmingCharacters(in: .whitespaces) }

    private var dishes: [Dish] {
        let active = (model.workspace?.dishes ?? []).filter { $0.sample == 0 && (archived ? $0.archivedAt != nil : $0.archivedAt == nil) }
        guard !query.isEmpty else { return active }
        return active.filter {
            $0.name.localizedCaseInsensitiveContains(query) || $0.category.localizedCaseInsensitiveContains(query)
        }
    }

    /// Sections in the order the restaurant's dishes first use them.
    private var groups: [DishGroup] {
        var order: [String] = []
        var bySection: [String: [Dish]] = [:]
        for dish in dishes {
            let section = dish.displayCategory
            if bySection[section] == nil { order.append(section) }
            bySection[section, default: []].append(dish)
        }
        return order.map { DishGroup(name: $0, dishes: bySection[$0] ?? []) }
    }

    private let columns = [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)]

    var body: some View {
        NavigationStack {
            ScrollView {
                if let error { ErrorNote(message: error).padding(Metrics.gutter) }
                if model.workspace?.dishes.isEmpty ?? true {
                    ContentUnavailableView {
                        Label("Your Dishes Live Here", systemImage: "fork.knife")
                    } description: { Group {
                        Text("Every photo you style is saved to its dish, ready for your menus and posts.")
                    }.foregroundStyle(Palette.muted) } actions: {
                        Button("Style Your First Photo") { model.tab = .studio }
                            .primaryAction()
                    }
                    .padding(.top, 60)
                } else if dishes.isEmpty {
                    ContentUnavailableView { Label("No matching dishes", systemImage: "magnifyingglass") } description: { Text("Try another dish name or section.").foregroundStyle(Palette.muted) }
                        .padding(.top, 60)
                } else {
                    LazyVStack(alignment: .leading, spacing: 30) {
                        ForEach(groups) { group in
                            VStack(alignment: .leading, spacing: 14) {
                                Text(group.name)
                                    .font(.title3.bold())
                                    .foregroundStyle(Palette.ink)
                                if compact {
                                    ForEach(group.dishes) { dish in
                                        NavigationLink(value: dish.id) {
                                            HStack(spacing: 14) {
                                                SquarePhoto(id: model.workspace?.preferredPhoto(for: dish)?.id, radius: 14).frame(width: 68, height: 68)
                                                VStack(alignment: .leading, spacing: 5) {
                                                    Text(dish.name).font(.headline).lineLimit(2).foregroundStyle(Palette.ink)
                                                    Text(dish.isAvailable ? Money.format(hundredths: dish.price, currency: model.restaurant?.currency ?? "USD") : "Sold out").font(.subheadline).foregroundStyle(Palette.muted)
                                                }
                                                Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(Palette.muted)
                                            }.card()
                                        }.buttonStyle(.plain).accessibilityIdentifier("dish-card")
                                    }
                                } else {
                                    LazyVGrid(columns: columns, spacing: 22) { ForEach(group.dishes) { card($0) } }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 4)
                    .padding(.bottom, 24)
                }
            }
            .canvasBackground()
            .navigationTitle(archived ? "Archived Dishes" : "Dishes")
            .searchField(text: $search, placeholder: "Dishes and sections")
            .refreshable { await model.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu("View", systemImage: "line.3.horizontal.decrease") {
                        Toggle("Compact list", isOn: $compact)
                        Toggle("Archived dishes", isOn: $archived)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add Dish", systemImage: "plus") { showAdd = true }
                }
            }
            .navigationDestination(for: String.self) { id in
                DishDetailView(dishId: id)
                    .navigationTransition(.zoom(sourceID: id, in: zoom))
            }
            .sheet(isPresented: $showAdd) { AddDishView() }
            .toast($note)
        }
    }

    private func card(_ dish: Dish) -> some View {
        NavigationLink(value: dish.id) {
            DishCard(dish: dish)
                .matchedTransitionSource(id: dish.id, in: zoom)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("dish-card")
        .contextMenu {
            Button("Style Photo", systemImage: "camera.aperture") { model.styleDish(dish) }
            Button("Create Post", systemImage: "rectangle.portrait") { model.makePost(dishId: dish.id) }
            Button(
                dish.isAvailable ? "Mark as Sold Out" : "Back on the Menu",
                systemImage: dish.isAvailable ? "xmark.circle" : "checkmark.circle"
            ) {
                Task { await setAvailable(dish, !dish.isAvailable) }
            }
        } preview: {
            DishPreview(dish: dish)
        }
        .scrollTransition(.animated(.smooth)) { content, phase in
            content
                .scaleEffect(phase.isIdentity ? 1 : 0.96)
        }
    }

    private func setAvailable(_ dish: Dish, _ available: Bool) async {
        do {
            let reply = try await model.setAvailable(dish, available)
            let live = (reply.menus ?? []).filter { $0.live == true }.map(\.name)
            let done = available ? "\(dish.name) is back on" : "\(dish.name) is sold out"
            note = live.isEmpty ? done : "\(done) · \(live.joined(separator: ", "))"
        } catch { self.error = error.localizedDescription }
    }
}

private struct DishCard: View {
    @Environment(AppModel.self) private var model
    let dish: Dish

    private var photo: Asset? { model.workspace?.preferredPhoto(for: dish) }
    private var currency: String { model.restaurant?.currency ?? "USD" }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SquarePhoto(id: photo?.id, radius: 22)
                .saturation(dish.isAvailable ? 1 : 0)
                .overlay(alignment: .topLeading) {
                    if !dish.isAvailable {
                        Text("Sold Out")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .foregroundStyle(Palette.ink)
                            .background(Palette.surface, in: .capsule)
                            .padding(10)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(dish.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(2)
                Text(dish.price > 0 ? Money.format(hundredths: dish.price, currency: currency) : "No price yet")
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A dish, large: the preview of a long press.
private struct DishPreview: View {
    @Environment(AppModel.self) private var model
    let dish: Dish

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SquarePhoto(id: model.workspace?.preferredPhoto(for: dish)?.id)
                .frame(width: 320, height: 320)
            VStack(alignment: .leading, spacing: 4) {
                Text(dish.name).font(.headline)
                if !dish.description.isEmpty {
                    Text(dish.description)
                        .font(.callout)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(3)
                }
            }
            .padding(16)
        }
        .frame(width: 320)
    }
}

/// A new dish by name and price, ready for photos and menus.
struct AddDishView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var price = ""
    @State private var category = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool
    @State private var creationId = UUID().uuidString.lowercased()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Dish Name", text: $name, prompt: Text("Dish Name").foregroundStyle(Palette.muted))
                        .textInputAutocapitalization(.words)
                        .focused($focused)
                    TextField("Section, such as Mains", text: $category, prompt: Text("Section, such as Mains").foregroundStyle(Palette.muted))
                        .textInputAutocapitalization(.words)
                    TextField("Price", text: $price, prompt: Text("Price").foregroundStyle(Palette.muted))
                        .keyboardType(.decimalPad)
                    if !price.isEmpty && Money.hundredths(from: price) == nil {
                        Text("Enter a price such as 12.50, with no minus sign or extra text.").font(.footnote).foregroundStyle(Palette.danger)
                    }
                } footer: { Group {
                    Text("Add photos from the Studio. The dish is ready for your menus right away.")
                }.foregroundStyle(Palette.muted) }
                if let error {
                    Section { Text(error).foregroundStyle(Palette.danger) }
                }
            }
            .navigationTitle("New Dish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { dismiss() }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
                ToolbarItem(placement: .confirmationAction) { Group {
                    Button("Add", systemImage: "checkmark") { Task { await add() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy || (!price.isEmpty && Money.hundredths(from: price) == nil))
                }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden)
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { focused = true }
    }

    private func add() async {
        busy = true
        defer { busy = false }
        var save = DishSave(newDishNamed: name.trimmingCharacters(in: .whitespaces), id: creationId)
        let section = category.trimmingCharacters(in: .whitespaces)
        if !section.isEmpty { save.category = section }
        if let hundredths = Money.hundredths(from: price) { save.price = Double(hundredths) / 100 }
        do {
            let _: DishSaveResult = try await model.client.post("dishes", save)
            await model.refresh()
            dismiss()
        } catch let failure as APIError {
            error = failure.message
        } catch { self.error = error.localizedDescription }
    }
}
