import MenuMaterialKit
import SwiftUI

/// My Dishes: every dish with its main photo and price, by menu section.
struct DishesView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var zoom
    @State private var search = ""
    @State private var showAdd = false
    @State private var note: String?

    private struct DishGroup: Identifiable {
        let name: String
        let dishes: [Dish]
        var id: String { name }
    }

    private var query: String { search.trimmingCharacters(in: .whitespaces) }

    private var dishes: [Dish] {
        let active = model.workspace?.activeDishes ?? []
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
                if model.workspace?.activeDishes.isEmpty ?? true {
                    ContentUnavailableView {
                        Label("Your Dishes Live Here", systemImage: "fork.knife")
                    } description: {
                        Text("Every photo you style is saved to its dish, ready for your menus and posts.")
                    } actions: {
                        Button("Style Your First Photo") { model.tab = .studio }
                            .primaryAction()
                    }
                    .padding(.top, 60)
                } else if dishes.isEmpty {
                    ContentUnavailableView.search(text: query)
                        .padding(.top, 60)
                } else {
                    LazyVStack(alignment: .leading, spacing: 30) {
                        ForEach(groups) { group in
                            VStack(alignment: .leading, spacing: 14) {
                                Text(group.name)
                                    .font(.title3.bold())
                                    .foregroundStyle(Palette.ink)
                                LazyVGrid(columns: columns, spacing: 22) {
                                    ForEach(group.dishes) { dish in
                                        card(dish)
                                    }
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
            .navigationTitle("Dishes")
            .searchable(text: $search, prompt: "Dishes and sections")
            .refreshable { await model.refresh() }
            .toolbar {
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
                .opacity(phase.isIdentity ? 1 : 0.7)
                .scaleEffect(phase.isIdentity ? 1 : 0.96)
        }
    }

    private func setAvailable(_ dish: Dish, _ available: Bool) async {
        do {
            let reply = try await model.setAvailable(dish, available)
            let live = (reply.menus ?? []).filter { $0.live == true }.map(\.name)
            let done = available ? "\(dish.name) is back on" : "\(dish.name) is sold out"
            note = live.isEmpty ? done : "\(done) · \(live.joined(separator: ", "))"
        } catch {}
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
                            .glassEffect(.regular, in: .capsule)
                            .padding(10)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(dish.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
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
                        .foregroundStyle(.secondary)
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

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Dish Name", text: $name)
                        .textInputAutocapitalization(.words)
                        .focused($focused)
                    TextField("Section, such as Mains", text: $category)
                        .textInputAutocapitalization(.words)
                    TextField("Price", text: $price)
                        .keyboardType(.decimalPad)
                } footer: {
                    Text("Add photos from the Studio. The dish is ready for your menus right away.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(Palette.danger) }
                }
            }
            .navigationTitle("New Dish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", systemImage: "checkmark") { Task { await add() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { focused = true }
    }

    private func add() async {
        busy = true
        defer { busy = false }
        var save = DishSave(newDishNamed: name.trimmingCharacters(in: .whitespaces))
        let section = category.trimmingCharacters(in: .whitespaces)
        if !section.isEmpty { save.category = section }
        if let hundredths = Money.hundredths(from: price) { save.price = Double(hundredths) / 100 }
        do {
            let _: DishSaveResult = try await model.client.post("dishes", save)
            await model.refresh()
            dismiss()
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}
