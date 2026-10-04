import MenuMaterialKit
import SwiftUI

struct RestaurantOnboardingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var editing = false
    @State private var step = 0
    @State private var name = ""
    @State private var cuisine = ""
    @State private var profile = RestaurantProfile()
    @State private var busy = false
    @State private var error: String?
    private let goals = ["Better food photos", "Social posts", "Digital menus", "Delivery listings"]
    private let actions = [("photo", "Style a photo", "camera.aperture"), ("explore", "Explore styles", "square.grid.2x2"), ("menu", "Build a menu", "menucard")]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack { BrandMark(height: 28).foregroundStyle(Palette.accent); Spacer(); Text("\(step + 1) of 3").font(.subheadline).foregroundStyle(Palette.muted) }
                    ProgressView(value: Double(step + 1), total: 3).tint(Palette.accent).accessibilityLabel("Setup step \(step + 1) of 3")
                    VStack(alignment: .leading, spacing: 10) {
                        Text(title).font(.display(.largeTitle))
                        Text(subtitle).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                    }
                    if step == 0 {
                        VStack(alignment: .leading, spacing: 20) {
                            field("Restaurant name", placeholder: "Your restaurant", value: $name)
                            field("Your first name · optional", placeholder: "First name", value: $profile.firstName)
                            field("Cuisine · optional", placeholder: "Italian, café, bakery…", value: $cuisine)
                            Picker("Your role", selection: $profile.role) {
                                ForEach(["Owner", "Manager", "Chef", "Marketing", "Team member"], id: \.self) { Text($0) }
                            }.tint(Palette.accent)
                        }.card()
                    } else if step == 1 {
                        ForEach(goals, id: \.self) { goal in
                            Button {
                                if profile.goals.contains(goal) { profile.goals.removeAll { $0 == goal } }
                                else { profile.goals.append(goal) }
                            } label: {
                                HStack { Text(goal).font(.headline); Spacer(); Image(systemName: profile.goals.contains(goal) ? "checkmark.circle.fill" : "circle").font(.title2) }
                                    .foregroundStyle(profile.goals.contains(goal) ? Palette.accent : Palette.ink).card()
                            }.buttonStyle(.plain).accessibilityAddTraits(profile.goals.contains(goal) ? .isSelected : [])
                        }
                    } else {
                        ForEach(actions, id: \.0) { action in
                            Button { profile.firstAction = action.0 } label: {
                                HStack(spacing: 16) {
                                    SettingsIcon(symbol: action.2, color: Palette.accent)
                                    Text(action.1).font(.headline); Spacer()
                                    if profile.firstAction == action.0 { Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.accent) }
                                }.foregroundStyle(Palette.ink).card()
                            }.buttonStyle(.plain)
                        }
                        Label("You can change your preferences in Account anytime.", systemImage: "slider.horizontal.3")
                            .font(.footnote).foregroundStyle(Palette.muted)
                    }
                    if let error { ErrorNote(message: error) }
                }.padding(Metrics.gutter).padding(.bottom, 24)
            }
            .canvasBackground()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    if step > 0 { Button("Back", systemImage: "chevron.left") { step -= 1 }.disabled(busy) }
                    else if editing { Button("Cancel") { dismiss() } }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
            }
            .bottomBar {
                Button { if step < 2 { withAnimation(.smooth) { step += 1 } } else { Task { await finish() } } } label: {
                    HStack { if busy { ProgressView() }; Text(step == 2 ? "Let’s get started" : "Continue") }.frame(maxWidth: .infinity)
                }.primaryAction().disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                    .padding(.horizontal, Metrics.gutter).padding(.vertical, 12)
            }
        }
        .interactiveDismissDisabled(!editing || busy)
        .onAppear { name = model.restaurant?.name ?? ""; cuisine = model.restaurant?.cuisine ?? ""; profile = model.profile }
    }
    private var title: String { ["Make yourself at home.", "What will you create?", "Start with something good."][step] }
    private var subtitle: String { ["A few details to make Menu Material yours.", "Choose as many as you like. We’ll keep the right tools close by.", "Your workspace is ready. Choose where you’d like to begin."][step] }
    private func field(_ title: String, placeholder: String, value: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.medium)).foregroundStyle(Palette.muted)
            TextField(placeholder, text: value, prompt: Text(placeholder).foregroundStyle(Palette.muted)).textInputAutocapitalization(.words).submitLabel(.next)
        }
    }
    private func finish() async {
        busy = true; error = nil
        defer { busy = false }
        profile.completed = true
        do {
            try await model.saveProfile(profile, restaurantName: name.trimmingCharacters(in: .whitespacesAndNewlines), cuisine: cuisine)
            if !editing {
                model.tab = profile.firstAction == "menu" ? .menus : .studio
                model.exploreRequested = profile.firstAction == "explore"
            }
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
