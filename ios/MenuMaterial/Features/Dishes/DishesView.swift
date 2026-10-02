import MenuMaterialKit
import SwiftUI

/// My Dishes: every dish with its main photo, price and whether it's on.
struct DishesView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var zoom
    @State private var search = ""
    @State private var showAdd = false

    private var dishes: [Dish] {
        let active = model.workspace?.activeDishes ?? []
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return active }
        return active.filter {
            $0.name.localizedCaseInsensitiveContains(query) || $0.category.localizedCaseInsensitiveContains(query)
        }
    }

    private let columns = [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                if model.workspace?.activeDishes.isEmpty ?? true {
                    EmptyState(
                        symbol: "fork.knife",
                        title: "Your dishes live here",
                        message: "Every photo you style is saved to its dish, ready for your menus and posts."
                    ) {
                        Button("Style your first photo") { model.tab = .studio }
                            .buttonStyle(.primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                } else {
                    LazyVGrid(columns: columns, spacing: 18) {
                        ForEach(dishes) { dish in
                            NavigationLink(value: dish.id) {
                                DishCard(dish: dish)
                                    .matchedTransitionSource(id: dish.id, in: zoom)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("dish-card")
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.bottom, 24)
                }
            }
            .canvasBackground()
            .navigationTitle("My Dishes")
            .searchable(text: $search, prompt: "Search dishes")
            .refreshable { await model.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add dish", systemImage: "plus") { showAdd = true }
                }
            }
            .navigationDestination(for: String.self) { id in
                DishDetailView(dishId: id)
                    .navigationTransition(.zoom(sourceID: id, in: zoom))
            }
            .sheet(isPresented: $showAdd) { AddDishView() }
        }
    }
}

private struct DishCard: View {
    @Environment(AppModel.self) private var model
    let dish: Dish

    private var photo: Asset? { model.workspace?.preferredPhoto(for: dish) }
    private var currency: String { model.restaurant?.currency ?? "USD" }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topLeading) {
                Group {
                    if let photo {
                        AssetImage(id: photo.id)
                    } else {
                        ZStack {
                            Palette.raised
                            Image(systemName: "camera")
                                .font(.title2)
                                .foregroundStyle(Palette.muted)
                        }
                    }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipShape(.rect(cornerRadius: 20))
                if !dish.isAvailable {
                    Text("Sold out")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .glassEffect(.regular, in: .capsule)
                        .padding(10)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(dish.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(2)
                Text(dish.price > 0 ? Money.format(hundredths: dish.price, currency: currency) : dish.displayCategory)
                    .font(.footnote)
                    .foregroundStyle(Palette.muted)
            }
        }
        .accessibilityElement(children: .combine)
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

    var body: some View {
        NavigationStack {
            Form {
                TextField("Dish name", text: $name)
                    .textInputAutocapitalization(.words)
                TextField("Section, such as Mains", text: $category)
                    .textInputAutocapitalization(.words)
                TextField("Price", text: $price)
                    .keyboardType(.decimalPad)
                if let error {
                    Text(error).foregroundStyle(Palette.danger)
                }
            }
            .scrollContentBackground(.hidden)
            .canvasBackground()
            .navigationTitle("Add a dish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await add() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                }
            }
        }
        .presentationDetents([.medium])
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
