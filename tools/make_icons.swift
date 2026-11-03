// Временная иконка (настоящая — на этапе дизайна): тёмный фон и иероглиф 心 «кокоро».
// iOS сама скругляет углы, поэтому фон — на весь квадрат.
// Запуск: swift tools/make_icons.swift icons
import AppKit

let out = CommandLine.arguments[1]
let ink = NSColor(red: 0.106, green: 0.106, blue: 0.106, alpha: 1)
let paper = NSColor(red: 0.957, green: 0.949, blue: 0.933, alpha: 1)

func icon(_ size: Int, _ name: String) {
    let S = CGFloat(size)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    ink.setFill(); NSRect(x: 0, y: 0, width: S, height: S).fill()
    let font = NSFont(name: "Hiragino Mincho ProN W6", size: S * 0.56) ?? NSFont.systemFont(ofSize: S * 0.56, weight: .bold)
    let text = NSAttributedString(string: "心", attributes: [.font: font, .foregroundColor: paper])
    let b = text.size()
    text.draw(at: NSPoint(x: (S - b.width) / 2, y: (S - b.height) / 2))
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/\(name)"))
}

icon(192, "icon-192.png")
icon(512, "icon-512.png")
icon(180, "apple-touch-icon.png")
