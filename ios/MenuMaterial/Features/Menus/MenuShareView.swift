import CoreImage.CIFilterBuiltins
import MenuMaterialKit
import SwiftUI

/// A live menu's guest link and QR code, tagged with where it's used so
/// the menu's visit counts can tell them apart.
struct MenuShareView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let menu: MenuRecord
    @State private var placement: MenuPlacement = .table
    @State private var copied = 0

    private var link: URL? {
        guard let origin = model.workspace?.menuOrigin, let slug = model.restaurant?.slug else { return nil }
        return MenuLinks.guestURL(origin: origin, slug: slug, menu: menu, placement: placement)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    Picker("Where guests find it", selection: $placement) {
                        ForEach(MenuPlacement.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if let link {
                        if placement.printed, let code = QRCode.image(for: link.absoluteString) {
                            Image(uiImage: code)
                                .interpolation(.none)
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: 260)
                                .padding(18)
                                .background(.white, in: .rect(cornerRadius: 22))
                                .accessibilityLabel("QR code for \(menu.name)")
                            ShareLink(
                                item: Image(uiImage: code),
                                preview: SharePreview("\(menu.name) QR code", image: Image(uiImage: code))
                            ) {
                                Label("Share QR code", systemImage: "qrcode")
                            }
                            .buttonStyle(.primary)
                        }
                        Text(link.absoluteString)
                            .font(.footnote.monospaced())
                            .foregroundStyle(Palette.muted)
                            .textSelection(.enabled)
                            .multilineTextAlignment(.center)
                        HStack(spacing: 12) {
                            Button {
                                UIPasteboard.general.url = link
                                copied += 1
                            } label: {
                                Label("Copy link", systemImage: "doc.on.doc")
                            }
                            .buttonStyle(.secondary)
                            ShareLink(item: link) {
                                Label("Share link", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(.secondary)
                        }
                        Link("Open the guest page", destination: link)
                            .font(.callout.weight(.medium))
                    } else {
                        Text("Your menu’s address isn’t ready yet. Pull to refresh, or open Menus on menumaterial.com.")
                            .foregroundStyle(Palette.muted)
                    }
                }
                .padding(Metrics.gutter)
            }
            .canvasBackground()
            .navigationTitle("Share \(menu.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .sensoryFeedback(.success, trigger: copied)
        }
    }
}

enum QRCode {
    /// Medium error correction in the site's evergreen on white, as the web
    /// draws it, with a quiet zone of four modules.
    static func image(for text: String, pixelsPerModule: CGFloat = 20) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let code = filter.outputImage else { return nil }
        let colored = code.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(red: 0.094, green: 0.243, blue: 0.192),
            "inputColor1": CIColor(red: 1, green: 1, blue: 1),
        ])
        let scaled = colored.transformed(by: CGAffineTransform(scaleX: pixelsPerModule, y: pixelsPerModule))
        guard let cgImage = CIContext().createCGImage(scaled, from: scaled.extent) else { return nil }
        let margin = 4 * pixelsPerModule
        let size = CGSize(width: scaled.extent.width + margin * 2, height: scaled.extent.height + margin * 2)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            context.cgContext.interpolationQuality = .none
            UIImage(cgImage: cgImage).draw(in: CGRect(x: margin, y: margin, width: scaled.extent.width, height: scaled.extent.height))
        }
    }
}
