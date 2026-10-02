import Foundation
import ImageIO
import MenuMaterialKit
import UIKit

/// A dish photo ready to upload: the original file, kept as it is, and the
/// working copy the server and the image model read, made as the web makes
/// it (lib/client.ts): upright, on white, at most 2048 px on its long side,
/// JPEG at quality 0.9. Both are kept, so a retried upload sends the same
/// bytes.
nonisolated struct PreparedPhoto: Sendable {
    let original: Data
    let originalName: String
    let originalType: String
    let working: Data
    let preview: UIImage

    static let maxOriginalBytes = 20 * 1024 * 1024

    /// From the photo library: the file as it is, usually HEIC.
    static func fromLibrary(_ data: Data) async throws -> PreparedPhoto {
        try await Task.detached(priority: .userInitiated) {
            guard let image = UIImage(data: data) else { throw PreparationError.unreadable }
            let working = try normalized(image)
            let kind = fileKind(data)
            // Too large, or a kind the server won't take: send the working copy.
            if data.count > maxOriginalBytes || kind == nil {
                return PreparedPhoto(
                    original: working, originalName: "photo.jpg", originalType: "image/jpeg",
                    working: working, preview: UIImage(data: working) ?? image
                )
            }
            return PreparedPhoto(
                original: data, originalName: "photo.\(kind!.ext)", originalType: kind!.mime,
                working: working, preview: UIImage(data: working) ?? image
            )
        }.value
    }

    /// From the camera: a JPEG of what was taken.
    static func fromCamera(_ image: UIImage) async throws -> PreparedPhoto {
        try await Task.detached(priority: .userInitiated) {
            guard let original = image.jpegData(compressionQuality: 0.92) else { throw PreparationError.unreadable }
            let working = try normalized(image)
            return PreparedPhoto(
                original: original.count > maxOriginalBytes ? working : original,
                originalName: "photo.jpg", originalType: "image/jpeg",
                working: working, preview: UIImage(data: working) ?? image
            )
        }.value
    }

    /// The working copy: orientation baked in, opaque white behind any
    /// transparency, long edge at most 2048 px, never enlarged.
    static func normalized(_ image: UIImage) throws -> Data {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        guard pixels.width >= 1, pixels.height >= 1 else { throw PreparationError.unreadable }
        guard pixels.width * pixels.height <= 80_000_000 else { throw PreparationError.tooLarge }
        let scale = min(1, 2048 / max(pixels.width, pixels.height))
        let size = CGSize(width: (pixels.width * scale).rounded(), height: (pixels.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let data = rendered.jpegData(compressionQuality: 0.9) else { throw PreparationError.unreadable }
        return data
    }

    /// The server reads a file's type from its first bytes.
    static func fileKind(_ data: Data) -> (mime: String, ext: String)? {
        let bytes = [UInt8](data.prefix(12))
        guard bytes.count >= 12 else { return nil }
        if bytes[0] == 0xFF, bytes[1] == 0xD8, bytes[2] == 0xFF { return ("image/jpeg", "jpg") }
        if bytes[0] == 0x89, bytes[1] == 0x50, bytes[2] == 0x4E, bytes[3] == 0x47 { return ("image/png", "png") }
        if String(bytes: bytes[0..<4], encoding: .ascii) == "RIFF",
           String(bytes: bytes[8..<12], encoding: .ascii) == "WEBP" { return ("image/webp", "webp") }
        if String(bytes: bytes[4..<8], encoding: .ascii) == "ftyp" {
            let brand = String(bytes: bytes[8..<12], encoding: .ascii) ?? ""
            if ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].contains(brand) { return ("image/heic", "heic") }
        }
        return nil
    }

    nonisolated enum PreparationError: LocalizedError {
        case unreadable, tooLarge

        var errorDescription: String? {
            switch self {
            case .unreadable: "This photo couldn’t be read. Choose another, or take a new one."
            case .tooLarge: "This photo is too large to work with. Choose a smaller version."
            }
        }
    }
}

extension MultipartForm {
    /// `POST /api/assets` for a dish photo.
    static func dishPhoto(_ photo: PreparedPhoto, dishId: String, requestKey: String) -> MultipartForm {
        var form = MultipartForm()
        form.add("file", filename: photo.originalName, contentType: photo.originalType, data: photo.original)
        form.add("normalized", filename: "working.jpg", contentType: "image/jpeg", data: photo.working)
        form.add("dishId", dishId)
        form.add("requestKey", requestKey)
        return form
    }
}
